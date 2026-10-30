# Humlab Showcase

`showcase.humlab.umu.se` — static pages about current and completed Humlab projects.

Plain HTML, one stylesheet, no first-party JavaScript, no frameworks, no npm dependencies.
The previous version was an Angular 11 + Ionic app whose 28 components contained zero
dynamic behaviour; the machinery was only a source of breakage (see git history).

It is a dual-language site with two static trees: English at `/` and Swedish at `/sv/`.
The language switch is a link, not a script, so the CSP stays `script-src 'none'` and the
minimal container keeps serving only bytes.

## Build

```sh
node build.mjs        # writes dist/, and validates everything below
```

`build.mjs` assembles `src/pages/*.html` (English) and `src/pages/sv/*.html` (Swedish)
with `src/partials/{head,header,footer}.html`, copies `src/assets` and `src/styles.css`,
and **fails without writing dist/** if a page has:

* a missing or empty `src`/`href`/`srcset`/`poster`/`<object data>`, in any quoting style and
  any attribute case — including a `srcset` with more than one candidate, where every candidate
  is checked and the build root-absolute-ises each one
* a directory where a file belongs, a `http://https://` URL, or a scheme with no host
* an attribute quote that never closes: everything after it parses as part of that value, so its
  refs would be neither rewritten nor checked, and the page is broken in a browser too
* a raw `<` in copy (write `&lt;`), which a browser would turn into a tag
* `index.html` or `404.html` missing — a green build with no front page is possible
* an `http://` link to a host that is not in `HTTP_ONLY` (hosts with no working TLS)
* an `<img>` without `alt`, a `target="_blank"` without `rel="noopener"`
* attributes glued together or duplicated (e.g. two `class=`), unbalanced tags
* no text in an `<h2>` to derive `<title>`, `og:title` and `og:description` from

Every one of those reads the tag through one tokenizer (`elements()` + `attrPairs()`), which is
also what the rewriter and the `<picture>` inserter use: a ref the checker can see is a ref the
build can move, and `src=` written inside a value or in prose is text, checked as text and left
alone. That shared grammar replaced three regexes that disagreed about what a tag is.

Warnings that need a human: unused assets (with size), images without `width`/`height`,
and leftover template copy such as "Insert text here".

**WebP.** Every referenced raster over 20 kB also gets a `.webp` beside it in `dist/`
(`cwebp -q 80 -m 6 -mt`) and its `<img>` is wrapped in
`<picture><source type="image/webp" srcset="..."><img src="..."></picture>`: no JS, and
`dist/` still opens from a directory or a `file://` path — the English tree, at least:
`/sv/` references are root-absolute by design, so a `file://` Swedish page arrives unstyled.
Measured on this tree: 79 images, 21.2 MB of png/jpeg down to 5.9 MB, lowest All-PSNR 39.1 dB
(`assets/infravis-sead/seadbugs-screenshot.png.thumb.webp`), `dist/` is 33 MB on disk.
Everything smaller, and every SVG, is left alone.
The encodes
are generated, never committed: a stale `.webp` in git beside a hand-replaced png shows
every current browser the old picture. `cwebp` comes from the `webp` package
(`apt install webp`); without it the build warns and ships png/jpeg only. The encode runs
*after* the checks and before the pages are written, so a `cwebp` failure deletes its
partial file and exits 1 with an assets-only `dist/` — the one failure here that leaves
something on disk. `cwebp` reports the PSNR of each encode on stderr; the build reads it and
prints the lowest one it produced, so a quality regression shows up at a build instead of
being assumed.

**Tile thumbnails.** The front page used to download 4.7 MB to paint a grid of boxes no
wider than 252 CSS px: the "thumbnails" were the full screenshots, so the browser paid for
6 megapixels per tile and threw most of them away — 18x over-sampled. Tiles (`<img>` with
class `screenshot-cover`, which is them and nothing else in this site) therefore also get
`<name>.thumb.webp`, `cwebp -resize`d so the long edge is at most 768 px (>=3x the largest
tile box, so it stays sharp on a 3x phone). 1.14 MB now, same grid: measured in Chromium
against the live site, mean difference per colour channel 3.7/255 over the 34 tiles — most
of which is the server's libwebp encoding the same files a little differently — and the
build's own check confirms every tile still paints its cell. 
The choice belongs to the `<img>`, not to the file: `assets/visp/screenshot2.png` is both a
tile thumbnail and some page's full screenshot, so it gets both `.webp` and `.thumb.webp`
and the two `<picture>` elements point at different ones — hence 78 files from 68 images. An
image already under 768 px gets a single `.webp` serving both uses, and one under the 20 kB
floor gets none: the markup would cost more than the bytes it saves.

A `<picture>` is a box. On the front-page cards it is a grid item of its own and the `<img>`
fills it; on project pages the wrapper is sized by width, so it does not change the layout.
The old rule `#main-grid-container picture { display: contents }` is gone because the new
card markup sizes the media box, not the image's attribute dimensions.

`<title>`/`og:` text comes from each page's `h2` (a `<br>` inside it becomes " – ").
`<html lang>` is set by the source directory: `src/pages/` is `en`, `src/pages/sv/` is `sv`.
The build rejects a route that exists in one tree but not the other.

Fonts are self-hosted (`src/assets/fonts`, one Latin-subset Inter variable file covering
weights 400–700): no font request leaves the server, so no visitor IP goes to Google and
the typography survives Google being down or blocked. Inter is a widely used modern UI
font, which is why the card titles and body text no longer look like the old geometric
Prompt face. The decorative Harlow Solid, WendyOne and Italianno faces used by the old
design are gone; the project logos are images. Inter is under the SIL Open Font License 1.1,
whose text ships as `LICENSE-Inter.txt` in the repo rather than in `dist/`.

What the checker does *not* do: tag balance is a count of elements and closings, so a `<p>`
misnested inside another element that the browser repairs differently is out of scope, and
`a<b and c>` in copy is indistinguishable from markup — that is why raw `<` is a failure. And
`url(...)` inside a `style` attribute or a `<style>` block is not a ref to anything here: a
relative one in a page served at `/project/` will 404, and no check will say so. No page in
`src/` uses either today.

## Preview locally

All links and asset paths are relative, so `dist/index.html` works straight from the
filesystem, and any static server works for clicking around:

```sh
python3 -m http.server -d dist 8080
```

That server cannot show you what production does (no CSP, no canonical rewrites, no
cache headers). For that, run the real config — it is self-contained, only the listen
line and root differ from production:

```sh
sed -e 's|listen unix:/socket/nginx.sock;|listen 127.0.0.1:8099;|' \
    -e 's|root /usr/share/nginx/html;|root '"$PWD"'/dist;|' \
    nginx.conf > /tmp/site.conf
# include /tmp/site.conf from an http{} block, or paste it into a container's conf.d/
```

`:8099` is a test instance only — production listens on the unix socket and nothing else.
To see what the server in `deploy/` does rather than what nginx does, run its binary
unpacked: `busybox httpd -f -p 8833 -h dist`.

## Checking a change

```sh
node build.mjs
node tools/check-nginx.mjs                          # nginx -t on both config snippets
npm i --no-save --no-package-lock playwright && npx playwright install chromium
node tools/smoke.mjs http://127.0.0.1:8099      # every page, two viewports, both forms
node tools/links.mjs                                      # needs network
```

`tools/smoke.mjs` loads every built page in headless Chromium and reports console errors,
failed requests, non-200 responses, CSP violations, and whether `/404.html` stays non-200.
It exits non-zero and can gate a deploy. Each route is built in both flat and directory forms and
in both languages; under `nginx.conf`'s canonical rewrites the directory probes land on the
canonical page with the flat document's own bytes, and both trees are measured. A directory probe
that errors, times out, or returns anything else fails the run: those are the container's own
documents, and a gate that skips them and exits 0 is not a gate. It fails on a page built in one
form and not the other, because that `dist/` is not a build output. One report is
tolerated: `ikt.humlab.umu.se`, whose mp4 `/rave` hotlinks, is not our server, so a failure there
is counted and shown but cannot fail the run — tolerance is a ceiling on what may be ignored,
never a credit that cancels somebody else's failure. Anything else does —
including an embed that passes CSP and is still blank because the other server answers
`X-Frame-Options: deny`, which is the bug that started all this (see Known issues).

`tools/links.mjs` requests every outbound link, because HTTP 200 is not proof of life:
three of the project's own apps answered 200 with `Welcome to nginx!`. Those are reported
as `hollow` and it exits non-zero, so it can gate a deploy, retrying a failure once before
reporting it. Bodies are sniffed only when the response says `text/html` (for the mp4
/rave links, a 200 is the whole test), and a page with no title that carries an iframe,
canvas or script counts as an app that paints itself — the 254-byte digibon.humlab shell
embeds an ArcGIS Experience, and calling it dead deleted a working Explore button. A
`timeout` from one container is not proof of death either (some hosts filter unusual
clients) — check from somewhere else before deleting a link because of it.

## Adding or changing a project page

1. Add `src/pages/<route>.html` and `src/pages/sv/<route>.html`, both containing the body
   only (copy an existing page: `h2.sub-header` + `div.main-container` + left/right
   containers). The file name becomes the URL (`/sead`, `/sv/sead`), the `<h2>` becomes the
   page title. The build fails if the route is missing from either tree.
2. Link it from both front pages: `<a href="/<route>">` in `src/pages/index.html` is
   rewritten to a relative link for English; the same link in `src/pages/sv/index.html` is
   rewritten to `/sv/<route>` for Swedish. The checker fails if the route does not exist.
   The grid is newest-first, so a new project's card goes at the top of it.
3. Put images in `src/assets/<route>/` with `width`/`height` attributes and `loading="lazy"`
   unless they are above the fold.
4. Styles: `src/styles.css`, plain CSS with custom properties at the top — no
   preprocessor, the old `.scss` files were flat enough not to need one.

## Deploy

There are two ways to serve `dist/` and they are not interchangeable. **What answers
`showcase.humlab.umu.se` today is the busybox origin**: `/sead` replies with busybox's own
`302 → /sead/` and a miss returns busybox's 124-byte page rather than `dist/404.html` — both
of which also say the deployed edge is *not* `deploy/proxy-showcase.conf` from this repo,
since that vhost exists to prevent the 302 and would answer 200 with no redirect. The nginx
shape below is what the redesign is benchmarked against.

**nginx.** `nginx.conf` is the server block (`/etc/nginx/conf.d/default.conf` in the stock
nginx image — TLS, HTTP/2 and HSTS belong to the front proxy that hands it
`unix:/socket/nginx.sock`). The canonical URLs, the security headers, the cache map and the
404 page live in that file: without it `/sead` and `/sv/sead` are 404s and there is no CSP.
The `/sv/` root is kept as a directory: the generic slash-strip rule has an explicit `/sv/`
exception, and a missing Swedish page serves the Swedish `sv/404.html`.

```sh
node build.mjs && node tools/links.mjs
rsync -a --delete dist/ <host>:/usr/share/nginx/html/
curl -sI https://showcase.humlab.umu.se/assets/past/past-map.jpg.webp | grep -i content-type
```

That last line is part of the deploy, not a curiosity: request one generated `.webp` from
the deployed site and require `image/webp`. What a missing `Content-Type` costs depends on
the client: Chromium 156 renders the images even with `X-Content-Type-Options: nosniff`
present (measured below), while clients that do not guess — wget, link-preview bots, feed
readers — refuse them outright. Fixing the type is cheap; leaning on one browser's tolerance
is not.

Keep `dist/` as the rsync source: pointing it at the repo root would ship `.git` (118 MB)
and `--delete` the rest of the web root.

Before believing a deploy, check what the front proxy already sends. Measured at the edge
today (`curl -I https://showcase.humlab.umu.se/`, nginx 1.28 Ubuntu): `nosniff`,
`X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy:
no-referrer-when-downgrade` and HSTS, no CSP and no Cache-Control. Whether a second copy of
one of these is harmless depends on the field, and both directions were measured rather than
assumed. For `X-Content-Type-Options`, Chromium obeys the **first** copy: a script served as
`text/html` ran when the pair read `none, nosniff` and was blocked when it read
`nosniff, none` — and nginx writes proxied headers before the outer server's own
`add_header` output, so the `nosniff` this vhost adds is the one in force. `Referrer-Policy`
behaves the other way: the Fetch spec takes the **last** value of the combined list, so on a
200 the edge's weaker `no-referrer-when-downgrade` wins and ours is inert (measured by
reading the `Referer` a subresource really sends, in both orders). Ours still earns its line
because it carries `always` and the edge's does not: a 404 on the live site arrives with HSTS
and nothing else, and with this vhost behind that same shape in a test rig the error page is
the one response where our two copies are the only ones present. Making
the 200s `no-referrer` is an edit to the edge, not to this file, and `proxy_hide_header` on
the edge cannot do it either: it filters what arrives from upstream, so it deletes our copy
and keeps its own. `Strict-Transport-Security` is not sent here at all: that is a claim about
TLS, made by whatever terminates TLS. `X-Frame-Options: DENY` out there and
`frame-ancestors 'none'` in here agree with each other, and neither of our files sends XFO.

**Locked-down container** (`deploy/`). One name, three places: the image is
`localhost/showcase_static`, and a quadlet whose `Image=` says anything else — `showcase_nginx`
is a common leftover — starts a *different* image and no amount of `podman build` will change
what answers. Check `podman inspect showcase-nginx --format '{{.Image}} {{.Created}}'`
against what you just built before believing a deploy. A `scratch` image running busybox `httpd`: one
process, no shell, read-only, 64 MB. `build.mjs` writes a second copy of every page as
`<route>/index.html` with root-absolute refs precisely so this server can answer `/sead`
(it 302s to `/sead/` by itself and serves the index) — without that, the minimum container
404s on every canonical URL. What it still cannot do, measured with the real 1.37 binary:
send any header (no CSP, no cache, no nosniff), serve a custom 404 page, gzip, keep-alive,
or put a `Content-Type` on `.webp`, `.woff2`, `.mp4` and `.ico`: none are in its built-in
table, the Debian build does not read `/etc/mime.types` (the entries are in the file, the
header is still absent), and `httpd.conf`'s `E:`/`A:` mime syntax is silently ignored, so
those go out with no `Content-Type` at all. That is untidy rather than fatal, and it took a
browser to establish it: Chromium 156 renders the `.webp` files on /visp and loads the font
through a proxy adding `nosniff` with no `Content-Type` present, and still renders them when
the response *lies* with `Content-Type: text/html`. What `nosniff` actually refuses is a
mismatched script or stylesheet - and this site ships no scripts at all, while busybox types
`.css` correctly. So the types below are hygiene: they matter for clients that read the
header instead of sniffing (a share bot deciding whether `og:image` is an image, `wget`,
anything downstream that enforces strictly) and for not sending 7 MB of images out as
anonymous bytes. One engine tested, headless; if a Firefox/WebKit check ever says otherwise,
the proxy block below is what fixes it, not a format change.

**This is the shape in use** (not byte-for-byte what is deployed — see *Deploy* above): the
container serves bytes, the front proxy supplies what
busybox cannot invent. `deploy/proxy-showcase.conf` is that vhost — the canonical rewrites, the
header list, four `Content-Type` overrides, and a `proxy_intercept_errors` fetch of
`404.html` so a missing page gets our text at status 404 rather than busybox's at 404 — tested against the running container:
`.webp` → `image/webp`, `.woff2` → `font/woff2`, one `Content-Type` per response (an
`add_header` without `proxy_hide_header` appends a second one, which is worse than none),
CSP present on the 301s as well as the 200s, `Cache-Control` differing for html, css and
assets. `deploy/proxy-headers.conf` is that header list, included at four levels because
nginx inherits `add_header` per level and a location that sets one drops the inherited set —
which is how CSP once disappeared from every `/assets/*` response here. What no proxy can
give this container: gzip, keep-alive, or Range-coalesced responses. (A custom 404 used to be on
that list; the `proxy_intercept_errors` block above removed it — verified through a running proxy,
where `GET /nope` answers 404 carrying the bytes of `dist/404.html`.) For a host that is not
quadlet-run, `nginx.conf` serves the same
`dist/` with all of those and needs nothing in front but TLS.

```sh
deploy/sample-run.sh   # build + start the container on 127.0.0.1:9712 (site built inside the Containerfile)
```

**The nginx sibling, measured** (`deploy/Containerfile.nginx`). Both origins, same
`dist/`, same hardened flags, side by side (podman 4.6, 2026-10-30): busybox 35.1 MB /
nginx 39.2 MB. `tools/measure.mjs` per page (transfer via CDP, render with the CPU 20×
slower):

| page | busybox | nginx |
|---|---|---|
| `/` transfer | 1236 kB / 38 req | 1237 kB / 38 req |
| `/` main thread, CPU×20 | 891 ms | **758 ms** |
| `/sead` transfer | 479 kB / 12 req | **421 kB / 11 req** |
| `/sead` main thread, CPU×20 | 354 ms | **347 ms** |

The `/sead` delta is `SEAD-logo.svg` 67→16 kB and `styles.css` 10.8→3.1 kB — gzip of SVG
and CSS, which busybox cannot do at all — plus one fewer request (no `302` hop). The 18%
on `/` is `Connection: close`: 38 fresh sockets instead of one keep-alive connection.
For the kiosk panels the deciding number is not in the table: nginx sends `Cache-Control`
from git, so every reload after the first is a cache-hit; busybox sends none and every
reload revalidates all 38 resources. Verdict: **nginx origin**, evaluated and not yet
deployed; the size argument is answered better by dropping the 21 MB png/jpeg fallback
than by busybox. The image is built for the same unix-socket chain the busybox quadlet
uses (`LISTEN=socket` is the default; `--build-arg LISTEN=tcp` serves :8080 for local
runs); it needs writable `/run` and `/tmp` (tmpfs, `mode=1777`) and runs as `User=65534`,
since cap-drop=all leaves a root master unable to run nginx's `initgroups` at all.

## Deliberate choices, each learned from a bug

* `try_files $uri $uri.html =404` with no `index.html` fallback. The old block ended in
  `/index.html`, so every missing file answered `200 text/html` — that is how a missing
  `og:image` stayed invisible for years.
* Cache-Control comes from a `map` on `$status$uri` instead of `add_header` inside
  locations: any location-level `add_header` replaces the server-level list, which would
  have stripped CSP and `nosniff` from every `/assets/*` response — and `/assets/*.svg` is
  same-origin SVG, which needs its own CSP. The `$status` half keeps 404s from being
  cached for 30 days while an `rsync --delete` replaces an image.
* Canonical URLs are extensionless (`/sead`); `/sead.html` 301s to it. In-page links stay
  relative so `dist/` also works from a directory or the filesystem. A project that changes
  name needs its own rule: `/swedeb` (now Riksdagsdebatter) 301s from every spelling
  (`/swedeb`, `/swedeb/`, `/swedeb.html`) so old bookmarks and the old front page still land.
* `script-src 'none'`: the site ships no JavaScript of its own, so an injected script cannot run (framed players —
  Kaltura, YouTube-nocookie, Sketchfab — do run JavaScript, under *their* origin's CSP:
  `script-src` cannot reach into a frame, `frame-src` is what admits them). When
  you add an embed, extend `frame-src` and re-run `tools/smoke.mjs`.
* Heading metrics are ported literally from Ionic's normalize
  (see `git log`), because the design was spaced around them.
* `assets` are cached 30 d but not `immutable`: files are replaced by hand under the same
  name, and `immutable` would strand visitors on the old copy for a year.

## Known issues (pre-existing; the build warns so they are not forgotten)

* `/ships` has no copy. What a visitor could read of the template is deleted (two "Insert
  text here" paragraphs and two empty image boxes), which leaves a heading, an Explore
  button and a video. It still needs words from Humlab; `build.mjs` no longer warns about
  this page, and the placeholders stay in its `PLACEHOLDERS` list for the next one.
  The video stays: it is SHiPS' own film. The copy that is in the wrong place is on
  /digitalamodeller, which embeds the same video under the title "Swedish Historical
  Population Samples (SHiPS)" — wrong name, and a second embedding of one video.
* Two embeds could not render at all and were replaced. /rave's video is the good ending:
  `ikt.humlab.umu.se` answers `X-Frame-Options: deny`, but media loads are not governed by
  that header, so a `<video>` plays their file and the 70 MB stays on their server. The SEAD
  image sphere on /infravis-sead had the worse ending: it is a p5.js bundle that exists only
  on `demo.humlab.umu.se` (133-byte shell plus main.bundle.js), so it could be neither framed
  nor copied; a link-out was tried, and then removed too, because the app root
  `demo.humlab.umu.se/humlab-sead/` now 404s and the shell had nothing left to load. If the
  app comes back, the button markup and its URL are in `git show 655aceb`.
* The /rave poster is a frame grabbed at t=30 s. It shows the room, nobody objected, and it
  is not a chosen image. `src/pages/rave.html` carries the TODO; replacing
  `assets/rave+c-rave/rave-poster.jpg` under the same name is enough (60 kB, 1280x720).
* Language mode is now a URL tree, not a `span.sv` block: English pages live at `/route`
  and Swedish pages at `/sv/route`. The build rejects a route present in only one tree.
* `/ships` is reachable but not linked: it has no tile on the front page at all — the
  commented-out one that came over with the migration (pointing at an image that no longer
  existed) is deleted. Either finish the copy or delete the page.
* `/melody` lost its "Upptäck Melodys hemsida ▶" button in the same pass: on the old site it
  was `href=""`, i.e. it reloaded the page. Say the word and it can go to the umu.se page
  that /melody already links.
* `/enida` says "Read more about the project" and links newnatures.org, which redirects to a
  Greenhouse Book Talks page. The old link was a 404 path on the same domain; someone who
  knows the project should either name the right URL or drop the sentence.
* Contrast is now measured against the new palette: `#a54d16` on `#f6f3ec` is 5.2:1,
  `#5b6466` on `#f6f3ec` is 5.5:1 and white on `#0f5f68` is 7.2:1. The InfraVis chip is
  a solid light-plum border/text pair rather than white on a gradient.
* The `.mp4` on /visp has no captions (`<track>`), relevant under the Accessibility Act.
* 23 MB of images (down from 59 MB: `pngquant --quality=80-` + `jpegoptim --max=78`, applied
  in place, nothing resized). Most of what is left is still larger than it is drawn: 87% of
  the bytes used to render at <= 480 CSS px and only 1.4 MB at > 800 px, so resizing to 2x
  display width would save several more MB — at the cost of images you cannot zoom into.
  The generated `.webp` copies (see Build) are what a current browser actually downloads;
  the png/jpeg stay in `dist/` as the fallback, and 31 MB is the size of the tree, not of a
  visit.
* /visp's page logo is `assets/visp/visp_slogan_en.svg`; the tile on the front page still
  uses the old `assets/visp/VISP-logo-black.png`. Both are live, neither is dead — swapping
  the tile is a decision nobody has made yet, and until someone does, deleting either file
  breaks a page.
* Three "Explore application" buttons were removed because the apps behind them are gone:
  /enida, /staden and /yrkesrum (all three now answer the nginx default page with an empty
  body). /digibon was removed in the same sweep and put back: its 254-byte page is a shell
  embedding an ArcGIS Experience, i.e. a working map app whose HTML is thin on purpose —
  the screenshot on our /digibon page is a clip of that same map. The project pages still
  describe the work and link their umu.se pages. If a service is brought back, add the
  button again — see the note above.
  `/sead` (browser.sead.se) and the other buttons were checked and are live apps.
