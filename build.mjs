// Humlab Showcase build: partials + page fragments -> static HTML in dist/.
// No dependencies, no framework, no client-side JS. Run: node build.mjs
//
// Pages are assembled and validated in memory, so a failing check leaves the
// previously built dist/ untouched on disk.
import { readFileSync as read, writeFileSync as write, mkdirSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const SRC = 'src', OUT = 'dist';
const ORIGIN = 'https://showcase.humlab.umu.se';
const SITE_DESC = "Humlab at Umeå University's showcase of projects that are ongoing and have been completed.";
const PLACEHOLDERS = ['Insert text here', 'Image text', 'Add names of', 'Lorem ipsum'];
// Tags that must balance; used to catch markup a browser would otherwise repair silently.
const NEEDS_CLOSING = ['div', 'section', 'main', 'p', 'ul', 'li', 'a', 'table', 'tr', 'td', 'video', 'iframe'];
// Hosts that answer on http but have no working TLS; every other link must be https.
const HTTP_ONLY = ['enida.humlab.umu.se', 'staden.humlab.umu.se', 'yrkesrum.humlab.umu.se',
  'ships.ddb.umu.se', 'digitalhumanities.lv'];
const httpAllowed = (host) => HTTP_ONLY.some((h) => host === h || host.endsWith(`.${h}`));

const problems = [], warnings = [];
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
const routes = new Set(pages);
const distFiles = new Set([...assets, 'styles.css', 'favicon.ico', ...pages.map((r) => `${r}.html`)]);

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
    .replace(/<!--[\s\S]*?-->/g, '')            // keep notes in the source, ship none
    // "/sead" -> "sead.html": relative links, so dist/ works from any root
    .replace(/href="\/([\w-]+)"/g, (m, r) => (routes.has(r) ? `href="${r}.html"` : m))
    .trim();

  const heading = body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  if (!heading) problems.push(`src/pages/${route}.html: no <h2>, cannot derive <title>`);
  const text = heading
    ? decode(heading[1].replace(/<br\s*\/?>/gi, ' – ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
    : route;
  const isIndex = route === 'index';
  const html = fill('head.html', {
    '{{title}}': esc(isIndex ? 'Humlab Showcase' : `${text} – Humlab Showcase`),
    '{{description}}': esc(isIndex ? SITE_DESC : `${text} – ${SITE_DESC}`),
    '{{ogUrl}}': isIndex ? `${ORIGIN}/` : `${ORIGIN}/${route}`,
    '{{route}}': route,
  }) + src('partials/header.html') + '\n' + body + '\n' + src('partials/footer.html');
  built.set(`${route}.html`, html);
}

// ---------- checks ----------
function* scan(where, html) {
  for (const [, attr, ref] of html.matchAll(/(src|href)\s*=\s*"([^"]*)"/g)) {
    if (ref === '') { yield `${where}: empty ${attr}`; continue; }
    if (/^http:\/\/https?:/.test(ref)) { yield `${where}: malformed link ${ref}`; continue; }
    if (/^(https?:|mailto:|data:|#)/.test(ref)) {
      if (/^http:\/\//.test(ref) && !httpAllowed(new URL(ref).hostname))
        yield `${where}: plain http link ${ref}`;
      continue;
    }
    const clean = join(ref.split('#')[0].split('?')[0]).replace(/^\.\//, '');
    if (!distFiles.has(clean)) yield `${where}: missing ${attr} "${ref}"`;
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
      if (!/\bwidth=/i.test(tag))
        warnings.push(`<img> without width/height: ${(tag.match(/src="([^"]*)"/i) || [])[1] || tag.slice(0, 50)}`);
    }
    if (/target="_blank"/i.test(tag) && !/rel="[^"]*noopener/i.test(tag))
      yield `${where}: target=_blank without rel=noopener: ${tag.slice(0, 70)}`;
  }
  for (const tag of NEEDS_CLOSING) {
    const open = (html.match(new RegExp(`<${tag}(?=[\\s>])`, 'gi')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (open !== close) yield `${where}: <${tag}> unbalanced (${open} open / ${close} closed)`;
  }
}

for (const [where, html] of built) for (const problem of scan(where, html)) problems.push(problem);

const styles = src('styles.css');
for (const [, url] of styles.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
  if (/^(https?:|data:)/.test(url)) continue;
  if (!assets.includes(url.replace(/^\.\//, ''))) problems.push(`src/styles.css: url(${url}) is not in src/assets`);
}
for (const [, img] of src('partials/head.html').matchAll(/property="og:image" content="([^"]+)"/g)) {
  if (!assets.includes(img.replace(`${ORIGIN}/`, ''))) problems.push(`src/partials/head.html: og:image ${img} is not in src/assets`);
}

const refs = new Set(([...built.values()].join(' ') + ' ' + styles).match(/assets\/[^\s"')?#]+/g) || []);
for (const a of assets) {
  if (basename(a).startsWith('.') || refs.has(a)) continue;
  warnings.push(`unused asset (${Math.round(statSync(join(SRC, a)).size / 1024)} kB): ${a}`);
}
for (const [where, html] of built)
  for (const text of PLACEHOLDERS) if (html.includes(text)) warnings.push(`${where}: unfinished copy ("${text}")`);

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
for (const [name, html] of built) write(join(OUT, name), html);
