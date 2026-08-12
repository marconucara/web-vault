# A control with its popover open drops its tooltip

**Owning ADR(s):** `adr/0038-in-app-upgrade-notice.md` (criterion 11, the
indicator's tooltip and its placement)

## Context

With the upgrade panel open, hovering — or simply staying on — the version
button that opened it raises the button's own tooltip on top of the panel. Two
layers say overlapping things about the same subject, and the transient one
covers the durable one.

The tooltip is not wrong to exist. The version indicator carries it under
`adr/0038-*.md` AC11: the running version, whether an update is available, and
when the last successful check happened. That is the right content for a resting
chip. But the panel is the expanded form of the same answer — it names the new
version and offers the action — so while it is open the bubble is at best a
duplicate and in practice an occlusion, since `.tt-up` opens upward from the
status bar into exactly the space the panel occupies.

The pointer is very likely to be there. The adopter just clicked that button to
open the panel, so the pointer is resting on it when the panel appears; the
tooltip's 300ms delay then fires without any further movement. The bad state is
the default one, not an edge case.

`src/styles.css` records the same class of problem twice already — line 728
notes a tooltip that rendered under a map, and the `.tt-up` comment exists
because a downward bubble fell off the bottom of the viewport. Both were fixed
per-site. This one is not a placement problem: no position for the bubble is
correct while the panel is open, because the bubble should not be there at all.

**This is a general rule with one instance today, so it should be written
down.** The tooltip migration that just shipped
(`plan/done/2026-08-11-one-tooltip-across-the-interface.md`) put the rule for
*which* tooltip to use into `CONVENTIONS.md` but says nothing about a control
whose tooltip and whose popover share a space. The version indicator is the only
control in the app that both carries `.tt` and opens a panel anchored to itself,
which is why this is the only visible instance — and why the rule is cheap to
state now and expensive to rediscover later.

## Scope

`src/components/VersionIndicator.jsx`:

- While `open` is true, the button does not present a tooltip. Dropping
  `data-tip` is the mechanism `.tt::after` already keys off — `content:
  attr(data-tip)` renders an empty bubble rather than nothing if the attribute
  is merely emptied, so the attribute is omitted, or the `tt` class is dropped
  alongside it. Whichever is chosen, verify no empty bubble is painted.
- `aria-label` keeps the full tip regardless of the panel state. It is the
  accessible name, not the tooltip, and the migration's rule is that the two are
  independent. A screen-reader user is not the one being occluded.

`CONVENTIONS.md`, in the tooltip section the migration added:

- A control that owns an anchored popover suppresses its own tooltip while that
  popover is open. The popover is the fuller answer; the bubble duplicates it and
  overlaps it. The accessible name is unaffected.

## Out of scope

- The tooltip's content, timing, or styling. AC11's text is right.
- `.tt` / `.tt-up` as a mechanism, and any move to a JS-positioned tooltip.
- The panel's own contents or its dismissal behaviour.
- Tooltips inside the panel, should any appear later.
- Other popovers in the app that are not anchored to a tipped control — the
  commit popover's trigger has its own tooltip but the popover does not open
  over it. Left alone; the convention will cover it if that changes.

## Exit criteria

1. With the upgrade panel open, the version button shows no tooltip on hover
   and none on keyboard focus, and no empty bubble is painted.
2. Closing the panel — click-outside, Escape, or a second click — restores the
   tooltip on the next hover. *(0038 AC11)*
3. The button's `aria-label` is unchanged in both states and still carries the
   version and the tip.
4. With the panel closed, the tooltip behaves exactly as it does today,
   including its upward placement. *(0038 AC11)*
5. `CONVENTIONS.md` states the popover-suppresses-tooltip rule.
6. Unit coverage: the tip is absent while open and present while closed; the
   accessible name is present in both.
7. `yarn verify` green.
8. Verified by hand in the running app, both themes, before the change is
   committed.

## Dependencies

`done/2026-08-12-a-manual-check-that-finds-an-update-shows-it` — it makes the
panel open from a manual check, which is the path
that most reliably leaves the pointer on the button with the panel open. Not a
blocker: the bug reproduces today by clicking a known update open.

---

**Shipped:** 14d815f — `fix(ui): report what a manual update check found, and
get out of its way`, in the same change as the panel-opening item it depended
on. `adr/0038-in-app-upgrade-notice.md` AC11 extended at r10; the general rule
is in `CONVENTIONS.md`. `INDEX.md` needs no regeneration — 0038 stays
Implemented. Released as **v0.11.2**.
