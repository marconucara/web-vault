# The map's sidebar toggle lands in the wrong corner on first render

**Owning ADR(s):** `adr/0028-google-maps-places.md` (acceptance criterion 4 —
"a headings filter"; no ADR change, this is a defect against it).

## The defect

Entering map view, the headings-sidebar toggle renders in the **top-left** of
the map, overlapping Leaflet's zoom control, and the sidebar panel itself is
faintly visible there too — displaced from its docked right edge. Opening the
sidebar puts everything right: the panel docks right, the toggle sits top-right,
and it stays correct thereafter. So the wrong state is the initial one only, and
it corrects itself on the first interaction.

The CSS is not the bug. `.mapview-panel-toggle` is `position: absolute; top:
12px; right: 12px` and `.mapview-panel` is `top/right/bottom: 0` — both correct,
both in `src/styles.css:757` and `:778`, and both are what the corrected state
shows. What is wrong is what those offsets resolve **against** at the moment of
the first paint: `.mapview` is `position: relative` and `flex: 1 1 auto`
(`src/styles.css:735`), so before the flex row has settled its widths its
containing block is not yet the map's final box. `right: 12px` measured against
a not-yet-final box is a left-ish position.

## Scope

Find why the first paint measures a stale box, and fix it so the toggle and the
panel are in their docked position on the very first frame — no flash, no
correction on interaction.

Candidates to check, in order (the first that holds ends the investigation):

- The note-list pane's open/close transition still animating when `.mapview`
  mounts, so the flex row's widths are mid-animation at first paint.
- Leaflet's `invalidateSize`/`whenReady` timing: if the map is initialised
  against a zero- or stale-width container, a re-layout follows and the absolute
  children paint once against each box.
- The toggle briefly rendering inside a different positioned ancestor (a Leaflet
  control container or a wrapper without `position: relative`) before it is
  moved.

Fix at the cause. A `setTimeout` nudge, or hiding the controls until "settled",
would trade a visible defect for an invisible one.

## Exit criteria

1. On entering map view, the sidebar toggle paints in the map's top-right corner
   and never overlaps Leaflet's zoom control, from the first frame.
2. The closed sidebar panel is not visible at any point before it is opened.
3. Entering map view with the note-list pane open, closed, and mid-transition
   all give the same result.
4. The same holds after a window resize and after toggling out of and back into
   map view.
5. Opening and closing the sidebar still works exactly as before, and the map
   still pans by `[120, 0]` so a selected pin clears the open panel
   (`src/components/MapView.jsx:126`).
6. `yarn verify` green.

## Notes

Purely presentational — no ADR revision, no markdown or resolver surface
touched. Independent of `plan/todo/0002-*.md`; either may ship first.
