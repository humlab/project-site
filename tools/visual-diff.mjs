// Is this build better, and would a visitor notice? Loads each route on two bases - the deployed
// site and a local dist - and reports, per route, how many images paint broken and how many
// pixels differ. "Nothing changed" and "7 of 9 images came back" are both answers; this is the
// tool that knows which one you got. No npm dependencies beyond playwright's chromium, and no
// image library: the pixel diff runs in a canvas inside the browser we already have.
//
//   node tools/visual-diff.mjs https://showcase.humlab.umu.se http://127.0.0.1:19196
//   node tools/visual-diff.mjs <a> <b> visp sead past            # a subset, desktop only
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const [A, B, ...want] = process.argv.slice(2);
if (!A || !B) { console.log('usage: node tools/visual-diff.mjs BASE_A BASE_B [route ...]'); process.exit(2); }
const VIEWPORTS = want.length ? [['desktop', 1280, 900]] : [['desktop', 1280, 900], ['mobile', 390, 844]];

// Routes = the directory forms of the built pages: what a visitor at /visp/ actually gets.
const routes = (want.length ? want : readdirSync('dist', { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== 'assets' && !d.name.startsWith('.'))
  .map((d) => d.name)).sort();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// One page of broken images is a fact; one percent of pixels is a shape. Both, because they catch
// different things: a wrong URL paints nothing and moves nothing, a changed layout moves pixels
// with every image intact.
const survey = () => page.evaluate(() => ({
  imgs: document.images.length,
  broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0
    && (i.getAttribute('src') || i.getAttribute('srcset'))).length,
  text: document.body.innerText.replace(/\s+/g, ' ').trim().length,
}));

async function shoot(url, label) {
  await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch((e) => console.log(`  ${label} goto ${e.message.split('\n')[0]}`));
  await page.waitForTimeout(1200);            // fonts and the last <picture> candidate
  const png = await page.screenshot({ fullPage: true });
  return { png, ...(await survey()) };
}

// Canvas diff: scale-free, counts a pixel as different when any channel moves enough to see.
async function diffPct(pngA, pngB) {
  if (!pngA || !pngB) return 'n/a';
  const pct = await page.evaluate(async ([a, b]) => {
    const load = async (bytes) => createImageBitmap(await (await fetch(`data:image/png;base64,${bytes}`)).blob());
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const grab = (img) => { ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, w, h).data; };
    const da = grab(ia), db = grab(ib);
    let diff = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) > 8 || Math.abs(da[i + 1] - db[i + 1]) > 8 || Math.abs(da[i + 2] - db[i + 2]) > 8) diff++;
    }
    return (100 * diff / (da.length / 4)).toFixed(2);
  }, [pngA.toString('base64'), pngB.toString('base64')]);
  return pct;
}

for (const [label, w, h] of VIEWPORTS) {
  page.setViewportSize({ width: w, height: h });
  console.log(`\n${label} ${w}x${h}`);
  for (const route of routes) {
    const a = await shoot(`${A}/${route}/`, 'A');
    const b = await shoot(`${B}/${route}/`, 'B');
    const pct = await diffPct(a.png, b.png);
    const flag = a.broken !== b.broken || pct !== '0.00' ? '  <-' : '';
    console.log(`  ${route.padEnd(24)} broken images ${a.broken}/${a.imgs} -> ${b.broken}/${b.imgs}`
      + `   pixels differing ${pct}%   text ${a.text} -> ${b.text} ch${flag}`);
  }
}
await browser.close();
