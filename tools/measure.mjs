// Transfer bytes + request count (CDP encodedDataLength) and 20x-CPU-throttled DCL —
// the two numbers that judge a server by what reaches the underpowered browser, per page.
// Dev-only: needs playwright, deliberately not a project dependency (see tools/smoke.mjs):
//   node tools/measure.mjs http://127.0.0.1:9712 /       # and :9713, /sead, ...
import { chromium } from "playwright";
const [base, path, throttle = "20"] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
let bytes = 0, reqs = 0;
{
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Network.enable");
  cdp.on("Network.requestWillBeSent", () => reqs++);
  cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength ?? 0; });
  await p.goto(base + path, { waitUntil: "load" });
  await p.waitForTimeout(2000);   // late media range requests
  await cdp.detach();
  await p.close();
}
{
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: +throttle });
  await p.goto(base + path, { waitUntil: "domcontentloaded" });
  const t0 = await p.evaluate(() => performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart);
  await p.waitForTimeout(4000);
  const t = await p.evaluate(() => performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart);
  const total = await p.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    return n ? Math.round(n.domContentLoadedEventEnd - n.startTime) : -1;
  });
  console.log(`${base}${path}  transfer=${(bytes / 1024).toFixed(0)} kB  reqs=${reqs}  DCL(x${throttle})=${t} ms (first pass ${t0} ms, nav-entry ${total} ms)`);
}
await b.close();
