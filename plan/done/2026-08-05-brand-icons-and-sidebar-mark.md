# Ship the brand identity: icons, favicon, manifest and the sidebar mark

**Owning ADR(s):** `adr/0042-brand-identity-and-logo.md`
**Dependencies:** None

## Context

The brand artwork settled by `adr/0042-brand-identity-and-logo.md` r3 has been
produced with an external design tool: a monoline geometric mark, a connecting
path framed by angular delimiters, `#3B82F6` as the only saturated value. The
deliverable is a complete icon set — one SVG source plus rasters rendered from
that same geometry — with an `ASSETS.md` describing each file's role.

This item places that set into the product as browser and platform icons —
favicon, Safari pinned tab, iOS touch icon, PWA manifest icons — and, once those
were verified in a browser by the owner, as the **sidebar brand mark**, which
replaces the plain `Vault` text with the mark followed by the wordmark
`WebVault`.

The sidebar mark was deliberately not in the first cut of this item: ADR 0042
asks for the artwork to be settled and reviewed before the placements, and that
review is a judgement made by looking. It was added within the same item after
the owner confirmed the icons render correctly.

### Where the files have to go, and why

The build resolves two different roots (`scripts/paths.mjs`):

- Vite's `root` is the **package** — so `index.html`, which carries the
  `<link rel="icon">` tags, is this repo's file.
- Vite's `publicDir` is the **consumer's** `.web/public` — an adopter override
  surface, not a place the framework can ship its own assets from.

So icons cannot simply be dropped in a `public/` here; there is no such folder
and Vite would not read it. The precedent for framework-owned static output is
`build-headers.mjs`: boilerplate identical for every vault, owned by the
package, emitted into `dist/` after `vite build`, and skipped when the consumer
ships their own copy in `public/`. `build-404.mjs` and `generate-worker.mjs`
follow the same shape. The icons are the same category of artefact, so they take
the same route.

`wv dev` needs its own path: the dev server never runs the copy step and its
`publicDir` is the consumer's, so a `<link href="./favicon.ico">` would fall
through to the SPA. `attachmentsDev()` in `lib/vite-config.mjs` is the existing
pattern for serving package-side files in dev.

One constraint the head tags must respect: `base: './'`, so the `<link>` hrefs
are written **relative** (`./favicon.svg`), not absolute as `ASSETS.md` shows.
`site.webmanifest`'s internal `src` values stay root-absolute — a manifest is
resolved against its own URL and the deploy is root-hosted.

## Scope

- Commit the icon set into the package under `brand/`, and add `brand` to
  `package.json` `files` so it ships to adopters:
  `favicon.svg`, `favicon.ico`, `favicon-mono.ico`, `apple-touch-icon.png`,
  `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
  `safari-pinned-tab.svg`, `mark.svg`, `mark-mono.svg`, `site.webmanifest`,
  and the authoring notes from `ASSETS.md`.
- Add `scripts/copy-brand.mjs`: copies `brand/*` into `dist/`, skipping any file
  the consumer already shipped via their `public/` (which `vite build` copied in
  first). Wire it into `wv build` in `bin/wv.mjs`.
- Add a `brandDev()` middleware to `lib/vite-config.mjs` serving the same files
  from `brand/` at their production URLs, so `wv dev` matches the build.
- Add the icon `<link>` tags and `theme-color` to `index.html`, with SVG-capable
  browsers taking `favicon.svg` and the rest stopping at `favicon.ico`.
- Set the app `<title>` to `WebVault` (currently `Vault`), matching the product
  name fixed by ADR 0042 criterion 9.
- Give the shared pages and the 404 the icon too, each by the only route
  Cloudflare Access leaves open (the site root is Restricted, `/shared/*` is on
  a Bypass): the share pages link `../favicon.svg`, backed by **one** copy that
  `copy-brand.mjs` places at `dist/shared/favicon.svg` and mirrors from whichever
  root copy won; the 404 inlines the mark as a `data:` URI read from
  `brand/favicon.svg`, because it answers unmatched paths at any depth and no
  relative href works for all of them.
- Replace the sidebar's plain `Vault` text with the mark plus the wordmark
  `WebVault` (`src/components/BrandMark.jsx`, drawn from `brand/mark.svg`), and
  add `--wv-brand` to `src/styles.css`. The mark's ink is `currentColor` and
  only its accent is fixed, so one drawing covers both themes.
- Keep `webvault-brand.jsx` as a design reference at
  `adr/assets/0042-brand-components.jsx` — not imported by `src/`, not built.
- Tests: `copy-brand.mjs` copies the full set, and the consumer's `public/`
  version of a file wins over the package's.
- ADR 0042 r4: close the first open question — the raster set is committed,
  pre-rendered from the same SVG geometry, not generated at build time. Status
  stays `Accepted`; the in-app mark is still unbuilt. Regenerate `INDEX.md`.

## Out of scope

- Any UI surface beyond the sidebar brand row: no mark in the app chrome, no
  About screen, no coloured surfaces. `--wv-brand` inks the mark and nothing
  else, and the existing `--accent` usage (links, selection, active row) is
  untouched — that is how criterion 7 stays satisfied.
- Generating rasters from the SVG at build time. The set is committed
  pre-rendered; ADR 0042 explicitly puts automated raster production out of
  scope, and a build-time rasteriser would add an image dependency to a gate
  that must run from a bare clone.
- Wiring the manifest as an installable PWA (service worker, offline). The
  manifest ships for its icons and naming only.
- A `favicon-mono.ico` / `mark-mono.svg` consumer switch. Both files ship for
  the documented cases; nothing selects between them yet.

## Exit criteria

1. `brand/` holds the full asset set, and `package.json` `files` includes it.
2. `wv build` emits every icon plus `site.webmanifest` into `dist/`, at the URLs
   `index.html` references.
3. A consumer file in `public/` with the same name survives the copy step
   unmodified; both directions have a test.
4. `wv dev` serves the same icons at the same URLs as a build.
5. `index.html` carries icon, touch-icon, mask-icon and manifest links with
   `base: './'`-correct relative hrefs, and the title reads `WebVault`.
6. Shared pages and `404.html` carry the favicon, and both work from a plain
   static server as well as from `wv dev`. `dist/shared/` holds exactly one
   `favicon.svg`, not one per share.
7. The sidebar shows the mark followed by `WebVault`, correct in both themes
   from a single drawing, and no ADR identifier appears in any user-visible
   string or asset.
8. ADR 0042 has an r4 row closing the raster question and recording the
   Access-driven copies, status `Implemented`; `INDEX.md` regenerated.
9. `yarn verify` green.

## Outcome

All nine criteria met. Verified beyond the gate by building a throwaway vault
outside this repo and serving the result: every icon lands in `dist/` with the
right MIME and byte size, the share page's `../favicon.svg` resolves against a
plain static server, and an adopter's `public/favicon.svg` survives the copy
while the rest of the set still arrives. The same URLs were then checked against
a live `wv dev`, which is what the brand-dev middleware exists for.

Two judgements worth carrying forward. The share pages could not simply link the
root icon: `/shared/*` is the only Access-bypassed prefix, so the icon had to be
duplicated once inside it — and the 404, served for unmatched paths at any
depth, could use neither copy and inlines the mark instead. And the sidebar row's
top padding dropped from 6px to 2px, because at 40px the mark is taller than the
line box and supplies that space itself.

Coverage: 68 → 70 tests.

**Shipped:** 2026-08-05 · HEAD (see the follow-up commit) · ADR 0042 (r4,
`Accepted` → `Implemented`)
