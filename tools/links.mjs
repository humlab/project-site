// Checks every outbound link in dist/ with a real request and lists the dead ones.
// Run: node build.mjs && node tools/links.mjs      (needs network)
//
// Exit code 1 if any link fails. A 200 is not the only pass:
// some project hosts answer 200 with a placeholder ("Welcome to nginx!" — that is how
// three Humlab apps that were shut down still look alive). Bodies are sniffed for those.
// A `timeout`/`dns/refused` here can be this container's egress rather than the site:
// re-check from somewhere else before deleting a link because of one.
import { readdirSync, readFileSync } from 'node:fs';

const TIMEOUT = 15_000;
const rows = [];
for (const f of readdirSync('dist').filter((n) => n.endsWith('.html'))) {
  const html = readFileSync(`dist/${f}`, 'utf8');
  for (const m of html.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/gi)) {
    const end = html.indexOf('</a>', m.index);
    const text = html.slice(m.index + m[0].length, end).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    rows.push({
      page: f.replace('.html', ''),
      slot: /explore-button/.test(m[0]) ? 'BUTTON' : 'inline',
      href: m[1],
      text: text.slice(0, 32),
    });
  }
}

// A host that still has a web server but no app answers 200 with one of these.
const HOLLOW = [/Welcome to nginx!/i, /Apache2 Ubuntu Default Page/i, /Plesk/i,
  /Domain is parked|domain name expired/i, /502 Bad Gateway|503 Service Unavailable|504 Gateway/i,
  /<title>\s*(<\/title>|coming soon|under construction)\s*<\/title>/i];
const status = new Map();
const check = async (href) => {
  if (status.has(href)) return status.get(href);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  let out = 'timeout';
  try {
    // GET, not HEAD: several project hosts reject HEAD with 403/405 while serving GET fine.
    const res = await fetch(href, { signal: controller.signal, redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) showcase-link-check' } });
    out = String(res.status);
    // 254 bytes with no <title> was digibon: a deployed-but-empty shell.
    const body = await res.text();
    if (/^2\d\d$/.test(out) && (HOLLOW.some((re) => re.test(body)) || !/<title[^>]*>[^<]/i.test(body)))
      out = 'hollow';
  } catch (e) {
    out = e.name === 'AbortError' ? 'timeout' : `dns/refused`;
  }
  clearTimeout(timer);
  status.set(href, out);
  return out;
};

const urls = [...new Set(rows.map((r) => r.href))];
for (let i = 0; i < urls.length; i += 8) await Promise.all(urls.slice(i, i + 8).map(check));

const dead = rows.filter((r) => !/^(2|3)\d\d$/.test(status.get(r.href)));
for (const r of dead) console.log(`${status.get(r.href).padEnd(11)} ${r.slot.padEnd(6)} ${r.page.padEnd(22)} ${r.href}  ("${r.text}")`);
console.log(`${urls.length} distinct links, ${dead.length} failing`);
process.exit(dead.length ? 1 : 0);
