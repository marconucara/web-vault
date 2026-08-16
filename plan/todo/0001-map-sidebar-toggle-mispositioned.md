# The map's sidebar toggle lands in the wrong corner

**Owning ADR(s):** `adr/0028-google-maps-places.md` (acceptance criterion 4 —
"a headings filter"; no ADR change, this is a defect against it).

## The defect

Entering map view, the headings-sidebar toggle renders in the **top-left** of
the map, overlapping Leaflet's zoom control, instead of docked to the top-right.
Opening the sidebar puts everything right, and it stays right thereafter — which
made it look like a first-render timing problem.

## The cause — a cascade collision, not a timing one

Found by measuring the real stylesheet in a browser rather than reasoning about
it: the toggle computes to `position: relative`, so `top`/`right` never anchor
it and it stays in the flow at the map's top-left, over the zoom control.
Measured at viewport 1400 with the note column at 420: `x: 408` before the fix,
`x: 1356` — the docked corner — after.

Two rules of equal specificity, and the later one wins:

- `src/styles.css:757` — `.mapview-panel-toggle { position: absolute; top: 12px; right: 12px }`
- `src/styles.css:943` — `.tt { position: relative }`, the tooltip class the
  button also carries, declared so `.tt::after` has a containing block.

Nothing to do with the first frame, with flex settling, or with Leaflet: the
state is wrong permanently and only *looks* transient because opening the
sidebar swaps the toggle for the panel — and `.mapview-panel` carries no `.tt`,
so it was always docked correctly. What peeks out at the left in the report is
the toggle itself, not a displaced panel.

The repo had already hit this exact collision once: `.scope-toggle.tt {
position: absolute }` (`src/styles.css:299`) exists for the same reason, with
the same comment.

## The fix

Re-assert the position at the combined specificity, as `.scope-toggle` does:

```css
.mapview-panel-toggle.tt { position: absolute; }
```

## Exit criteria

1. On entering map view, the sidebar toggle paints in the map's top-right corner
   and never overlaps Leaflet's zoom control. ✅ verified in a real browser
   (Playwright, against `src/styles.css`): the toggle's right edge lands 12px
   inside the map and computes `position: absolute`.
2. The closed sidebar panel is not visible before it is opened. ✅ `.mapview-panel`
   was never affected; measured docked at the map's right edge both before and
   after.
3. Opening and closing the sidebar works exactly as before, and the map still
   pans by `[120, 0]` so a selected pin clears the open panel
   (`src/components/MapView.jsx:126`). ✅ untouched — the change is one CSS
   declaration.
4. A regression test guards the cascade, generalised beyond this one control:
   any class positioned absolutely and used together with `.tt` in a component
   must re-assert it, else the test names the offender. jsdom resolves no
   layout, so the test reads the stylesheet — precedent is
   `src/lib/headingAnchors.test.jsx:205`. ✅ in `src/components/mapView.test.jsx`;
   confirmed to fail without the fix.
5. `yarn verify` green. ✅ 537 tests, 40 files.

## Notes

Purely presentational — no ADR revision, no markdown or resolver surface
touched. Independent of `plan/todo/0002-*.md`.

Awaiting Marco's own check in the running app before commit.
