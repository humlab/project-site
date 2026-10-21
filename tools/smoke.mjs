// Loads every built page in headless Chromium and reports console errors, failed
// requests, non-200 responses, CSP violations and broken geometry.
//
// Dev-only: needs playwright, which is deliberately NOT a project dependency:
//   npm i -D playwright && playwright install chromium
//
//   node build.mjs
//   <start nginx with this repo's server block, see README>
//   node tools/smoke.mjs http://127.0.0.1:8099
//
// Run it against nginx (see README) rather than a bare static server: the CSP, the
// canonical rewrites and the cache headers only exist there, so a plain server can only
// prove the pages load.
import { chromium } from 'playwright';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:8080';
// Both forms of every route. dist/<route>.html is what a browser is linked to; dist/<route>/index.html
// is what a container without rewrite rules actually serves at /<route> - and it is a
// different document (root-absolute refs), which is how a broken srcset on /visp/ stayed
// invisible while every /visp.html run passed.
let bad = 0;
const entries = readdirSync('dist', { withFileTypes: true })
  .flatMap((d) => d.isFile() && d.name.endsWith('.html') && d.name !== '404.html' ? [d.name]
    : d.isDirectory() && existsSync(join('dist', d.name, 'index.html')) ? [`${d.name}/index.html`] : []);
// A directory entry measures something only while the base hands out THAT document. Under
// nginx.conf's canonical rewrites /<route>/index.html 301s to /<route> and try_files answers
// dist/<route>.html - the bytes the .html entry loads anyway, which is how a LAYOUT line
// could blame visp/index.html for a document nobody fetched, and one real bug count twice.
// Decided from served bytes rather than the Server header: the deploy/proxy-showcase.conf
// vhost answers `Server: nginx` and still serves the directory copy, so a header sniff would
// drop the only base on which the container's own document gets measured.
// Every directory URL is probed before the browser starts, all at once: a server that accepts and
// never answers then costs the phase one timeout instead of one per route. The number is the one
// the fixers measured - worst probe 30 ms over the local dist, 56 ms against the live site - so
// 5 s sits about 100x inside anything a working base does.
const PROBE_TIMEOUT = 5000;
const probeOne = async (f) => {
  try {
    const r = await fetch(`${BASE}/${f}`, { signal: AbortSignal.timeout(PROBE_TIMEOUT) });
    // A trailing slash is the same route - the live site answers /aps/ directly, and a 302 there
    // keeps the slash in the final URL, so comparing it to the route name needs one normalization.
    return { status: r.status, at: new URL(r.url).pathname.replace(/\/$/, ''),
      body: r.ok ? Buffer.from(await r.arrayBuffer()) : null };
  } catch (e) {
    return { err: e.name === 'TimeoutError' ? `no answer in ${PROBE_TIMEOUT / 1000}s`
      : `${e.name}${e.cause?.code ? ' ' + e.cause.code : ''}` };
  }
};
const probes = new Map(await Promise.all(entries.filter((f) => f.endsWith('/index.html'))
  .map(async (f) => [f, await probeOne(f)])));
const pages = [], collapsed = [];
for (const f of entries) {
  if (!f.endsWith('/index.html')) { pages.push(f); continue; }
  const route = f.slice(0, -'/index.html'.length);
  const { err, status, at, body } = probes.get(f);
  if (body?.equals(readFileSync(join('dist', f)))) { pages.push(f); continue; }
  // The other benign outcome: a 200 at the canonical URL carrying the flat document's own bytes,
  // which the .html entry goes on to measure. Anything else - a probe that threw, a timeout, a
  // non-2xx, bytes that are neither document, a route with no flat sibling - means this run
  // measured nothing at /<route>, and a gate must not exit 0 over documents it never loaded.
  // Before this, a reset socket or a 301 that landed on a 500 was counted as a collapse: exit 0,
  // "0 problem(s)", and the container's own directory documents never fetched.
  const landing = status === 200 && at === `/${route}` && entries.includes(`${route}.html`)
    && body?.equals(readFileSync(join('dist', `${route}.html`)));
  if (landing) { collapsed.push(route); continue; }
  bad++;
  console.log(`  FAIL  ${f} -> ${err || `${status} ${at}`}: neither the directory document's bytes `
    + `nor a 200 on the canonical /${route}. This run measured nothing at /${route}.`);
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// Two viewports: the responsive rules and most of the visitors are on phones.
const VIEWPORTS = [['desktop', 1280, 900], ['mobile', 390, 844]];
let allowed = 0;
// ikt.humlab.umu.se serves the /rave video we hotlink. It is not our server, so a hiccup
// there is counted but must not fail a deploy. demo.humlab.umu.se used to be here too: the
// SEAD image sphere frame answered X-Frame-Options: deny, and the link is gone now, so a
// new embed that will not render has to fail this gate, as it should.
const ALLOWED = /ikt\.humlab\.umu\.se/;
// The entry that was asked for, not the URL we ended up at: on a base with canonical
// rewrites a directory entry lands on /<route>, where url().split('/').pop() is '' and all
// 26 of them reported their failures under the name 'index'.
let current = '(before the first load)';
const page_ = () => current;

const IGNORE_CONSOLE = [/compute-pressure/,];   // the YouTube player probes it; Chrome denies it cross-origin by default

// Console-clean is not the same as correct: the two bugs that reached a human this month
// (webp <picture> collapsing every front-page tile, funder logos drawn 2x too wide) were
// invisible in the console and in the HTML, and obvious in one number each. So measure the
// boxes too. Only images that are finished or laid out are judged - a loading="lazy" shot
// below the fold has not been requested yet and must not read as broken, and awaiting its
// decode would wait forever for exactly that reason.
const geometry = () => page.evaluate(async () => {
  const out = [], R = (e) => e.getBoundingClientRect();
  // loading="lazy" shots below the fold have not been requested yet; without this scroll the
  // coverage figure below would measure empty space on a perfectly fine page.
  scrollTo(0, document.body.scrollHeight);
  await new Promise(r => setTimeout(r, 450));
  scrollTo(0, 0);
  await document.fonts.ready.catch(() => {});
  if (![...document.fonts].length || !document.fonts.check('100 16px Prompt'))
    out.push('body font Prompt did not load');
  for (const t of document.querySelectorAll('.project-grid-tile')) {
    const { width: w, height: h } = R(t);
    const n = t.querySelector('h3')?.textContent.trim().slice(0, 20) ?? '?';
    if (h < 120 || w < 60) out.push(`tile "${n}" collapsed to ${Math.round(w)}x${Math.round(h)}`);
  }
  const tiles = [...document.querySelectorAll('.project-grid-tile')];
  if (tiles.length > 5) {
    // Tripwire, not a measurement: how much of each tile's box its images actually paint.
    // It is a sloppy area (rowspans paint over neighbours, cover crops, a >1 value is
    // normal) but it separates the failure that happened - a wrapper element becoming the
    // grid item, so the images stop filling their cells and the mosaic turns into postage
    // stamps in a frame - by a factor of three: median 0.54/0.66 when the grid is right,
    // 0.15/0.18 with that one CSS declaration removed. Tile heights do NOT change, which is
    // why this is not a height check.
    const cov = tiles.map(t => {
      const tb = R(t);
      if (!tb.width || !tb.height) return 1;
      let a = 0;
      for (const i of t.querySelectorAll('img')) { const x = R(i); a += x.width * x.height; }
      return a / (tb.width * tb.height);
    }).sort((a, b) => a - b);
    const med = cov[cov.length >> 1];
    if (med < 0.3) out.push(`tile images paint only ${(med * 100).toFixed(0)}% of each tile (median) - something between .project-grid-tile and its <img> is the grid item`);
  }
  for (const i of document.querySelectorAll('img')) {
    const f = (i.currentSrc || i.src).split('/').pop(), bb = R(i);
    if (i.complete && i.naturalWidth === 0) { out.push(`broken image ${f}`); continue; }
    if (!i.naturalWidth || bb.height === 0) continue;
    const nat = i.naturalWidth / i.naturalHeight, ren = bb.width / bb.height;
    const fit = getComputedStyle(i).objectFit;
    if (fit === 'fill' && Math.abs(ren / nat - 1) > 0.06)
      out.push(`${f} drawn ${ren.toFixed(2)} vs natural ${nat.toFixed(2)}`);
  }
  return out;
});
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  if (IGNORE_CONSOLE.some((re) => re.test(m.text()))) return;
  bad++;
  if (ALLOWED.test(m.text())) allowed++;
  console.log(`CONSOLE ${page_()} ${m.text().slice(0, 160)}`);
});
page.on('requestfailed', (r) => {
  // A <video preload="metadata"> that gets its moov box cancels the range request; the
  // server supports ranges (nginx sends 206), Chromium reports the cancel as a failure.
  if (r.failure()?.errorText === 'net::ERR_ABORTED' && r.resourceType() === 'media') return;
  bad++;
  if (ALLOWED.test(r.url())) allowed++;
  console.log(`FAILED  ${page_()} ${r.url().slice(0, 110)} ${r.failure()?.errorText || ''}`);
});
page.on('response', (r) => {
  // Same rule as the two handlers above: a host on ALLOWED may answer badly and must not
  // fail a deploy. The hotlinked mp4 is precisely that - byte-range requests routinely
  // return 403 or 416, and a video that plays perfectly would exit non-zero.
  if (r.status() < 400) return;
  if (ALLOWED.test(r.url())) { allowed++; return; }
  bad++;
  console.log(`HTTP ${r.status()} ${page_()} ${r.url().slice(0, 110)}`);
});

for (const [label, width, height] of VIEWPORTS) {
  await page.setViewportSize({ width, height });
  for (const file of pages) {
    current = file;
    try {
      await page.goto(`${BASE}/${file}`, { waitUntil: 'load' });
      await page.waitForTimeout(200);   // let embeds and late requests report
      for (const g of await geometry()) { bad++; console.log(`LAYOUT ${label} ${file} ${g}`); }
    } catch (e) {
      bad++;
      console.log(`GOTO ${label}  ${file} ${e.message.split('\n')[0]}`);
    }
  }
}
// nginx canonicalises /404.html -> /404 -> 404; a plain static server has no such rule,
// so only hold the server to it when it claims to be the production one.
const four = await fetch(BASE + '/404.html', { signal: AbortSignal.timeout(PROBE_TIMEOUT) }).catch(() => null);
const isNginx = /nginx/.test(four?.headers.get('server') || '');
console.log(`404.html direct request -> ${four ? four.status : 'no answer'}${isNginx ? ' (nginx: expected 404)' : ' (non-production server, canonical rules not applied)'}`);
if (isNginx && four.status < 400) { bad++; console.log('  FAIL  the error page answers with a success status'); }
console.log(`${pages.length} pages x ${VIEWPORTS.length} viewports against ${BASE}, ${bad} problem(s)` +
  ` (${allowed} of them the hotlinked /rave video host, which is not ours)` +
  (collapsed.length ? `\n  ${collapsed.length} directory URLs (${collapsed.join(' ')}) answered with the canonical\n`
    + '  page instead of a directory document - verified 200s on /<route> with the flat bytes,\n'
    + '  which the .html entries of this same run measure.\n'
    + '  Run against the container itself to measure the documents it actually serves.' : ''));
await browser.close();
process.exit(bad - allowed ? 1 : 0);
