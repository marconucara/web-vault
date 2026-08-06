# Move the build chip's tooltip off native `title`

**Owning ADR(s):** `adr/0012-build-version-chip.md`
**Dependencies:** None — the tooltip it adopts already shipped with `0038`.

## Context

`0038` r7–r9 gave the version indicator an in-app tooltip (`.tt` + `.tt-up` +
`data-tip`, `src/styles.css`) because the native `title` was not good enough
there: it is slow to appear, unstyled, and positioned by the browser. The two
sit side by side in the status bar, and the build chip next to it still uses
native `title` (`src/components/StatusBar.jsx`), so hovering one and then the
other gives two different tooltips in the same corner of the same bar.

This was anticipated rather than overlooked — the comment on `.tt-up` already
records that "the other status-bar items still use native `title` and are meant
to move onto this". This item is that move, for the build chip.

## Scope

- Swap the build chip's `title` for the same `.tt tt-up` + `data-tip` mechanism
  the version indicator uses. No new tooltip component, no CSS variant beyond
  what the multi-line point below requires.
- **The one non-mechanical part:** the build tooltip is two lines — commit line,
  then `builtAt` — while `.tt::after` sets `white-space: nowrap`, which would
  collapse it onto one. A `\n` in `data-tip` does not render as a break the way
  it does in `title`. So the shared tooltip needs to allow a multi-line tip
  (e.g. `white-space: pre-line` on a modifier, or on `.tt` generally if nothing
  else depends on the collapse). Decide which, and keep the version indicator's
  single-line rendering unchanged either way.
- Keep the accessible name intact. The chip is a link with an icon and a short
  SHA; whatever the tooltip carries must still reach a screen reader, as
  `VersionIndicator` does with `aria-label`.

## Out of scope

- The remaining native `title` attributes in the status bar (the commit-list
  rows at `StatusBar.jsx` ~145–158, the sync/uncommitted items). Same eventual
  direction, but they are inside the commit popover and each needs its own
  positioning decision; doing them here would widen this past one change.
- Any change to what the tooltip *says*, to the chip's link target, or to the
  build metadata itself.

## Exit criteria

1. Hovering the build chip shows the in-app tooltip, not the browser's, matching
   the version indicator's appearance, delay, and upward direction.
2. Both lines of the tip render as two lines.
3. The version indicator's tooltip is visually unchanged.
4. The chip's accessible name still carries the commit and build time.
5. `yarn verify` green, with a test asserting the chip carries the tooltip
   classes and `data-tip` rather than `title`.

## Outcome

The chip is now `.sb-build tt tt-up tt-multi` with `data-tip`, matching the
version indicator beside it.

**The multi-line question, resolved as a modifier.** `.tt-multi::after` sets
`white-space: pre-line`, rather than relaxing `nowrap` on `.tt` itself — the
other `.tt` users (the three `note-hbtn` header buttons, and the version
indicator) are all single-line and rely on the collapse, so a global change would
have put criterion 3 at risk for no gain. The rule is declared after `.tt::after`,
which at equal specificity is what makes `pre-line` win; that ordering was
checked rather than assumed, since getting it backwards would have failed
silently with the two lines merged.

Worth recording for the next item that adopts this tooltip: a newline in
`data-tip` is **not** equivalent to one in `title`. `title` breaks on it, but
`data-tip` reaches the page through `content: attr()`, where a newline is
collapsed like any other whitespace unless the element opts into `pre-line`.

**The accessible name.** The chip's only visible text is the short SHA, so
`aria-label` carries the same two-line tip, as `VersionIndicator` does — the
commit and build time were previously reaching a screen reader via `title` and
would otherwise have been lost in the swap.

**Two existing tests were stale and were corrected, not deleted.** Both matched
`<a class="sb-build"` exactly, which no longer matches now that the class list
grew, and one asserted in a comment that the chip "is still a native `title`" —
the very thing this item changes.

The four new tests were verified to fail against the pre-change component
(reverted to `title` + the bare class: 3 of them failed, the fourth covers tip
text that did not change), so they assert the new behaviour rather than passing
vacuously.

238 -> 242 tests. `yarn verify` green.

**Not verified in a browser.** There is no browser tooling in this repo, so the
rendered bubble — its position, the delay, the visible line break — was confirmed
by construction (shared classes with an indicator already verified in a browser
under `0038` r7–r9, plus the cascade check above) rather than by looking at it.
The mechanism is shared and the assertions are on markup and CSS order; a glance
at the running app would still be the thing that closes it fully.

---

Shipped at HEAD `dbf1028` — see the commit for the exact tree.
