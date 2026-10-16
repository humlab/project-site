// Prints how Swedish each page's text is, to decide the `SWEDISH` set in build.mjs
// (which sets <html lang>). Run: node tools/lang.mjs
//
// Crude on purpose: Swedish words carrying å/ä/ö/é plus a handful of words that English
// never uses. A page near 0.5 is mixed and should stay lang="en" with <span lang="sv">
// blocks around the Swedish passages.
import { readFileSync as read, readdirSync } from 'node:fs';
const sv = /\b[a-zåäöé]*(å|ä|ö|é)[a-zåäö]*\b|\b(och|är|som|för|att|med|den|det|på|av|till|från|vi|du|inte|också|över|under|när|eller|bare|projektet|plattformen)\b/gi;
const en = /\b(the|and|is|of|to|in|a|that|with|for|this|from|are|was|you|it)\b/gi;
for (const f of readdirSync('src/pages').sort()) {
  const text = read(`src/pages/${f}`, 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ');
  const s = (text.match(sv) || []).length, e = (text.match(en) || []).length;
  if (s + e < 12) continue;                       // too little prose to judge
  console.log(`${(s / (s + e)).toFixed(2)}  sv:${String(s).padStart(3)} en:${String(e).padStart(3)}  ${f}`);
}
