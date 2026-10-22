// Humlab Showcase build: partials + page fragments -> static HTML in dist/.
// No dependencies, no framework, no client-side JS. Run: node build.mjs
//
// Pages are assembled and validated in memory, so a failing check leaves the
// previously built dist/ untouched on disk. The one exception is the webp encode step: it
// runs after the checks and before the pages are written, so if cwebp dies halfway you get
// an assets-only dist/ and a non-zero exit. Nothing is published on an exit code of 1.
import { readFileSync as read, writeFileSync as write, mkdirSync, rmSync, cpSync, readdirSync, statSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { basename, dirname, join } from 'node:path';

const SRC = 'src', OUT = 'dist';
const ORIGIN = 'https://showcase.humlab.umu.se';
const SITE_DESC = "Humlab at Umeå University's showcase of projects that are ongoing and have been completed.";
const PLACEHOLDERS = ['Insert text here', 'Image text', 'Add names of', 'Lorem ipsum'];
// Tags that must balance; used to catch markup a browser would otherwise repair silently.
const NEEDS_CLOSING = ['div', 'section', 'article', 'main', 'p', 'ul', 'ol', 'li', 'a',
  'table', 'tr', 'td', 'video', 'iframe', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
// Hosts that answer on http but have no working TLS; every other link must be https.
// (enida/staden/yrkesrum were here until their apps were switched off and their Explore
// buttons removed — see the note in README.)
const HTTP_ONLY = ['ships.ddb.umu.se', 'digitalhumanities.lv'];
const httpAllowed = (host) => HTTP_ONLY.some((h) => host === h || host.endsWith(`.${h}`));
// Pages written predominantly in Swedish (see tools/lang.mjs for how this was measured).
// Screen readers pick the pronunciation from html lang; a wrong one reads Swedish with an
// English voice. Blocks inside English pages use <span class="sv" lang="sv">.
const SWEDISH = new Set([
  'aps', 'dialectical-imaginaries', 'digibon', 'melody', 'umanista', 'utopia', 'yrkesrum',
]);

const problems = [], warnings = [], unsized = [];
const src = (p) => read(join(SRC, p), 'utf8');

// ---------- what dist/ will contain ----------
const assets = [];
const hidden = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // Nothing hidden under src/ is content: .DS_Store and AppleDouble sidecars from a mac
    // that browsed the tree, .gitkeep relics. A wholesale copy has no opinion, so they
    // shipped - assets/.gitkeep answered 200 on the live site until it was deleted, and the
    // unused-asset warning below used to look the other way for exactly these names. If
    // ACME ever wants /.well-known it arrives from the deploy side, not through dist.
    if (entry.name.startsWith('.')) { hidden.push(join(dir, entry.name).slice(SRC.length + 1)); continue; }
    const p = join(dir, entry.name);
    entry.isDirectory() ? walk(p) : assets.push(p.slice(SRC.length + 1));
  }
})(join(SRC, 'assets'));

const pageFiles = readdirSync(join(SRC, 'pages'));
pageFiles.filter((f) => f.startsWith('.')).forEach((f) => hidden.push(`pages/${f}`));
// A dotfile page used to become a route: dist/.scratch.html and dist/.scratch/index.html,
// reachable at /.scratch, with nothing printed. The nav is hand-written so it did not leak
// there, but the busybox container answers /.scratch/ with an index and is not hiding it.
const pages = pageFiles.filter((f) => f.endsWith('.html') && !f.startsWith('.'))
  .map((f) => f.slice(0, -'.html'.length));
if (hidden.length) warnings.push(`not content, not copied, no route: ${hidden.join(', ')}`);
// Without these the site is broken at / and every 404, and the checks below would stay green.
for (const required of ['index', '404'])
  if (!pages.includes(required)) problems.push(`src/pages/${required}.html is missing`);
const routes = new Set(pages);
const distFiles = new Set([...assets, 'styles.css', 'favicon.ico', ...pages.map((r) => `${r}.html`)]);
// /sead/ resolves to /sead/index.html in a server without rewrites; the checker has to
// agree that such a file will exist - and it has to know both spellings, because the
// directory form of every page links its siblings as /sead/. Register the file only and the
// first cross-page link inside a subpage fails the build against a file that does exist.
// index and 404 have no directory form (see the assemble loop), so do not claim one.
for (const r of routes) {
  if (r === 'index' || r === '404') continue;
  distFiles.add(`${r}/index.html`);
  distFiles.add(`${r}/`);
}

// ---------- assemble ----------
const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// replaceAll with a function: a string replacement would substitute only the first
// occurrence ({{title}} and {{description}} are each used twice in head.html) and would
// interpret $& / $1 appearing inside page text.
const fill = (name, vars) => Object.entries(vars).reduce(
  (html, [token, value]) => html.replaceAll(token, () => value), src(join('partials', name)));

// ---------- tag syntax, one definition for the whole build ----------
// An element runs from '<' + letter to the first '>' with no quote open, so a '>' written
// inside alt="a > b" does not end the tag - and attributes are matched from outside the
// values, so `src=x` inside a value or in text is text: it ships as text and no browser
// fetches it. A quote only opens after '=' (`title=it's` is a value and then prose, which is
// how a browser reads it too). The rewriter, the <picture> inserter, the <title> derivation and
// every check read the tag through this, which is what makes "a ref a check can see is a ref the
// build can move" true rather than a coincidence of two regexes agreeing. Two things still look
// at markup with a regex: the webp pass's own `<source>` insertion (it writes a tag, it does not
// read one) and the two lines that strip the canonical and rewrite og:url in our own 404 page,
// which assert afterwards that they matched.
// Elements whose content a browser does not parse as markup. Their body must not be counted as
// text (a `</div>` inside a <style> rule is not a closing div, and the same string can hide a
// real one), must not be scanned for attributes (`a[href="x"]` in CSS is not a ref the build
// should move), and must not reach the checks as a tag. <iframe> is deliberately absent: its
// fallback content holds refs that still have to exist.
const RAW_TEXT = /^(?:script|style|textarea|title|xmp|noembed|noframes)$/i;
const tagNameOf = (tag) => (tag.match(/^<([-\w]+)/) || [])[1] || '';   // elements() yields no closings
// Where a raw-text element's body ends: `</style >` counts, because a browser takes it. No
// closer at all means the browser really does read the rest of the document as that element's
// text - the span runs to EOF and says so, because otherwise every ref after it is neither
// moved nor checked, both sides of the tag count vanish together, and the build is green.
function rawTextEnd(html, end) {
  const close = new RegExp('</\\s*' + tagNameOf(html.slice(0, end)).toLowerCase() + '\\s*>', 'i').exec(html.slice(end));
  return close ? { end: end + close.index + close[0].length, unclosed: false }
    : { end: html.length, unclosed: true };
}

function* elements(html) {
  for (let i = -1; (i = html.indexOf('<', i + 1)) >= 0;) {
    if (!/[a-zA-Z]/.test(html[i + 1] ?? '')) continue;      // `< 5`, `</p>`, `<!` are not tags
    let j = i + 2, q = '', qPos = -1, afterEq = false;
    for (; j < html.length; j++) {
      const c = html[j];
      if (q) { if (c === q) { q = ''; afterEq = false; } }  // a '>' INSIDE a value is legal
      else if ((c === '"' || c === "'") && afterEq) { q = c; qPos = j; }
      else if (c === '>') break;
      else if (!/\s/.test(c)) afterEq = c === '=';
    }
    // tag INCLUDES its '>', and end is the index after it: mapTags splices a replacement for
    // the whole element, and a span that left the '>' out of the tag but past it in `end`
    // would delete it - which is how every rewritten element lost its closing bracket.
    const tagEnd = Math.min(j + 1, html.length);
    const rawText = !q && RAW_TEXT.test(tagNameOf(html.slice(i, tagEnd))) && !/\/>\s*$/.test(html.slice(i, tagEnd));
    // badQuote is the one thing that genuinely blinds this file: a quote with no closing
    // quote left in the document swallows every tag after it, so the refs behind it would be
    // neither rewritten nor checked - which is the silent 404, not a lint. It is reported, and
    // the page cannot ship. A '>' inside a closed value is ordinary markup and is not it.
    yield { start: i, end: tagEnd, tag: html.slice(i, tagEnd), badQuote: q ? qPos : -1 };
    if (rawText) {                       // the body is markup to nobody and text to nothing
      const { end, unclosed } = rawTextEnd(html.slice(i), tagEnd - i);
      yield { start: tagEnd, end: i + end, tag: html.slice(tagEnd, i + end), body: true, unclosed,
        name: tagNameOf(html.slice(i, tagEnd)).toLowerCase() };
      i = i + end - 1;
    } else i = tagEnd - 1;
  }
}

// name, the text around '=', the raw value token. A value is matched whole, so nothing inside
// one can read as an attribute name.
const attrPairs = (tag) => [...tag.matchAll(/([-\w]+)(?:\s*=\s*)("[^"]*"|'[^']*'|[^\s"'<>]+)/g)];
// One attribute of one tag, as a value rather than a match array: src and class are read by the
// webp pass, which used a double-quoted-only regex and so silently skipped every src='x.png'.
const attrOf = (tag, name) => {
  for (const m of attrPairs(tag)) if (m[1].toLowerCase() === name) return valueOf(m[2]);
  return null;
};
// The attributes whose value a browser fetches, matched by whole name. Not a suffix rule:
// `data-href` ends in `href` and is a hook for a script this site does not run, so a suffix rule
// rewrites it and then refuses the page for a ref nobody asks for. `data` is here because
// <object data="…"> is a fetch like any other and nothing else covers it - the one <object> in
// this site sits in a comment, so that is latent, and the file it points at is not in src/assets.
// One list, read by the rewriter and the checker, so adding a name here is the whole change.
const REF_NAMES = ['href', 'src', 'poster', 'srcset', 'data', 'data-src', 'data-srcset'];

const valueOf = (raw) => (/^['"]/.test(raw) ? raw.slice(1, -1) : raw);
// "a file we host, below this document". A scheme, a fragment, a query-only link (`?p=2`, which
// a browser resolves against the current page, not the root) and a protocol-relative URL are all
// somebody else's resource or the same page, and get no leading '/'.
const isRelative = (v) => v !== '' && !/^([a-zA-Z][\w+.-]*:|[?#\/])/.test(v);

// Rewrite the elements of a document in order; f(el) returns a replacement, or null to keep it.
const mapTags = (html, f) => {
  let out = '', last = 0;
  for (const el of elements(html)) {
    if (el.body) continue;                              // a body is preserved as-is
    const rep = f(el);
    if (rep !== null) { out += html.slice(last, el.start) + rep; last = el.end; }
  }
  return out + html.slice(last);
};

// What a browser reads as text: everything between the elements. Tag balance and the raw-`<`
// rule counted these with a regex over the document, which made `alt="see </p> below"` a
// "p unbalanced" refusal of valid markup, and let a raw `<` in copy pair with the wrong `>`.
// Everything between the elements. A raw-text element's body is inside its span, so it is left
// out here without a special case - `</div>` written in a <style> rule is neither a closing div
// nor anything a reader sees.
const textOf = (html) => {
  let out = '', last = 0;
  for (const el of elements(html)) { out += html.slice(last, el.start); last = el.end; }
  return out + html.slice(last);
};

// ---------- the only code that puts bytes into an attribute value ----------
// One attribute of one tag, located through the tokenizer and replaced in place, so a value that
// quotes markup (`title='use href="/past" to link'`) is never itself rewritten - three
// document-wide .replace calls did that until now, and shipped it. `absolute()` reads the same
// grammar every check reads, so it moves refs however they are written: unquoted, single-quoted,
// spaced `=`, uppercase, and every candidate of a srcset rather than only the first. That is why
// the checks do not need to refuse a syntax: there is no form they can see that this cannot move.
const setAttr = (h, name, f) => mapTags(h, ({ tag }) => {
  for (const m of attrPairs(tag)) {
    if (m[1].toLowerCase() !== name) continue;
    const raw = m[2], quote = /^['"]/.test(raw) ? raw[0] : '';
    const fixed = f(valueOf(raw));
    if (fixed === null) continue;                    // keep the element as it is
    const at = m.index + m[0].lastIndexOf(raw);      // where the value token starts
    return tag.slice(0, at) + quote + fixed + quote + tag.slice(at + raw.length);
  }
  return null;
});
// A browser trims a URL before resolving it, so the trimmed form is what must go into the
// value: `/ ` + an untrimmed value would ship `src="/ assets/x.png"`, which resolves nowhere.
const toRoot = (v) => `/${v.trim()}`;
const absolute = (h) => REF_NAMES.reduce((doc, name) => setAttr(doc, name, (value) => {
  if (name === 'srcset') {                           // every candidate, not just the first
    const cands = value.split(',').map((c) => c.trim()).filter(Boolean)
      .map((c) => { const [u, ...rest] = c.split(/\s+/); return [isRelative(u) ? toRoot(u) : u, ...rest].join(' '); });
    return cands.length && cands.join(', ') !== value ? cands.join(', ') : null;
  }
  return isRelative(value) ? toRoot(value) : null;
}), h);

// `node build.mjs --selftest` - the tokenizer and the rewriter have no other coverage: nothing
// in src/ hand-writes a srcset, a raw-text element or a single-quoted src, so a green build
// proves nothing about them. Assertions only over functions that read a string: no files yet.
if (process.argv.includes('--selftest')) {
  const t = (name, got, want) => {
    if (got !== want) { console.error(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); process.exitCode = 1; }
    else console.log(`  ok    ${name}`);
  };
  t('a > inside a value does not end the tag',
    [...elements('<img src="a.png" alt="a > b" width=1>')].map((e) => e.tag).join('|'),
    '<img src="a.png" alt="a > b" width=1>');
  t('src= inside a value is prose, not a ref',
    absolute(`<img src="a.png" alt="if src=x.png then" title='see src="b.png"'>`),
    `<img src="/a.png" alt="if src=x.png then" title='see src="b.png"'>`);
  t('every srcset candidate is moved',
    absolute('<img srcset="a.webp 1x, b.webp 2x">'), '<img srcset="/a.webp 1x, /b.webp 2x">');
  t('quotes, spacing, case and no-quotes all move',
    absolute(`<img SRC='a.png' poster = "b.png" srcset=c.webp>`), `<img SRC='/a.png' poster = "/b.png" srcset=/c.webp>`);
  t('a query-only or protocol-relative ref stays where it is',
    absolute('<a href="?p=2"></a><a href="//cdn/x.css"></a>'), '<a href="?p=2"></a><a href="//cdn/x.css"></a>');
  t('a raw-text body moves neither the tag counts nor the text',
    textOf('<style>a[href="x"]{content:"</div>"}</style><p>hi</p>').includes('</div>'), false);
  t('a raw-text tag keeps its own attributes',
    absolute('<script src="a.js"></script><p>text</p>'), '<script src="/a.js"></script><p>text</p>');
  t('an unclosed raw-text element is not swallowed silently',
    [...elements('<textarea placeholder="x<img src="a.png">')].filter((e) => e.body && e.unclosed).length, 1);
  console.log(process.exitCode ? 'SELFTEST FAILED' : 'selftest ok');
  process.exit(process.exitCode || 0);
}

const built = new Map();
// Which built pages are served from below the site root: the <route>/index.html copies (a
// container with no rewrite rules answers /sead/ from them) and 404.html, which nginx renders at
// the URL that failed. Derived from the built key instead of recorded by absolute(), because a
// Set filled by one call site and read by two others is how 404.html's srcset was once left
// relative while its src was not: forget the argument once and both the insert and the rule
// that would have refused it go blind together, silently.
const belowRoot = (name) => name === '404.html' || name.includes('/');
for (const route of pages) {
  // "/sead" -> "sead.html": relative links, so dist/ works from any root. Through setAttr,
  // because the document-wide regex this replaces rewrote `href="/past"` wherever those six
  // bytes appeared - in a title, in a <code> sample, in a <style> selector - and shipped it.
  const toFile = (h) => setAttr(h, 'href', (v) => {
    const m = /^\/([\w-]+)$/.exec(v);
    return m && routes.has(m[1]) ? `${m[1]}.html` : null;
  });
  const body = toFile(src(join('pages', `${route}.html`))).trim();

  // The <title> comes out of the first <h2>. Comments go first: a commented-out <h2> above the
  // real one used to win, and ship its text as the page title and the og:description. Then the
  // element walk, because /<h2[^>]*>/ ends at a '>' inside the heading's own attributes; and the
  // tags inside it are deleted by mapTags, the same walk textOf() uses - a raw
  // <[^>]*> ate `title="a > b"` and shipped ` b">` in the title.
  const uncommented = body.replace(/<!--[\s\S]*?-->/g, '');
  let h2End = -1;
  for (const el of elements(uncommented)) if (/^<h2\b/i.test(el.tag)) { h2End = el.end; break; }
  const h2Close = h2End < 0 ? -1 : uncommented.indexOf('</h2>', h2End);
  let text = h2Close < 0 ? '' : decode(
    mapTags(uncommented.slice(h2End, h2Close).replace(/<br\s*\/?>/gi, ' – '), () => '')
  ).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (!text) problems.push(`src/pages/${route}.html: no text in an <h2>, cannot derive <title>`);
  text ||= route;
  const isIndex = route === 'index';
  let html = (fill('head.html', {
    '{{title}}': esc(isIndex ? 'Humlab Showcase' : `${text} – Humlab Showcase`),
    '{{description}}': esc(isIndex ? SITE_DESC : `${text} – ${SITE_DESC}`),
    '{{ogUrl}}': isIndex ? `${ORIGIN}/` : `${ORIGIN}/${route}`,
    '{{origin}}': ORIGIN,
    '{{lang}}': SWEDISH.has(route) ? 'sv' : 'en',
    '{{route}}': route,
  }) + src('partials/header.html') + '\n' + body + '\n' + src('partials/footer.html'))
    .replace(/<!--[\s\S]*?-->/g, '');            // keep notes in the source, ship none
  if (route === '404') {
    // Served for whatever was requested, so relative refs would resolve against a
    // directory with nothing in it (/deep/typo -> /deep/styles.css), and a canonical
    // would point crawlers at a URL that answers 404.
    html = absolute(html)
      .replace(/<link rel="canonical"[^>]*>\n?/, '')
      .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${ORIGIN}/">`);
    // The two lines above are the build's last regexes over markup it does not own, and they
    // match our own head partial in one known order. If that order is ever changed they fail
    // silently - a canonical pointing at a URL that answers 404, an og:url pointing at /404 -
    // so check they did their job instead of trusting the shape.
    if (/<link[^>]*rel="canonical"/i.test(html)) problems.push('src/pages/404.html: a canonical survived into the 404 page');
    if (/og:url"[^>]*404|404[^>]*og:url/i.test(html)) problems.push('src/pages/404.html: og:url still points at the 404');
  }
  built.set(`${route}.html`, html);

  // The same page under /sead/index.html, so a server without rewrite rules (the busybox
  // container in deploy/) can answer the canonical /sead at all: it redirects /sead to
  // /sead/ on its own and serves the index. Refs must be root-absolute from there.
  // index.html is already at the root, and 404 has no meaningful directory form.
  if (route !== 'index' && route !== '404') {
    let dirForm = setAttr(setAttr(absolute(html), 'href', (v) =>          // and point at the
      v === '/index.html' ? '/' : null),                             // directory form too, so
      'href', (v) => {                                               // no server feature is
        const m = /^\/([\w-]+)\.html$/.exec(v);                       // needed to follow links.
        return m && routes.has(m[1]) ? `/${m[1]}/` : null;
      });
    built.set(`${route}/index.html`, dirForm);
  }
}

// ---------- webp ----------
// Every raster a page references gets a .webp beside it in dist/, and its <img> is wrapped
// in a <picture>: browsers that speak webp (everything since Safari 14, 2020) download
// about a third of the bytes, everyone else gets the png/jpeg they always got. No JS, and
// dist/ still opens from a directory listing.
//
// Generated at build time instead of committed, deliberately: when someone replaces
// assets/foo.png by hand and a stale .webp sits beside it in git, every current browser
// serves the old picture and the person who updated it sees the new one in their own
// file:// preview. cwebp comes from the `webp` package (apt install webp); without it the
// build ships exactly what it shipped before, with a warning.
const WEBP_MIN = 20 * 1024;   // below this the markup costs more than the bytes it saves
const WEBP_ARGS = ['-q', '80', '-m', '6', '-mt'];   // q80: measured All-PSNR 39.2-55 dB on
                                                    // the current 70 images, see README
const styles = src('styles.css');
const refs = new Set(([...built.values()].join(' ') + ' ' + styles).match(/assets\/[^\s"')?#]+/g) || []);
const fullTo = new Map();        // ref -> full-size .webp (project pages, og previews)
const tileTo = new Map();        // ref -> thumbnail .webp (front-page tiles)
const jobs = [];                 // cwebp runs: { from, to, args, thumb }
const counted = new Set();         // a shared source is two jobs but its bytes count once
let thumbCount = 0, cwebp = true;
try { execFileSync('cwebp', ['-version'], { stdio: 'ignore' }); } catch { cwebp = false; }

// A front-page tile paints its picture into a box at most ~252 CSS px wide, and did so with
// the 2830x1306 original: 18x the pixels the screen can show, ~4.7 MB downloaded for a grid
// of thumbnails. Tiles therefore get a variant capped at THUMB_EDGE on the long edge - >=3x
// that box, so it stays sharp on a 3x phone - and the <img> keeps pointing at the full
// raster, which is what a browser without webp gets, exactly as before.
const THUMB_EDGE = 768;

// PNG/JPEG size out of the header, because cwebp -resize upscales happily and the point of
// this is to never write pixels the source does not have. No dependency, no new tool.
function dimsOf(file) {
  const fd = openSync(file, 'r'), b = Buffer.alloc(64 * 1024);
  let n = 0;
  try { n = readSync(fd, b, 0, b.length, 0); } finally { closeSync(fd); }
  if (n > 24 && b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (n > 8 && b[0] === 0xff && b[1] === 0xd8)
    for (let i = 2; i + 9 < n; ) {
      if (b[i] !== 0xff) break;
      const m = b[i + 1];
      if (m === 0xff || m === 0x01 || (m >= 0xd0 && m <= 0xd9)) { i += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  return null;
}

if (cwebp) {
  // Only pictures an <img> actually draws, and whether *only* tiles draw them: `refs` also
  // contains the og:image and the <video poster>, and a .webp beside those is dead weight no
  // browser can ask for (they are requested by URL by the share-preview crawler and by the
  // player, neither of which reads a <picture>), plus it skews the PSNR line below.
  const drawn = new Map();
  for (const html of built.values())
    for (const { tag } of elements(html)) {
      if (!/^<img\b/i.test(tag)) continue;
      const srcAttr = attrOf(tag, 'src');
      if (!srcAttr) continue;
      const ref = join(srcAttr.trim().replace(/^\//, '').split('?')[0]);   // as the checker reads it
      // .screenshot-cover marks the tile pictures and nothing else in this site. A picture
      // can be drawn both ways - the tile thumbnail and the full screenshot on its own page -
      // and then it needs both variants, because the choice belongs to the <img>, not the file.
      const tile = /\bscreenshot-cover\b/.test(attrOf(tag, 'class') || '');
      const seen = drawn.get(ref) || { tile: false, page: false };
      drawn.set(ref, { tile: seen.tile || tile, page: seen.page || !tile });
    }
  for (const ref of refs) {
    const how = drawn.get(ref);
    if (!how || !/\.(png|jpe?g)$/i.test(ref)) continue;
    const file = join(SRC, ref);
    if (!existsSync(file) || statSync(file).size < WEBP_MIN) continue;
    const d = how.tile ? dimsOf(file) : null;
    const long = d ? Math.max(d.w, d.h) : 0;
    if (how.page) {
      jobs.push({ from: file, to: `${ref}.webp`, args: WEBP_ARGS });
      fullTo.set(ref, `${ref}.webp`);
      distFiles.add(`${ref}.webp`);
    }
    if (!how.tile) continue;
    if (long <= THUMB_EDGE) {
      // Already small enough to be a thumbnail: one .webp serves both uses. When no page
      // asked for it, that file still has to be encoded - pointing srcset at a .webp that
      // nothing wrote is a broken image, which is exactly what the build's own check said.
      if (fullTo.has(ref)) { tileTo.set(ref, fullTo.get(ref)); continue; }
      jobs.push({ from: file, to: `${ref}.webp`, args: WEBP_ARGS });
      fullTo.set(ref, `${ref}.webp`);
      tileTo.set(ref, `${ref}.webp`);
      distFiles.add(`${ref}.webp`);
      continue;
    }
    const k = THUMB_EDGE / long, to = `${ref}.thumb.webp`;
    jobs.push({ from: file, to, thumb: true, args: [...WEBP_ARGS, '-resize',
              String(Math.round(d.w * k)), String(Math.round(d.h * k))] });
    tileTo.set(ref, to);
    distFiles.add(to);              // srcset refs validate like any ref
    thumbCount++;
  }
  for (const [name, html] of built) {
    // mapTags, not /<img\b[^>]*>/gi: that regex ended a tag at the first '>', so a '>' inside
    // alt="a > b" matched only `<img src="x.png" alt="a ` - and this wrapped the fragment,
    // shipping a </picture> inserted inside an open tag.
    built.set(name, mapTags(html, ({ tag }) => {
      if (!/^<img\b/i.test(tag)) return null;
      const srcAttr = attrOf(tag, 'src');
      if (!srcAttr) return null;                    // null = keep the element as it is
      // join(), so that `./x.png` finds its .webp: keyed on the raw value it missed, and an
      // <img> that misses the map ships the PNG with no complaint - 4x the bytes, green build.
      const ref = join(srcAttr.trim().replace(/^\//, '').split('?')[0]);
      // Tiles ask for their thumbnail even when the same file also has a full-size .webp
      // for the project page: 4.7 MB of the front page's weight was that mix-up.
      const to = (/\bscreenshot-cover\b/.test(attrOf(tag, 'class') || '') ? tileTo : fullTo).get(ref);
      if (!to) return null;
      // Every page below the site root had its hrefs and srcs rewritten to root-absolute paths
      // before this loop runs - the directory-form copies a container serves at /sead/,
      // and 404.html, which nginx renders at the URL that failed (/deep/typo), so nothing
      // relative can resolve there. A srcset inserted after that pass has to match: a
      // relative one 404s, and a failed <source> does NOT fall back to the <img> beside
      // it, the picture is simply gone. Live proof: /visp/ showed 2 of 9 images, and every
      // multi-segment 404 lost its header and footer logos.
      const abs = belowRoot(name) ? '/' : '';
      return `<picture><source type="image/webp" srcset="${abs}${to}">${tag}</picture>`;
    }));
  }
}

// ---------- checks ----------
const attrRefs = (tag) =>
  // srcset holds a comma list of "url 2x" pairs; <image> is a legacy alias of <img>.
  attrPairs(tag).filter(([, name]) => REF_NAMES.includes(name.toLowerCase())).flatMap(([, name, raw]) => {
    const value = valueOf(raw);
    return /^srcset$/i.test(name) && value !== ''
      ? value.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean)
      : [value];
  });

function* scan(where, html) {
  // <image> is the legacy name of <img> in HTML and needs the alt/size checks; inside <svg> it
  // is a different element that takes no alt, so leave it alone there. Tag-scoped, not a
  // document-wide replace: prose quoting `<image src=x>` became a real img and failed as one.
  if (!/<svg[\s>]/i.test(html)) {
    html = mapTags(html, ({ tag }) => (/^<image(?=[\s>])/i.test(tag) ? '<img' + tag.slice(6) : null));
  }
  // There is no "form the build cannot parse" any more: absolute() reads this exact grammar,
  // so every ref a check can see is one the rewriter saw too, and a relative ref left in a
  // page served below the site root is a bug in this file - the belowRoot rule below is what
  // notices. What HTML itself does not forgive is named here, where it still can be.
  // One tokenization, five readers: refs, shape, sizes, balance and the check below.
  const els = [...elements(html)];
  // A quote that opened by accident swallows the markup after it, and the browser agrees with the
  // parse: a swallowed `<img src=…>` is not an element, so it is silently never fetched and the
  // page ships a hole. That damage is what to look for, not the `</` itself - a value may hold a
  // closing tag on purpose (`alt="Type </div> to close"`, a JSON blob in data-*), which is valid
  // HTML, and refusing it was tried and wrong.
  let trapped;
  for (const el of els) {
    if (el.body || el.badQuote >= 0) continue;
    // Anything that would fetch or navigate if it were really an element. `script` is absent on
    // purpose: this site ships no script and CSP refuses it, so a swallowed one costs nothing.
    trapped = attrPairs(el.tag).find(([v]) =>
      /<(?:a|img|source|video|audio|iframe|object|embed|link|track)\b[^>]*\b(?:href|src|srcset|poster|data)\s*=/i.test(v));
    if (trapped) break;
  }
  if (trapped) {
    yield `${where}: a fetching element is trapped inside ${trapped[1].replace(/\s+/g, ' ').slice(0, 58)}…`
      + ` - a quote opened where you did not intend one, and a browser fetches none of it`;
  }
  // Tag counts describe a document that was not parsed as written. The per-element checks below
  // stand down only for the element whose own quote broke, not for the page: a page-wide
  // stand-down was tried first and it hid `<img> without alt` and the target=_blank rule behind an
  // unrelated error.
  const markupSwallowed = !!trapped || els.some((el) => el.body && el.unclosed);
  for (const el of els) {
    const tag = el.tag;
    if (el.body) {
      // A raw-text element with no closing tag swallows the rest of the document: every ref
      // after it is neither moved nor checked, which is the silent 404, so it cannot pass.
      if (el.unclosed) yield `${where}: <${el.name}> is never closed: a browser reads the rest of `
        + `the document as its text, so no ref after it is checked`;
      continue;                                        // a body holds text, not refs
    }
    if (el.badQuote >= 0) {
      yield `${where}: attribute quote never closes (line ${html.slice(0, el.badQuote).split('\n').length}) `
        + `in ${tag.slice(0, 70)} - a browser reads the markup after it as part of that value`;
      continue;                                        // one error, not twenty false ones
    }
    for (const rawRef of attrRefs(tag)) {
      const attr = /srcset/i.test(tag) ? 'srcset' : 'link';
      const ref = rawRef.trim();                       // a browser trims; ` src=" x.png"` works
      if (ref === '') { yield `${where}: empty src/href`; continue; }
      if (/^http:\/\/https?:/.test(ref)) { yield `${where}: malformed link ${ref}`; continue; }
      if (/^https?:\/\/[/"]?$/i.test(ref)) { yield `${where}: link with a scheme and no host: "${ref}"`; continue; }
      // Any scheme is somebody else's resource, and isRelative() is what says so - the same
      // predicate absolute() uses, so a geo:, ftp: or urn: link cannot be diagnosed as a
      // relative file below the site root (it was, which is a wrong answer about a working
      // link). http: is the one scheme with a rule of its own.
      if (/^https?:\/\//i.test(ref)) {
        if (/^http:\/\//i.test(ref)) {           // https is fine; the plain-http rule is the reason
          let host = '';
          try { host = new URL(ref).hostname; } catch { yield `${where}: unparseable link ${ref}`; continue; }
          if (!httpAllowed(host)) yield `${where}: plain http link ${ref}`;
        }
        continue;
      }
      // One test, case-insensitive, for every other scheme - mailto:, tel:, sms:, data:, geo:,
      // ftp:, urn:, and the ones not invented yet. A scheme is not our file to check; the
      // allow-list this replaced reported `geo:63.82,20.26` as a relative ref below the site
      // root, which is a wrong answer about a link that works.
      if (/^[a-zA-Z][\w+.-]*:/i.test(ref) || ref.startsWith('#') || ref.startsWith('?')
        || ref.startsWith('//')) continue;   // query-only and protocol-relative: not a file
      if (ref.startsWith('/')) {
        // join(), as the relative branch below already does: `href="./x"` in a page served at
        // /sead/ resolves to /sead/x and exists, and a literal `.` segment was refused as a
        // missing file.
        const raw = ref.split('#')[0].split('?')[0].slice(1);
        const clean = raw === '' ? '' : join(raw);        // join('') is '.', and href="/" is fine
        if (clean && !distFiles.has(clean)) yield `${where}: missing ${attr} "${ref}"`;
        continue;
      }
      const clean = join(ref.split('#')[0].split('?')[0]).replace(/^\.\//, '');
      if (belowRoot(where)) {
        // Nothing relative survives in a page served below the site root - a directory form,
        // or the 404 rendered at the failing URL. absolute() covers both, so a relative ref
        // here is one inserted after that pass: the bug behind /visp/ and the 404 logos.
        yield `${where}: relative ${attr} "${ref}" in a page served below the site root (would resolve against /${where.replace(/[^/]*$/, '')})`;
        continue;
      }
      if (!distFiles.has(clean)) yield `${where}: missing ${attr} "${ref}"`;
    }
  }
  for (const { tag, body, badQuote } of els) {
    if (body || badQuote >= 0) continue;
    // A '"' that does not follow '=' closed the previous value, so an attribute name
    // right after it has no separating space. Values (viewport meta, font query
    // strings) must not be scanned for these.
    if (/(?<!=)"(?:href|src|alt|class|rel|title|target|width|height)\s*=/.test(tag))
      yield `${where}: attribute glued to the previous value in ${tag.slice(0, 70)}`;
    // Both quote styles, or a value that quotes a ref in prose (`title='see src="a.png"'`)
    // reads as a second src attribute and the page is refused for markup it does not have.
    const names = [...tag.replace(/=(?:"[^"]*"|'[^']*')/g, '=""').matchAll(/([a-zA-Z-]+)=/g)].map((m) => m[1].toLowerCase());
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    if (dup.length) yield `${where}: duplicate ${dup[0]} attribute in ${tag.slice(0, 70)}`;
    if (/^<img\b/i.test(tag)) {
      if (attrOf(tag, 'alt') === null) yield `${where}: <img> without alt: ${tag.slice(0, 70)}`;
      if (attrOf(tag, 'width') === null) unsized.push(attrOf(tag, 'src') || tag.slice(0, 50));
    }
    // attrOf, not /target="_blank"/: written single-quoted, the regex missed it and a link
    // opened for reverse tabnabbing with the build green. Same blind spot the refs had.
    if ((attrOf(tag, 'target') || '').toLowerCase() === '_blank'
      && !/\bnoopener/i.test(attrOf(tag, 'rel') || ''))
      yield `${where}: target=_blank without rel=noopener: ${tag.slice(0, 70)}`;
  }
  // Both of these read the text a browser sees, not the document as a string: a value holding
  // `</p>` used to be counted as a closing tag (refusing valid markup), and a `<` written in an
  // attribute value paired with a `>` somewhere else and vanished.
  // It still cannot catch `a<b and c>`: that is a syntactically valid tag as far as HTML is
  // concerned, and no amount of checking here will tell it apart from one.
  const text = textOf(html);
  const stripped = text.replace(/&[a-zA-Z#0-9]+;/g, '');
  const stray = stripped.match(/<[^>]*$/m);
  if (stray) yield `${where}: raw "<" in text (use &lt;): "${stripped.slice(Math.max(0, stray.index - 25), stray.index + 25).trim()}"`;

  // openings from the elements the tokenizer found, closings from the text between them: neither
  // can be faked by markup written inside an attribute value or inside a <style> rule.
  const opened = {};
  for (const { tag, body } of els) {
    const name = tagNameOf(tag).toLowerCase();
    if (name && !body) opened[name] = (opened[name] || 0) + 1;
  }
  // A tag that opens inside an attribute value is not an opening tag, and the browser agrees, so
  // an unbalanced count with a `<` sitting in some value is almost always a forgotten quote rather
  // than a forgotten `</div>`. A hint, not a refusal: `title="6 < 7"` is legal and unremarkable.
  // No whitespace-skipping after the `<`: `< b` in `alt="a < b"` is not a tag start for a
  // browser either, and a hint pointing at a cause that cannot have happened is worse than none.
  const valueHoldsTag = els.some((el) => !el.body && attrPairs(el.tag).some(([v]) => /<[a-zA-Z/]/.test(v)));
  const quoteHint = valueHoldsTag ? ' (an attribute value holds a "<": if a quote opened by accident, everything after it is text)' : '';
  for (const tag of markupSwallowed ? [] : NEEDS_CLOSING) {
    const open = opened[tag] || 0;
    const close = (text.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (open !== close) yield `${where}: <${tag}> unbalanced (${open} open / ${close} closed)${quoteHint}`;
  }
}

for (const [where, html] of built) for (const problem of scan(where, html)) problems.push(problem);

for (const [, url] of styles.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
  if (/^(https?:|data:)/.test(url)) continue;
  if (!assets.includes(url.replace(/^\.\//, ''))) problems.push(`src/styles.css: url(${url}) is not in src/assets`);
}
for (const [, img] of src('partials/head.html').matchAll(/property="og:image" content="([^"]+)"/g)) {
  if (!assets.includes(img.replace('{{origin}}', ORIGIN).replace(`${ORIGIN}/`, ''))) problems.push(`src/partials/head.html: og:image ${img} is not in src/assets`);
}

for (const a of assets) {
  if (refs.has(a)) continue;
  warnings.push(`unused asset (${Math.round(statSync(join(SRC, a)).size / 1024)} kB): ${a}`);
}
for (const [where, html] of built)
  for (const text of PLACEHOLDERS) if (html.includes(text)) warnings.push(`${where}: unfinished copy ("${text}")`);

// One line, not one per image: the front-page tiles (inside a fixed 240px box) and the
// header/footer logos (constrained by max-height) are unsized on purpose — width/height
// attributes on those fight the CSS that sizes them. Anything new that shows up here is
// a content image that should carry its dimensions.
const unsizedFiles = [...new Set(unsized.map((u) => u.replace(/^\//, '')))];
if (unsizedFiles.length)
  warnings.push(`${unsizedFiles.length} images without width/height, e.g. ${unsizedFiles.slice(0, 3).join(', ')}`);

// ---------- report, then write only when clean ----------
console.log(`${pages.length} pages, ${assets.length} assets`);
for (const w of new Set(warnings)) console.log(`  warn  ${w}`);
for (const p of problems) console.log(`  FAIL  ${p}`);
if (problems.length) { console.log(`\n${problems.length} problem(s); dist/ not written.`); process.exit(1); }

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets'), { recursive: true });
cpSync(join(SRC, 'styles.css'), join(OUT, 'styles.css'));
cpSync(join(SRC, 'favicon.ico'), join(OUT, 'favicon.ico'));
cpSync(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true, filter: (from) => !basename(from).startsWith('.') });
let webpFailed = 0, webpFrom = 0, webpTo = 0, worst = [999, ''];
for (const j of jobs) {
  const from = j.from, out = j.to, to = join(OUT, out);
  mkdirSync(dirname(to), { recursive: true });
  // cwebp writes its whole per-file report (including the PSNR we want) to stderr, and it is
  // 15 lines per image, so both streams go into a pipe here rather than onto the terminal.
  const r = spawnSync('cwebp', [...j.args, from, '-o', to], { encoding: 'utf8' });   // j.args: a thumb adds -resize
  const m = `${r.stdout}${r.stderr}`.match(
    /Output:\s+(\d+) bytes\s+Y-U-V-All-PSNR\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+([\d.]+)/);
  if (r.status !== 0 || !existsSync(to)) {
    webpFailed++;
    console.log(`  FAIL  cwebp could not encode ${out}: ${(r.stderr || `exit ${r.status}`).trim().split('\n').pop()}`);
    rmSync(to, { force: true });           // a truncated file would be picked over the png
    continue;
  }
  if (!counted.has(from)) { counted.add(from); webpFrom += statSync(from).size; }   // shared source = 2 jobs, 1 set of bytes
  webpTo += m ? Number(m[1]) : statSync(to).size;
  if (m && Number(m[2]) < worst[0]) worst = [Number(m[2]), out];
}
if (webpFailed) { console.log(`\n${webpFailed} webp encode failure(s); dist/ is incomplete.`); process.exit(1); }
if (jobs.length)
  console.log(`  webp  ${jobs.length} images${thumbCount ? `, ${thumbCount} of them resized to <=${THUMB_EDGE}px for the tiles` : ''}: `
    + `${(webpFrom / 1048576).toFixed(1)} MB -> ${(webpTo / 1048576).toFixed(1)} MB, lowest All-PSNR ${worst[0]} dB (${worst[1]})`);
else if (!cwebp) console.log('  webp  cwebp not installed, shipping png/jpeg only (apt install webp)');

for (const [name, html] of built) {
  mkdirSync(dirname(join(OUT, name)), { recursive: true });   // <route>/index.html variants
  write(join(OUT, name), html);
}
