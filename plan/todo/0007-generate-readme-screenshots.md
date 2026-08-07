# Generate the README screenshots automatically

**Owning ADR(s):** none — see "Why no ADR" below.
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

## Why no ADR

Deliberate, and worth stating because `plan/README.md` and the repo's
conventions otherwise expect a plan item to trace to a decision.

There is no product decision underneath this. It does not change what web-vault
does for an adopter, does not touch the CLI contract, the vault layout, or the
deploy substrate, and adds no capability. It is internal tooling that regenerates
one documentation asset. The nearest candidates were considered and rejected:
`adr/0042-brand-identity-and-logo.md` governs the mark itself, not the
documentation pipeline, and `adr/0041-automated-quality-gate-typecheck-and-tests.md`
is specifically about the verify gate — which this tool is explicitly *outside*
of, so owning it there would read as a contradiction.

If the DOM-contract question below turns into a stable set of automation
attributes, **that** deserves its own ADR. Not this.

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

- **Viewport `1180x820` CSS px at DPR 2** — an iPad Air, 2360x1640 device pixels.
  This is a **replicable starting point, not a requirement.** It reproduces the
  current asset's proportions; it is parametric and may be lowered later, with
  quality judged manually by the operator. Lowering it must not be treated as
  breaking anything.
- **Initial theme dark, set explicitly.** See the open question below — this is
  the one parameter that may need an app-side change to be settable at all.
- **Four frames, 2s each, uniform — including the last** before the loop
  repeats. Adjustable later if the pacing reads badly.
- Output APNG, written over the README asset, **versioned normally on `main`.**

### Navigation

The sequence is anchored to *structure* (a note type) rather than *content* (a
note name), so it does not break when the template renames a note:

1. Open a note of type **Trip** via "All notes"; press share. → frame 1
2. Scroll until **at least two map markers** are within the viewport, located in
   the DOM rather than by a fixed scroll distance. → frame 2
3. Open map view; open the side marker panel. → frame 3
4. Switch to light theme, close map view, scroll to top. → frame 4

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

## Findings that affect implementation

Two things were checked while queueing this, and both change what the work
involves. Neither is settled here.

**1. The theme is not settable.** The app reads
`matchMedia('(prefers-color-scheme: dark)')` directly
(`src/components/BlockEditor.jsx:10`, `src/components/Editor.jsx:10`) and
`src/styles.css` keys off the same media query. There is no `data-theme`
attribute and no persisted override. So "start dark, switch to light at frame 4"
cannot be driven from the page. Options, in preference order:

- Emulate the media feature at the browser level (Playwright's
  `colorScheme` / `emulateMedia`), switching it between frames. Requires **no
  app change** and is almost certainly sufficient — resolve this way if it works.
- Otherwise, an app-side theme override, which is a real product change and
  would need its own decision first.

**2. Markers are Leaflet-generated.** `src/components/MapView.jsx:170` creates
them via `L.marker(...)`, so they land in the DOM as Leaflet's own
`.leaflet-marker-icon` elements with no app-owned attributes. Counting those
classes works but couples the tool to Leaflet's internals. If a small `data-*`
attribute on the app's markers turns out to be the cleaner anchor, that is a
minimal change to note here when it happens — but a *general* contract of
automation attributes across the app is a separate decision, and out of scope.

## Exit criteria

1. `yarn screenshots --url <url>` regenerates the README asset end to end, with
   no argument beyond the URL required.
2. The command is absent from `yarn verify`, and `yarn verify` still passes from
   a bare clone with no server running and no browser downloaded.
3. Run twice against an unchanged vault, the four frames are visually the same
   sequence — theme, viewport and navigation are all reproducible rather than
   incidental.
4. Against a vault lacking the assumed structure, the tool exits non-zero with a
   message naming what was missing.
5. Viewport, DPR and frame interval are parameters with the documented defaults,
   changeable without editing the tool's logic.
6. The README renders the regenerated asset correctly on GitHub.
7. How the theme was driven (frame 1 dark → frame 4 light) is recorded, along
   with whether any app-side change was needed.
8. `yarn verify` green.
