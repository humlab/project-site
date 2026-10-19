# Humlab Showcase

`showcase.humlab.umu.se` — static pages about current and completed Humlab projects.

Plain HTML, one stylesheet, no JavaScript, no frameworks, no npm dependencies.
The previous version was an Angular 11 + Ionic app whose 28 components contained zero
dynamic behaviour; the machinery was only a source of breakage (see git history).

## Build

```sh
node build.mjs        # writes dist/, and validates everything below
```

`build.mjs` assembles `src/pages/*.html` (body fragments only) with
`src/partials/{head,header,footer}.html`, copies `src/assets` and `src/styles.css`, and
**fails without writing dist/** if a page has:

* a missing or empty `src`/`href`/`srcset`/`poster` (any quoting style, any attribute case),
  a directory where a file belongs, a `http://https://` URL, or a scheme with no host
* a raw `<` in copy (write `&lt;`), which a browser would turn into a tag
* `index.html` or `404.html` missing — a green build with no front page is possible
* an `http://` link to a host that is not in `HTTP_ONLY` (hosts with no working TLS)
* an `<img>` without `alt`, a `target="_blank"` without `rel="noopener"`
* attributes glued together or duplicated (e.g. two `class=`), unbalanced tags
* no `<h2>` to derive `<title>`, `og:title` and `og:description` from

Warnings that need a human: unused assets (with size), images without `width`/`height`,
and leftover template copy such as "Insert text here".

`<title>`/`og:` text comes from each page's `h2` (a `<br>` inside it becomes " – ").
`<html lang>` comes from a `SWEDISH` set in `build.mjs`; `node tools/lang.mjs` prints how
Swedish each page's text is so the set can be re-derived when pages change.

Fonts are self-hosted (`src/assets/fonts`, latin subset): the site makes no request to any
third party, so no visitor IP leaves the server and the typography survives Google being
down or blocked. Re-add a `fonts.googleapis.com` `<link>` and CSP entry only if you prefer not to.

Prompt is served at **weight 100, one face**, because that is all the original `@import`
requested (`Prompt:ital,wght@0,100;1,300`). Everything thin you see is that single face, and
the handful of `font-weight: bold` rules are the browser faking an outline around it. Serving
400 and 700 instead — which is what an earlier commit here did, reasonably enough — makes
those rules mean what they say, and the site comes out bolder than the one it replaced. That
is the whole explanation for "the old page is lighter": not a different font, the same font
with weights it never had. If the fake bold bothers you more than the boldness, lower those
five declarations to 400 (listed in the `@font-face` comment) rather than adding weights.

What the checker does *not* do: tag balance is a count, so a `<p>` misnested inside another
element that the browser repairs differently is out of scope, and `a<b and c>` in copy is
indistinguishable from markup — that is why raw `<` is a failure.

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

## Checking a change

```sh
node build.mjs
npm i --no-save --no-package-lock playwright && npx playwright install chromium
node tools/smoke.mjs http://127.0.0.1:8099                # every page, two viewports
node tools/links.mjs                                      # needs network
```

`tools/smoke.mjs` loads every built page in headless Chromium and reports console errors,
failed requests, non-200 responses, CSP violations, and whether `/404.html` stays non-200.
It exits non-zero and can gate a deploy. Against a bare static server it can only prove the
pages load. One report is tolerated: `ikt.humlab.umu.se`, whose mp4 `/rave` hotlinks, is not
our server, so a failure there is counted but does not fail the gate. Anything else does —
including an embed that passes CSP and is still blank because the other server answers
`X-Frame-Options: deny`, which is the bug that started all this (see Known issues).

`tools/links.mjs` requests every outbound link, because HTTP 200 is not proof of life:
three of the project's own apps answered 200 with `Welcome to nginx!` and one with a
254-byte empty page. Those are reported as `hollow` and it exits non-zero, so it can gate a
deploy, retrying a failure once before reporting it. A `timeout` from one container is not
proof of death either (some hosts filter
unusual clients) — check from somewhere else before deleting a link because of it.

## Adding or changing a project page

1. Add `src/pages/<route>.html` containing the body only (copy an existing page:
   `h2.sub-header` + `div.main-container` + left/right containers). The file name becomes
   the URL (`/sead`), the `<h2>` becomes the page title.
2. Link it from the front page: `<a href="<route>">` in `src/pages/index.html` is rewritten
   to a relative link at build time, and the checker fails if the route does not exist.
3. Put images in `src/assets/<route>/` with `width`/`height` attributes (the build warns
   about images that lack them) and `loading="lazy"` unless they are above the fold.
4. Styles: `src/styles.css`, plain CSS with custom properties at the top — no
   preprocessor, the old `.scss` files were flat enough not to need one.

## Deploy

There are two ways to serve `dist/` and they are not interchangeable. nginx is what
production uses.

**nginx.** `nginx.conf` is the server block (`/etc/nginx/conf.d/default.conf` in the stock
nginx image — TLS, HTTP/2 and HSTS belong to the front proxy that hands it
`unix:/socket/nginx.sock`). The canonical URLs, the security headers, the cache map and the
404 page live in that file: without it `/sead` is a 404 and there is no CSP.

```sh
node build.mjs && node tools/links.mjs
rsync -a --delete dist/ <host>:/usr/share/nginx/html/
```

Keep `dist/` as the rsync source: pointing it at the repo root would ship `.git` (118 MB)
and `--delete` the rest of the web root.

Before believing a deploy, check what the front proxy already sends. The current deployment
adds `Referrer-Policy`, `nosniff`, `X-Frame-Options` and HSTS on its own, so this block can
end up sending a second `Referrer-Policy` (last value wins). Keep one side, not two.

**Locked-down container** (`deploy/`). A `scratch` image running busybox `httpd`: one
process, no shell, read-only, 64 MB. `build.mjs` writes a second copy of every page as
`<route>/index.html` with root-absolute refs precisely so this server can answer `/sead`
(it 302s to `/sead/` by itself and serves the index) — without that, the minimum container
404s on every canonical URL. What it still cannot do, measured with the real 1.37 binary:
send any header (no CSP, no cache, no nosniff), serve a custom 404 page, gzip, keep-alive,
or learn that `.woff2`/`.mp4` have MIME types (no working `httpd.conf` syntax for it; they
go out with no `Content-Type`). Browsers cope; a front proxy that adds `nosniff` would not.
The nginx config is the only place the security policy exists.

```sh
deploy/run.sh        # node build.mjs, then build + start the container on 127.0.0.1:9712
```

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
  relative so `dist/` also works from a directory or the filesystem.
* `script-src 'none'`: the site has no JavaScript, so an injected script cannot run. When
  you add an embed, extend `frame-src` and re-run `tools/smoke.mjs`.
* Heading metrics and the invisible `<hr>` are ported literally from Ionic's normalize
  (see `git log`), because the design was spaced around them.
* `assets` are cached 30 d but not `immutable`: files are replaced by hand under the same
  name, and `immutable` would strand visitors on the old copy for a year.

## Known issues (pre-existing; the build warns so they are not forgotten)

* `src/pages/ships.html` still contains scaffolding: "Insert text here" twice, two empty
  image boxes, and a YouTube embed belonging to another project. It needs copy from Humlab.
* Two embeds could not render at all and were replaced. /rave's video is the good ending:
  `ikt.humlab.umu.se` answers `X-Frame-Options: deny`, but media loads are not governed by
  that header, so a `<video>` plays their file and the 70 MB stays on their server. The SEAD
  image sphere on /infravis-sead had the worse ending: it is a p5.js bundle that exists only
  on `demo.humlab.umu.se` (133-byte shell plus main.bundle.js), so it could be neither framed
  nor copied; a link-out was tried, and then removed too, because the app root
  `demo.humlab.umu.se/humlab-sead/` now 404s and the shell had nothing left to load. If the
  app comes back, the button markup and its URL are in `git show e6eb379`.
* The seven clearly Swedish pages set `lang="sv"`. Mixed ones (`staden` ~0.65 Swedish,
  `rave`, `westac`, `linguistic-landscape`, `digitalamodeller`, `queer-ai`) still inherit
  `lang="en"` with `span.sv` blocks, which is correct only if those spans all carry `lang`.
* `/ships` is reachable but not linked: its front-page tile was already commented out
  before the migration (and pointed at an image that no longer exists). Either finish the
  copy or delete the page.
* `/melody` lost its "Upptäck Melodys hemsida ▶" button in the same pass: on the old site it
  was `href=""`, i.e. it reloaded the page. Say the word and it can go to the umu.se page
  that /melody already links.
* `/enida` says "Read more about the project" and links newnatures.org, which redirects to a
  Greenhouse Book Talks page. The old link was a 404 path on the same domain; someone who
  knows the project should either name the right URL or drop the sentence.
* Contrast: white on `--accent-2` (#c95100) sits at ~4.4:1, and the `.infravis` tag label
  is white on a yellow-red gradient. Public-sector WCAG wants 4.5:1 for body text.
* `https://sweclarin.se/` (linked from /visp) answers with an **expired certificate**, so a
  browser refuses it. That is their server to fix — keep the link, chase the renewal, and
  drop the link only if it stays broken. `tools/links.mjs` reports it as
  `unreachable (CERT_HAS_EXPIRED)`.
* The footer still uses the Twitter bird for `x.com/humlab`.
* The `.mp4` on /visp has no captions (`<track>`), relevant under the Accessibility Act.
* 23 MB of images (down from 59 MB: `pngquant --quality=80-` + `jpegoptim --max=78`, applied
  in place, nothing resized). Most of what is left is still larger than it is drawn: 87% of
  the bytes used to render at <= 480 CSS px and only 1.4 MB at > 800 px, so resizing to 2x
  display width would save several more MB — at the cost of images you cannot zoom into.
  WebP q80 measured 7.5 MB, but every page would need `<picture>` with a fallback.
* Three "Explore application" buttons were removed because the apps behind them are gone:
  /enida, /staden and /yrkesrum (all three now answer the nginx default page with an empty
  body). /digibon was removed in the same sweep and put back: its 254-byte page is a shell
  embedding an ArcGIS Experience, i.e. a working map app whose HTML is thin on purpose —
  the screenshot on our /digibon page is a clip of that same map. The project pages still
  describe the work and link their umu.se pages. If a service is brought back, add the
  button again — see the note above.
  `/sead` (browser.sead.se) and the other buttons were checked and are live apps.
