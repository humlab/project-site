// Humlab Showcase build: partials + page fragments -> static HTML in dist/.
// No dependencies, no framework, no client-side JS. Run: node build.mjs
//
// Pages are assembled and validated in memory, so a failing check leaves the
// previously built dist/ untouched on disk. The one exception is the webp encode step: it
// runs after the checks and before the pages are written, so if cwebp dies halfway you get
// an assets-only dist/ and a non-zero exit. Nothing is published on an exit code of 1.
import { readFileSync as read, writeFileSync as write, mkdirSync, rmSync, cpSync, readdirSync, statSync, existsSync } from 'node:fs';
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
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    entry.isDirectory() ? walk(p) : assets.push(p.slice(SRC.length + 1));
  }
})(join(SRC, 'assets'));

const pages = readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -'.html'.length));
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

const built = new Map();
for (const route of pages) {
  const body = src(join('pages', `${route}.html`))
    // "/sead" -> "sead.html": relative links, so dist/ works from any root
    .replace(/href="\/([\w-]+)"/g, (m, r) => (routes.has(r) ? `href="${r}.html"` : m))
    .trim();

  const heading = body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  if (!heading) problems.push(`src/pages/${route}.html: no <h2>, cannot derive <title>`);
  const text = heading
    ? decode(heading[1].replace(/<br\s*\/?>/gi, ' – ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
    : route;
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
  // A 404 is rendered for the requested URL, so relative refs would resolve against a
  // directory that has no files in it (/deep/typo -> /deep/styles.css).
  // Root-absolute refs, for pages that are not served from the site root.
  const absolute = (h) => h
    .replace(/\b(src|href|poster|data-src)="(?!\/|#|[a-zA-Z]+:)/g, '$1="/')
    .replace(/\bsrcset="(?!\/|#|[a-zA-Z]+:)/g, 'srcset="/');

  if (route === '404') {
    // Served for whatever was requested, so relative refs would resolve against a
    // directory with nothing in it (/deep/typo -> /deep/styles.css), and a canonical
    // would point crawlers at a URL that answers 404.
    html = absolute(html)
      .replace(/<link rel="canonical"[^>]*>\n?/, '')
      .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${ORIGIN}/">`);
  }
  built.set(`${route}.html`, html);

  // The same page under /sead/index.html, so a server without rewrite rules (the busybox
  // container in deploy/) can answer the canonical /sead at all: it redirects /sead to
  // /sead/ on its own and serves the index. Refs must be root-absolute from there.
  // index.html is already at the root, and 404 has no meaningful directory form.
  if (route !== 'index' && route !== '404') {
    let dirForm = absolute(html)
      // point at the directory form too, so no server feature is needed to follow links.
      // index first: it has no /index/ directory, it is the root document.
      .replace(/href="\/index\.html"/g, 'href="/"')
      .replace(/href="\/([\w-]+)\.html"/g, (m, r) => (routes.has(r) ? `href="/${r}/"` : m));
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
const webp = new Map();
let cwebp = true;
try { execFileSync('cwebp', ['-version'], { stdio: 'ignore' }); } catch { cwebp = false; }
if (cwebp) {
  // Only pictures an <img> actually draws: `refs` also contains the og:image and the
  // <video poster>, and a .webp beside those is dead weight no browser can ask for (they
  // are requested by URL by the share-preview crawler and by the player, neither of which
  // reads a <picture>), plus it skews the PSNR line the build reports.
  const drawn = new Set();
  for (const html of built.values())
    for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
      const m = tag[0].match(/\bsrc="([^"]+)"/i);
      if (m) drawn.add(m[1].replace(/^\//, ''));
    }
  for (const ref of refs) {
    if (!drawn.has(ref)) continue;
    if (!/\.(png|jpe?g)$/i.test(ref)) continue;
    const file = join(SRC, ref);
    if (!existsSync(file) || statSync(file).size < WEBP_MIN) continue;
    webp.set(ref, `${ref}.webp`);
    distFiles.add(`${ref}.webp`);        // so the srcset refs below validate like any ref
  }
  for (const [name, html] of built) {
    built.set(name, html.replace(/<img\b[^>]*>/gi, (tag) => {
      const m = tag.match(/\bsrc="([^"]+)"/i);
      if (!m || !webp.has(m[1].replace(/^\//, ''))) return tag;
      return `<picture><source type="image/webp" srcset="${m[1]}.webp">${tag}</picture>`;
    }));
  }
}

// ---------- checks ----------
const attrRefs = (tag) =>
  // srcset holds a comma list of "url 2x" pairs; <image> is a legacy alias of <img>.
  [...tag.matchAll(/\b(?:href|src|poster|data-src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+))/gi)]
    .map((m) => m[1] ?? m[2] ?? m[3] ?? '')
    .concat([...tag.matchAll(/\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
      .flatMap((m) => (m[1] ?? m[2]).split(',').map((part) => part.trim().split(/\s+/)[0])));

function* scan(where, html) {
  html = html.replace(/<image(?=[\s>])/gi, '<img');
  for (const [tag] of html.matchAll(/<[a-zA-Z][^>]*>/g)) {
    for (const ref of attrRefs(tag)) {
      const attr = /srcset/i.test(tag) ? 'srcset' : 'link';
      if (ref === '') { yield `${where}: empty src/href`; continue; }
      if (/^http:\/\/https?:/.test(ref)) { yield `${where}: malformed link ${ref}`; continue; }
      if (/^https?:\/\/[/"]?$/i.test(ref)) { yield `${where}: link with a scheme and no host: "${ref}"`; continue; }
      if (/^(https?:|mailto:|data:|#|\/)/.test(ref)) {
        if (/^http:\/\//.test(ref)) {
          let host = '';
          try { host = new URL(ref).hostname; } catch { yield `${where}: unparseable link ${ref}`; continue; }
          if (!httpAllowed(host)) yield `${where}: plain http link ${ref}`;
        }
        if (ref.startsWith('/')) {
          const clean = ref.split('#')[0].split('?')[0].slice(1);
          if (clean && !distFiles.has(clean)) yield `${where}: missing ${attr} "${ref}"`;
        }
        continue;
      }
      const clean = join(ref.split('#')[0].split('?')[0]).replace(/^\.\//, '');
      if (!distFiles.has(clean)) yield `${where}: missing ${attr} "${ref}"`;
    }
  }
  for (const [tag] of html.matchAll(/<[a-zA-Z][^>]*>/g)) {
    // A '"' that does not follow '=' closed the previous value, so an attribute name
    // right after it has no separating space. Values (viewport meta, font query
    // strings) must not be scanned for these.
    if (/(?<!=)"(?:href|src|alt|class|rel|title|target|width|height)\s*=/.test(tag))
      yield `${where}: attribute glued to the previous value in ${tag.slice(0, 70)}`;
    const names = [...tag.replace(/="[^"]*"/g, '=""').matchAll(/([a-zA-Z-]+)=/g)].map((m) => m[1].toLowerCase());
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    if (dup.length) yield `${where}: duplicate ${dup[0]} attribute in ${tag.slice(0, 70)}`;
    if (/^<img\b/i.test(tag)) {
      if (!/\balt=/i.test(tag)) yield `${where}: <img> without alt: ${tag.slice(0, 70)}`;
      if (!/\bwidth=/i.test(tag)) unsized.push((tag.match(/src="([^"]*)"/i) || [])[1] || tag.slice(0, 50));
    }
    if (/target="_blank"/i.test(tag) && !/rel="[^"]*noopener/i.test(tag))
      yield `${where}: target=_blank without rel=noopener: ${tag.slice(0, 70)}`;
  }
  // A lone '<' in copy (x < 5, <3) is markup the browser will reinterpret; copy must say
  // &lt;. It cannot catch `a<b and c>`: that is a syntactically valid tag as far as HTML
  // is concerned, and no amount of checking here will tell it apart from one.
  const stripped = html.replace(/<[^>]*>/g, '').replace(/&[a-zA-Z#0-9]+;/g, '');
  const stray = stripped.match(/<[^>]*$/m);
  if (stray) yield `${where}: raw "<" in text (use &lt;): "${stripped.slice(Math.max(0, stray.index - 25), stray.index + 25).trim()}"`;

  for (const tag of NEEDS_CLOSING) {
    const open = (html.match(new RegExp(`<${tag}(?=[\\s>])`, 'gi')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (open !== close) yield `${where}: <${tag}> unbalanced (${open} open / ${close} closed)`;
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
  if (basename(a).startsWith('.') || refs.has(a)) continue;
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
cpSync(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true });
let webpFailed = 0, webpFrom = 0, webpTo = 0, worst = [999, ''];
for (const [ref, out] of webp) {
  const from = join(SRC, ref), to = join(OUT, out);
  mkdirSync(dirname(to), { recursive: true });
  // cwebp writes its whole per-file report (including the PSNR we want) to stderr, and it is
  // 15 lines per image, so both streams go into a pipe here rather than onto the terminal.
  const r = spawnSync('cwebp', [...WEBP_ARGS, from, '-o', to], { encoding: 'utf8' });
  const m = `${r.stdout}${r.stderr}`.match(
    /Output:\s+(\d+) bytes\s+Y-U-V-All-PSNR\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+([\d.]+)/);
  if (r.status !== 0 || !existsSync(to)) {
    webpFailed++;
    console.log(`  FAIL  cwebp could not encode ${ref}: ${(r.stderr || `exit ${r.status}`).trim().split('\n').pop()}`);
    rmSync(to, { force: true });           // a truncated file would be picked over the png
    continue;
  }
  webpFrom += statSync(from).size;
  webpTo += m ? Number(m[1]) : statSync(to).size;
  if (m && Number(m[2]) < worst[0]) worst = [Number(m[2]), ref];
}
if (webpFailed) { console.log(`\n${webpFailed} webp encode failure(s); dist/ is incomplete.`); process.exit(1); }
if (webp.size)
  console.log(`  webp  ${webp.size} images: ${(webpFrom / 1048576).toFixed(1)} MB -> ${(webpTo / 1048576).toFixed(1)} MB, lowest All-PSNR ${worst[0]} dB (${worst[1]})`);
else if (!cwebp) console.log('  webp  cwebp not installed, shipping png/jpeg only (apt install webp)');

for (const [name, html] of built) {
  mkdirSync(dirname(join(OUT, name)), { recursive: true });   // <route>/index.html variants
  write(join(OUT, name), html);
}
