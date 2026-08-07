# Generate the README screenshots automatically

**Owning ADR(s):** `adr/0042-brand-identity-and-logo.md`
**Dependencies:** none.

## Context

The README's hero image (`docs/screenshot.png`, referenced at `README.md:8`) was
produced by hand: three screenshots taken against the local
`../web-vault-template` vault, then assembled into an APNG with a 2s interval
using an online tool. Nothing about that is repeatable — not the viewport, not
the theme, not the navigation, not the frame timing. Refreshing the image after
a UI change means redoing the whole manual sequence and hoping it looks like the
last one.

This item makes that sequence a command.

The constraint that shaped the design: the tool must not drag an external
directory into this repo. `wv` resolves the vault as `process.cwd()/..`, which
is why `AGENTS.md` forbids running `wv build`/`wv dev` from this root. A
screenshot tool that *located* a vault would inherit the same problem. So it
does not: it takes a `--url` for a vault the operator has already started, and
knows nothing about where that vault lives.

## Why 0042 owns this

Queued with no owning ADR: at the time the work was only a tool that regenerated
a screenshot, and none of the catalogue governed a documentation pipeline.
`adr/0041-automated-quality-gate-typecheck-and-tests.md` was rejected outright —
it is about the verify gate, which this tool is deliberately *outside* of.

The shipped scope is wider than the queued one. It also puts the brand mark in
the README (`docs/logo.svg`, derived from `brand/mark.svg`) and defines how the
project presents itself at the top of its front page: mark, resolved colours,
and the hero animation beneath it. That is the surface
`adr/0042-brand-identity-and-logo.md` governs, so it owns this.

Note what that means for the derived asset: `docs/logo.svg` carries the same
geometry as `brand/mark.svg` with the colours resolved to literals, because
GitHub strips CSS variables and supplies no `currentColor`.

**This is a new drift surface, and 0042 does not cover it.** The ADR's
criterion 8 — "the favicon is emitted from the same source as the in-app mark,
so the two cannot drift" — is scoped to the favicon and the in-app mark, both
emitted from `brand/`. `docs/logo.svg` is a third copy, hand-maintained, and
nothing regenerates or checks it. The file carries a comment saying to keep it
in step, which is the weakest possible guarantee. Left as is deliberately (the
geometry has been stable and this is one README image), but if the mark is ever
redrawn, this is the file that will silently still show the old one. Emitting it
from `brand/mark.svg` at build time, the way the favicons already are, would
close it.

The tool itself still implies no product decision. If the DOM-contract question
above ever turns into a stable set of automation attributes, **that** deserves
its own ADR — this does not.

## Scope

A `yarn screenshots` script in this repo's `package.json`.

```
yarn screenshots --url http://localhost:5173 [--out docs/]
```

- **Not a `wv` subcommand.** `wv` is adopter-facing surface; this is not. A
  `package.json` script is by construction a command of this repo. It is not
  hidden or forbidden — it simply is not where adopters look.
- **`--out` defaults to `docs/`**, the directory the README already points at,
  so the bare command overwrites the right asset instead of writing somewhere
  arbitrary.
- **Driver is a `devDependency`** (Playwright or equivalent). Browser download
  stays an explicit, opt-in step — adopters must not pay an install cost for a
  tool only this repo runs.
- **Excluded from `yarn verify`.** Non-negotiable: `AGENTS.md` requires the gate
  to stay runnable from a bare clone + install, and this needs a live server and
  a real browser. Manual invocation only.

### Capture parameters

As shipped. Every one of these is a constant at the top of the script, not a
requirement — the operator judges quality by eye and moves them.

- **Viewport `1180x820` CSS px at DPR 1.5** — 1770x1230 device pixels. The
  viewport is an iPad Air; the scale lives in DPR precisely so it can be changed
  without altering what the app renders. (Lowering DPR keeps the reviewed layout;
  lowering the viewport changes it and needs a fresh look.)
- **Initial theme dark**, set through the browser rather than the app.
- **Five frames, 2s each, uniform including the last** before the loop repeats.
- Output **animated WebP at q75**, written over the README asset, **versioned
  normally on `main`**. See the compression section below for why not APNG.

### Navigation

The sequence is anchored to *structure* (a note type) rather than *content* (a
note name), so it does not break when the template renames a note:

1. Open a note of type **Trip** via "All notes"; open the share panel. → frame 1
2. Scroll until **at least two map cards** are within the viewport, located in
   the DOM rather than by a fixed scroll distance. → frame 2
3. Open map view; open the side marker panel. → frame 3
4. Switch to light theme, close map view, scroll to top. → frame 4
5. Narrow to a phone viewport, reload to reset navigation, open the nav
   drawer. → frame 5

### The brand mark in the README

Added late, and the reason this item traces to 0042.

`brand/mark.svg` cannot be used directly: its colours come from `currentColor`
and the `--wv-brand` custom property, both of which GitHub strips when it
sanitises SVG, leaving the mark half-invisible. `docs/logo.svg` is the same
geometry with `#3B82F6` and the connector grey written as literals — one file
that reads on both the light and the dark GitHub theme.

It sits **inside** the `h1` rather than floated above it with `align="left"`.
The float was the first attempt and was wrong: a floated image is out of flow,
so a mark taller than the heading overhangs the `h1`'s bottom border. Inline,
the line box grows to fit and no `hspace` or clearing is needed.

Verified against GitHub's own renderer rather than a local preview — the
markdown API returns the real HTML, which turned out to wrap the image in a link
and add an inline `max-height` that no mock reproduced:

```
curl -s -X POST https://api.github.com/markdown/raw \
  -H "Content-Type: text/plain" --data-binary @README.md
```

One consequence to know: the leading image makes the heading anchor
`#-webvault` instead of `#webvault`. Nothing in the README links to it.

### Vault compatibility

The tool assumes a vault with the template's structure — a "Trip" type, and a
note carrying a map with two or more markers. This is a **declared assumption,
not a hidden one**: when the structure is absent the tool fails with a message
naming what it looked for and did not find. It is a tool for regenerating *this*
README, not a generic capability of the framework.

## Out of scope

- Starting, building, or locating a vault. The operator runs it; the tool
  attaches to a URL.
- Any change to `yarn verify` or CI.
- A `wv` subcommand, or any adopter-facing surface.
- Hosting the asset anywhere other than `main` (an orphan `media` branch was
  considered and dropped — it does not reduce what the remote stores, it only
  makes deletion cheaper, which is not worth the indirection at this size).

## Findings that affected implementation

Two things were checked while queueing this. Both are now settled.

**1. The theme is not settable — resolved at the browser level.** The app reads
`matchMedia('(prefers-color-scheme: dark)')` directly
(`src/components/BlockEditor.jsx:10`, `src/components/Editor.jsx:10`) and
`src/styles.css` keys off the same media query. There is no `data-theme`
attribute and no persisted override, so the switch cannot be driven from the
page. Playwright's `emulateMedia({ colorScheme })` drives it from outside
instead: **no app change was needed**, and the app-side theme override — which
would have been a product change needing its own decision — was not.

**2. Markers are Leaflet-generated — sidestepped.** `src/components/MapView.jsx:170`
creates them via `L.marker(...)`, so they carry Leaflet's own classes. The tool
never counts those: the note's inline map cards render as links to the mapped
place (`src/components/MapCard.jsx:143`), so frame 2 finds them by role and href
instead. No `data-*` attribute was added, and the question of a general
automation-attribute contract stays out of scope and undecided.

## What was built, and why it ended up this way

The tool is `scripts/screenshots.mjs`, run as `yarn screenshots`. Playwright
drives Chromium; the browser binary is an explicit `yarn playwright install
chromium` step, so an adopter's install does not pay for it.

**Selectors are roles and visible text, never CSS classes.** This was a
deliberate constraint, and probing the live DOM rather than guessing caught
three things that would each have produced a wrong frame silently:

- Sidebar entries carry their note count in the accessible name (`"Trip\n1"`,
  with a newline), so name matching has to be an anchored regex, not `exact`.
- `Share` is a substring of the sidebar's `Shared`, so an unscoped lookup clicks
  the wrong control. Both are scoped to landmarks (`navigation`, `article`).
- The editor is lazy (`Suspense`), so an early screenshot catches skeleton bars.
  The frame waits on real rendered prose.

**Nothing is published.** Frame 1 opens the share sheet, which is pure UI — the
badge only toggles it. `onPublish`, which commits and polls a live URL for up to
four minutes, sits behind a separate button that is never pressed.

**Frame 2 searches the DOM rather than scrolling a fixed distance**, so the
note can grow or shrink without invalidating the tool.

**Frame 5 (phone layout) shares the canvas by construction.** Below 900px the
app switches to one panel at a time and the hamburger only exists while no note
is open, so the frame reloads the page to reset component state first — clearing
the hash was not enough, and left the previous note visible behind the drawer.
Its height is `820` CSS px, the same as the desktop frames, so at one shared DPR
both land on 1230 device px and the phone shot is centred on black with **no
scaling**. Picking the height to match up front avoided resampling entirely.

### The compression route, and the dead ends

The first working version was an APNG hand-written in `scripts/apng.mjs` (since
deleted), reusing each frame's compressed data verbatim. It worked, but at DPR 2
cost 2.8 MB. Lowering DPR to 1.5 brought it to 1.87 MB at a visible quality
cost — and that was the wrong lever. What followed was measured, not guessed:

| approach | result |
|---|---|
| zlib tuning (L9, memLevel, `Z_FILTERED`) | **2.3% — worthless.** Playwright already compresses well; there is no configuration that recovers anything here. |
| `oxipng -o max`, lossless | 2.8 → 2.5 MB (−11%). Real but not enough. |
| 256-colour palette | 2.8 → 1.0 MB (−64%). The UI frames quantise well (~2000 unique colours); the map and photo frames do not. |
| palette **inside** an APNG | **Broke.** APNG allows one global `PLTE`; per-frame palettes render frames 2+ blank. Quantising the frames stacked together yields a valid shared palette, but splitting the stack afterwards breaks PNG's row-to-row filter chain and the output is corrupt. |
| **lossy WebP** | **The answer.** |

APNG cannot carry JPEG data — it is PNG, deflate over filtered rows, and no
chunk holds anything else. Animated WebP is the format that does what "JPEG in
an APNG" was reaching for: lossy compression, animated, and rendered by GitHub.

At q75 the five frames cost **299 KB at 1770×1230** — against 2120 KB for the
hand-made asset it replaces, and less than any PNG route managed at any
resolution. The quality-versus-size tradeoff that drove several rounds of
DPR-lowering turned out not to exist once the compression was right.

One trap worth recording: `img2webp` **re-encodes pre-compressed `.webp` inputs
losslessly**, landing at roughly five times the size. The PNGs are handed to it
directly with `-lossy -q`, so compression happens exactly once.

### Accepted cost: a system binary

`img2webp` ships with libwebp and is not on npm. The brief asked for
npm-installable tooling; no adequate wrapper exists, and the decision was to
keep it simple rather than build around the gap. The tool therefore checks for
the binary **before** launching the browser — a missing dependency fails in a
second instead of after minutes of navigation — and prints the install line for
macOS and Debian. Anyone regenerating the asset from a fresh clone must install
libwebp by hand. This is the one requirement in the original scope that was
consciously not met.

## Exit criteria

1. `yarn screenshots --url <url>` regenerates the README asset end to end, with
   no argument beyond the URL required. ✅
2. The command is absent from `yarn verify`, and `yarn verify` still passes from
   a bare clone with no server running and no browser downloaded. ✅ 242 tests,
   18 files, green with no browser involved.
3. Run twice against an unchanged vault, the frames are visually the same
   sequence — theme, viewport and navigation are all reproducible rather than
   incidental. ✅
4. Against a vault lacking the assumed structure, the tool exits non-zero with a
   message naming what was missing. ✅ Both the missing-`Trip` and the
   too-few-map-cards paths name what they looked for.
5. Viewport, DPR and frame interval are parameters with the documented defaults,
   changeable without editing the tool's logic. ✅ Plus quality and output name.
6. The README renders the regenerated asset correctly on GitHub. ✅ Reference
   and alt text both updated — the alt text was rewritten rather than
   re-pointed, since it described a single static view and the asset is now a
   five-step walkthrough.
7. How the theme was driven (frame 1 dark → frame 4 light) is recorded, along
   with whether any app-side change was needed. ✅ Browser-level
   `emulateMedia`; no app change.
8. The brand mark renders correctly at the top of the README on both GitHub
   themes, without overhanging the heading. ✅ Checked against GitHub's own
   markdown renderer, light and dark.
9. `yarn verify` green. ✅
7. How the theme was driven (frame 1 dark → frame 4 light) is recorded, along
   with whether any app-side change was needed.
8. `yarn verify` green.

---

**Shipped:** 2026-08-07 · commit `6e78697` · ADR 0042 (already Implemented; this
adds the README's use of the mark, no status change). Untagged: no
adopter-facing change, no version bump. Requires libwebp (`img2webp`) on the
machine that regenerates the asset.
