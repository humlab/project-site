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

* a missing or empty `src`/`href`, a directory where a file belongs, or a `http://https://` URL
* an `http://` link to a host that is not in `HTTP_ONLY` (hosts with no working TLS)
* an `<img>` without `alt`, a `target="_blank"` without `rel="noopener"`
* attributes glued together or duplicated (e.g. two `class=`), unbalanced tags
* no `<h2>` to derive `<title>`, `og:title` and `og:description` from

Warnings that need a human: unused assets (with size), images without `width`/`height`,
and leftover template copy such as "Insert text here".

`<title>`/`og:` text comes from each page's `h2` (a `<br>` inside it becomes " – ").

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
npm i -D playwright && npx playwright install chromium    # dev-only, not a dependency
node tools/smoke.mjs http://127.0.0.1:8099
```

It loads every built page in headless Chromium and reports console errors, failed
requests, non-200 responses, CSP violations, and whether `/404.html` stays non-200. Run
it against nginx — against a bare static server it can only prove the pages load. Two
reports are expected and are not our bug: `demo.humlab.umu.se` and `ikt.humlab.umu.se`
answer `X-Frame-Options: deny`, so those two embeds are blank (see Known issues).

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

`dist/` is the entire artefact; `nginx.conf` is the server block
(`/etc/nginx/conf.d/default.conf` in the stock nginx image — TLS, HTTP/2 and HSTS belong
to the front proxy that hands it `unix:/socket/nginx.sock`).

```sh
node build.mjs
rsync -a --delete dist/ <host>:/usr/share/nginx/html/
```

Keep `dist/` as the rsync source: pointing it at the repo root would ship `.git` (95 MB)
and `--delete` the rest of the web root.

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
* Two embeds cannot render anywhere: `demo.humlab.umu.se/seadimagesphere/` (infravis-sead)
  and `ikt.humlab.umu.se/RAVE/Video/VR-vid.mp4` (rave) send `X-Frame-Options: deny`. Host
  the media or link out instead of framing.
* `enida`, `staden` and `yrkesrum` `.humlab.umu.se` have no working TLS, so their Explore
  buttons are `http://` on purpose (`HTTP_ONLY` in `build.mjs`).
* Seven pages are mostly Swedish but inherit `<html lang="en">`; only `span.sv` blocks are
  marked. Screen readers read Swedish with an English voice until those pages set `lang`.
* Contrast: white on `--accent-2` (#c95100) sits at ~4.4:1, and the `.infravis` tag label
  is white on a yellow-red gradient. Public-sector WCAG wants 4.5:1 for body text.
* The footer still uses the Twitter bird for `x.com/humlab`.
* The `.mp4` on /visp has no captions (`<track>`), relevant under the Accessibility Act.
* 58 MB of screenshots: a WebP/`srcset` pass is the next real perf win.
