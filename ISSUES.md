# Issues, one line each

Split out of the commit history so an issue can be read, reviewed or reverted on its own. `commit`
is where the fix lives; `guard` is what fails the build or the gate if it comes back. The commits
listed are on `static-site` ahead of `origin/static-site` (`git log --oneline origin/static-site..HEAD`).

## 1. A visitor sees the difference

| issue | commit | guard |
|---|---|---|
| Directory pages pointed every `<picture>` candidate at a 404: live `/visp/` showed 2 of 9 images | `4724a56` | `absolute()` prefixes `/` for dir forms; smoke loads dir documents too |
| The 404 page served under a multi-segment URL lost both header logos | `d70b53c` | one `belowRoot(name)` predicate, read by the rewriter and the validator |
| `tel:` links refused to build, so a phone number had been deleted from a page to make the build pass | `0614cc9` | scheme rules cover `tel:`/`sms:` (case-insensitive), with both schemes on both tests |
| A page that quotes HTML in its own text was a build failure (a page that would not ship is a content bug) | `8b7f89b` | one tokenizer reads tags; `selftest` asserts a quoted `>` is not an end-of-tag |

Measured with `node tools/visual-diff.mjs https://showcase.humlab.umu.se http://127.0.0.1:<port>`:
broken images per route today vs after a deploy, plus the percentage of pixels that move. On four
routes sampled: `/past/` 5/5 broken → 0, `/rave/` 4/5 → 0, `/sead/` 7/8 → 0, `/visp/` 7/9 → 0, with
identical text length on every one of them. The pixel numbers are large (36–63%) precisely because
a broken-image placeholder becoming a photograph is a large change; no layout moved.

## 2. Would have shipped broken with a green build

| issue | commit | guard |
|---|---|---|
| A ref written unquoted (`srcset=assets/x.png`) was invisible to the checks | `47bec12` | the tokenizer reads that grammar; refused if anything still misses it |
| The rewriter was as blind as its checks: it could inject `</picture>` inside a tag | `f72138a` | rewriter and checks share `elements()`/`attrPairs()`/`setAttr()` |
| Six readers still parsed tags by hand: `<object data>`, `src='x'` (single quote skipped the webp pass), `<image>`→`<img>` anywhere in the document, `geo:`/`ftp:` misread as relative, h2-title read from uncommented text, `target='_blank'` in one quote style | `54b0c3d` | all six consume the shared tokenizer |
| Three regexes rewrote markup across the whole document, turning prose in `title=`/`<code>`/`<style>` into paths | `696bbf2` | `setAttr()` is the only code that puts bytes into an attribute value |
| A raw-text element's own attributes were skipped (`<script src>` shipped relative), `target="_BLANK"` escaped the tabnabbing rule, `src="x.png?v=2"` lost its `<picture>` and shipped PNG at 4× | `bf4523a` | body is a span of its own; 8 assertions in `node build.mjs --selftest` |
| An unclosed `<style>`/`<textarea>` hid every ref after it; balance then shouted about `<div>` | `bf4523a` | the report names the tag, the counts stand down for that page |

## 3. The gate itself (no served bytes involved)

| issue | commit | guard |
|---|---|---|
| smoke measured a document it never fetched and blamed the wrong page; Server-header sniffing replaced with a byte probe (82 s → 43 s) | `ede1f28` | byte comparison against `dist/` |
| A failed directory probe (thrown fetch, 301→500, a stalled server) counted as a rewrite: `0 problem(s)`, exit 0, 26 documents never loaded | `2b5fbaa` | two benign outcomes only, both byte-verified; 5 s timeout |
| `bad - allowed` as a truthiness test fails a clean run whose only event is a tolerated one; a `dist/` missing half a page-pair ran clean | `9d1cb84` | `bad > allowed`; an unpaired document names itself |
| 26 simultaneous probes against a 32-pid box; a `/404.html` that never answered printed a reassuring line; README said "every page" where it loads 27 of 53 documents | `54968c6` | probes batched at 4; unanswered probe fails; README counts |
| `.gitkeep` shipped as an asset; README claimed a winner between duplicate headers it had not measured | `19f942f` | dotfiles skipped in both passes; per-field measurement in README |
| One owner per security header: HSTS removed from the site copy (the vhost terminates no TLS and `includeSubDomains` claimed hosts this repo does not control) | `30562bc` | README states who sets what and which wins, measured |
| `assets/.gitkeep`-class dotfiles were either a route or a shipped asset, silently | `c932ac8` | `.`-prefixed names skipped in asset copy and page enumeration |
| The proxy vhost `listen`ed on the socket the container binds (could not load), and the edge 404 was not ours | `1a3a313` | `node tools/check-nginx.mjs` — wraps both http-level snippets and runs `nginx -t` (the socket listener and the edge's `upstream` are substituted for the test, since `-t` binds and must not connect) |

## 4. Open, from the last full review, not started

| issue | why it is still open |
|---|---|
| "the upstream may point elsewhere" comment in `deploy/proxy-showcase.conf` | contested: it is a comment about a future editor's config, not a bug |
| duplicated measurement prose in README (same facts, two sections) | tidying, no behaviour |
| `nginx.conf`'s "same value as" cross-reference | nit |
| tile alt text and contrast (design review) | needs a human eye, not a reviewer subagent |
