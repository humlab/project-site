// Loads every built page in headless Chromium and reports console errors, failed
// requests, non-200 responses and CSP violations.
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
import { readdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:8080';
const pages = readdirSync('dist').filter((f) => f.endsWith('.html') && f !== '404.html');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// Two viewports: the responsive rules and most of the visitors are on phones.
const VIEWPORTS = [['desktop', 1280, 900], ['mobile', 390, 844]];
let bad = 0, allowed = 0;
// ikt.humlab.umu.se serves the /rave video we hotlink. It is not our server, so a hiccup
// there is counted but must not fail a deploy. demo.humlab.umu.se used to be here too: the
// SEAD image sphere frame answered X-Frame-Options: deny, and the link is gone now, so a
// new embed that will not render has to fail this gate, as it should.
const ALLOWED = /ikt\.humlab\.umu\.se/;
const page_ = () => (page.url().split('/').pop() || 'index');

const IGNORE_CONSOLE = [/compute-pressure/,];   // the YouTube player probes it; Chrome denies it cross-origin by default
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
page.on('response', (r) => { if (r.status() >= 400) { bad++; console.log(`HTTP ${r.status()} ${page_()} ${r.url().slice(0, 110)}`); } });

for (const [label, width, height] of VIEWPORTS) {
  await page.setViewportSize({ width, height });
  for (const file of pages) {
    try {
      await page.goto(`${BASE}/${file}`, { waitUntil: 'load' });
      await page.waitForTimeout(200);   // let embeds and late requests report
    } catch (e) {
      bad++;
      console.log(`GOTO ${label}  ${file} ${e.message.split('\n')[0]}`);
    }
  }
}
// nginx canonicalises /404.html -> /404 -> 404; a plain static server has no such rule,
// so only hold the server to it when it claims to be the production one.
const four = await fetch(BASE + '/404.html');
const isNginx = /nginx/.test(four.headers.get('server') || '');
console.log(`404.html direct request -> ${four.status}${isNginx ? ' (nginx: expected 404)' : ' (non-production server, canonical rules not applied)'}`);
if (isNginx && four.status < 400) { bad++; console.log('  FAIL  the error page answers with a success status'); }
console.log(`${pages.length} pages x ${VIEWPORTS.length} viewports against ${BASE}, ${bad} problem(s)` +
  ` (${allowed} of them the hotlinked /rave video host, which is not ours)`);
await browser.close();
process.exit(bad - allowed ? 1 : 0);
