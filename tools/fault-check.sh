#!/bin/bash
# Does the gate still catch what it was built to catch, now that it is fast?
# Each fault is injected, the gate run, and the tree put back. Nothing here is a change.
cd /work/site
BASE=http://127.0.0.1:9999
say() { printf '%-46s %s\n' "$1" "$2"; }

# 1. ordering: the checker exists because a 2014 project once sat above a 2023 one
python3 - <<'PY'
import re
p='src/pages/index.html'; s=open(p,encoding='utf-8').read()
cards=re.findall(r'  <a class="project-card" href="/staden">.*?</a>\n', s, re.S)
card=cards[0]
s=s.replace(card,'')
s=s.replace('  <a class="project-card" href="/past">', card+'  <a class="project-card" href="/past">')
open(p,'w',encoding='utf-8').write(s)
PY
node build.mjs >/tmp/f1.out 2>&1 && say "1 card order (2014 above the rest)" "NOT CAUGHT" || say "1 card order (2014 above the rest)" "caught: $(grep -o 'out of order.*' /tmp/f1.out | head -1 | cut -c1-60)"
git checkout -q src/pages/index.html

# 2. an image the build does not have
cp src/pages/aps.html /tmp/aps.bak
sed -i 's#assets/aps/aps_love_2.jpg#assets/aps/nope.jpg#' src/pages/aps.html
node build.mjs >/tmp/f2.out 2>&1 && say "2 img src with no file in src/assets" "NOT CAUGHT by build" || say "2 img src with no file in src/assets" "caught by build"
node build.mjs >/dev/null 2>&1
cp /tmp/aps.bak src/pages/aps.html

# 3. the same class of breakage seen from the browser instead of the build: edit the built
#    bytes only, so smoke must be the one to notice
node build.mjs >/dev/null 2>&1
cp dist/aps.html /tmp/apsdist.bak
sed -i 's#assets/aps/aps_love_2.jpg#assets/aps/gone.png#' dist/aps.html
node tools/smoke.mjs $BASE >/tmp/f3.out 2>&1
grep -q 'broken image' /tmp/f3.out && say "3 broken image in the served bytes" "caught by smoke" || say "3 broken image in the served bytes" "NOT CAUGHT"

# 4. tiles collapsing - the failure the coverage tripwire exists for
cp dist/styles.css /tmp/css.bak
printf '.project-card { height: 40px !important; }\n' >> dist/styles.css
node tools/smoke.mjs $BASE >/tmp/f4.out 2>&1
grep -q 'collapsed to' /tmp/f4.out && say "4 .project-card height forced to 40px" "caught by smoke" || say "4 .project-card height forced to 40px" "NOT CAUGHT"
cp /tmp/css.bak dist/styles.css

# 5. the mosaic tripwire: images stop painting their cells (the webp <picture> bug)
cp dist/styles.css /tmp/css2.bak
printf '.card-media img { width: 18px !important; height: 18px !important; }\n' >> dist/styles.css
node tools/smoke.mjs $BASE >/tmp/f5.out 2>&1
grep -q 'paint only' /tmp/f5.out && say "5 tile images shrunk out of their cells" "caught by smoke" || say "5 tile images shrunk out of their cells" "NOT CAUGHT (median $(grep -o 'paint only [0-9]*' /tmp/f5.out | head -1))"
cp /tmp/css2.bak dist/styles.css

# 6. CSP is still enforced and still reported: a first-party script is the thing CSP is for
cp dist/aps.html /tmp/apsdist2.bak
sed -i 's#</body>#<script>console.log(1)</script></body>#' dist/aps.html
node tools/smoke.mjs $BASE >/tmp/f6.out 2>&1
grep -qiE 'CONSOLE.*(content security policy|Refused)' /tmp/f6.out && say "6 inline script against script-src none" "caught by smoke" || say "6 inline script against script-src none" "NOT CAUGHT"
cp /tmp/apsdist2.bak dist/aps.html

# 7. links: a domain nobody can reach
cp src/pages/aps.html /tmp/aps2.bak
sed -i 's#</h3>#</h3>\n    <p class="desc-text"><a href="https://this-domain-does-not-exist-9e7b.invalid/" target="_blank" rel="noopener noreferrer">dead</a></p>#' src/pages/aps.html
node build.mjs >/dev/null 2>&1
node tools/links.mjs >/tmp/f7.out 2>&1
grep -q 'this-domain-does-not-exist' /tmp/f7.out && say "7 external link to a dead domain" "caught by links.mjs" || say "7 external link to a dead domain" "NOT CAUGHT"
cp /tmp/aps2.bak src/pages/aps.html

# 8. a document that is not in the build at all (dist/ is not this build's output)
node build.mjs >/dev/null 2>&1
rm -f dist/aps.html
node tools/smoke.mjs $BASE >/tmp/f8.out 2>&1
grep -q 'has no twin' /tmp/f8.out && say "8 a route missing its flat twin" "caught by smoke" || say "8 a route missing its flat twin" "NOT CAUGHT"

node build.mjs >/dev/null 2>&1
node tools/smoke.mjs $BASE 2>&1 | grep -E 'pages x'
