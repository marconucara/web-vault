# Commit actions hold their place — disabled, not absent

**Owning ADR(s):** `adr/0034-client-settings-modal.md` (criteria 11-12, revised
at r5)

## Context

The commit actions are withheld until the capability endpoint answers, and
appear when it does. `canWrite` starts as `null` (`src/lib/capabilities.js:22`)
and only a `fetch` settles it, so at first paint every one of them is absent
from the DOM and arrives a moment later. Arriving is the problem: the controls
occupy space, so the rows around them are laid out without it and then relaid
with it.

Two places show it plainly:

- The sidebar's Types heading (`src/components/Sidebar.jsx:66-89`) is a flex row
  whose height at rest is the height of the word `TYPES`. The visibility toggle
  and the create `+` are taller, so when they arrive the heading grows and
  **every type row below it moves down**.
- The note list header (`src/components/NoteList.jsx:119-127`) does the same
  with the new-note `+`.

`.list-new` and `.group-action` already carry a 180ms fade
(`src/styles.css:1753-1758`) added for exactly this moment. It animates opacity,
which never was the problem — the reflow happens whether the arriving control is
transparent or not, so the fade softens the appearance of a control while the
layout jumps underneath it.

Criterion 10 already forbids this for the note body, for the heading-anchor
scroll (`adr/0044`). The controls were left out of that reasoning; r4 settled
them the other way, as *absent, not disabled*, reasoning that a disabled control
raises a question. It does — and a tooltip is a better answer to it than
absence, which raises the same question with nowhere to look. r5 reverses this;
this item implements r5.

The state is not transient in every deployment. A deployment with no token —
a public share, a build with no Worker secret — answers `false` and stays there,
so whatever we render in the unresolved state is also what a read-only instance
renders permanently.

## Scope

**Presence stops depending on the capability.** `src/App.jsx:311-313` and `:319`
pass `null` in place of each callback to make the control vanish. They pass the
callback unconditionally instead, and the components decide the state. The
components already have the capability to hand through `useCapabilities()`;
`Sidebar` and `NoteList` do not call it yet and will.

**Four controls in this item**, all in the sidebar and the note list:

| Control | Site |
|---|---|
| Show or hide types | `src/components/Sidebar.jsx:73-82` |
| New type | `src/components/Sidebar.jsx:83-87` |
| Edit type (per row) | `src/components/Sidebar.jsx:103-112` |
| New note | `src/components/NoteList.jsx:119-127` |

`nav-edit` does not shift the layout — it is `opacity: 0` at rest
(`src/styles.css:132-144`) so its space is already reserved — but it is gated
the same way and would otherwise be the one write control left that disappears.

**Inert is `aria-disabled`, not `disabled`.** The `disabled` attribute
suppresses mouse events, and `.tt::after` renders on `:hover`/`:focus-visible`
(`src/styles.css:953`), so a natively disabled button is mute exactly when it is
asked to explain itself. `aria-disabled="true"` plus an `onClick` that returns
early keeps the control hoverable and focusable while doing nothing. Styling
hangs off `[aria-disabled="true"]`, not `:disabled`.

**The tooltip** is the in-app `.tt` + `data-tip`
(`src/styles.css:931-953`), not the native `title` these four use today. Text is
`preferences.readOnlyTitle` — *Editing is off* — the heading already shown in
the modal's notice (`src/locales/en.json:152`), reused rather than duplicated.
One line, so `nowrap` holds and `.tt-multi` is not needed. The body copy
(`readOnlyBody`) stays in the modal; the tooltip names the state, the modal
gives the reason.

Note the bubble is `right: 0` — right-aligned under its element. Both sidebar
controls sit near the sidebar's right edge, so this is the correct variant;
`.tt-up` is for the status bar and does not apply. Whether the bubble clears the
sidebar's own bounds is to be checked in the running app, not assumed.

**Only while the answer is outstanding or no.** `useCapabilities` already
returns `known` (`src/lib/capabilities.js:64`), distinguishing "not yet" from
"no". Both render inert — but the tooltip claims editing *is off*, which is a
statement about a settled answer. Attach it when `known && !canWrite`; leave the
control inert and untipped while the probe is in flight, which lasts a moment
and is not a state worth naming.

**Motion.** The `wv-fade-in` keyframe and its two rules go, along with the
comment at `src/styles.css:1749-1752` that explains an arrival that no longer
happens. In their place a `transition` on the control's own colour/opacity, so
becoming live reads as settling. Kept inside the existing
`prefers-reduced-motion` block.

## Out of scope

- **Share and delete**, as a state change. Criterion 11 names them and they are
  gated the same way (`src/components/NoteView.jsx:142`,
  `src/components/PropertiesPanel.jsx:202`), but neither shifts the layout:
  share sits at the end of an inline chip row, and delete is the last block in a
  scrolling panel. They are the same decision and want the same treatment, and
  they are deliberately left to be done under item `0002`, where every remaining
  native `title` is converted at once. Until then criteria 11-12 are met in the
  two places that shift and not app-wide.

  Share does gain a **fade on arrival** here, which is not the same change:
  removing `wv-fade-in` left it the only commit action that still appears with
  the answer, and appearing was the one thing that motion was there to soften.
  It had never carried the fade — `wv-fade-in` covered `.list-new` and
  `.group-action` only — so the snap was there before this item and only became
  conspicuous once its neighbours stopped moving.
- Migrating the other native `title` attributes — item `0002`.
- The read-only editor body (criterion 10), which already behaves.
- Any change to what `canWrite` means or how it is probed.

## Exit criteria

Mapped to `adr/0034-*.md` acceptance criteria as revised at r5.

1. With the capability probe artificially delayed, neither the sidebar's type
   rows nor the note list header move between first paint and the answer, for
   either answer. *(AC 11)*
2. The four controls are in the DOM at first paint, before the probe answers.
   *(AC 11)*
3. With `canWrite` false, all four are `aria-disabled` and activating them —
   click and keyboard — does nothing. *(AC 12)*
4. None of the four carries the `disabled` attribute; each is reachable by hover
   and by keyboard focus in that state. *(AC 12)*
5. Hovering or focusing one while `known && !canWrite` shows the in-app tooltip
   reading *Editing is off*; the full token explanation appears only in
   preferences. *(AC 12, 8)*
6. While the probe is outstanding the controls are inert and carry no tooltip.
   *(AC 11)*
7. With `canWrite` true all four behave exactly as they do today. *(AC 11)*
8. `wv-fade-in` is gone from `src/styles.css`, with no rule referencing it; the
   state transition is skipped under `prefers-reduced-motion`. *(AC 11)*
9. Tests pin that none of the four unmounts when `canWrite` is false — the
   regression this item exists to prevent. Extend
   `src/components/writeGating.test.jsx`, which asserts today's absence and will
   fail until updated.
10. `yarn verify` green.
11. Verified by hand in the running app, in all three states — probe pending,
    write access, no write access — before the change is committed.

## Dependencies

None. First item in an empty queue. Item `0002` depends on this one: it adopts
the `.tt`-on-`aria-disabled` pattern established here.

---

## Outcome

Went in as scoped, and the ADR revision (r5) was the first change rather than an
afterthought: r4 had settled this the other way, so implementing it without
moving the ADR would have been a silent divergence from an Implemented decision.

**The state is a triple, and naming it was what made the rest fall out.**
`writeState` is `'on' | 'off' | 'pending'`, derived in `App` from the `canWrite`
/ `known` pair `useCapabilities` already returned. `off` and `pending` render
identically except for the tooltip, which only a settled answer earns.

Four things were found by using the app, not by reading it. Three are cases
where the inert style collided with a rule that already existed:

**`opacity` on the button dimmed its own tooltip.** `.tt::after` is a child, and
`opacity` applies to the whole subtree, so the explanation the inert state
exists to give was rendered at 45% along with the icon. The dimming moved to
`> .icon`.

**`.list-btn:hover` outranked the inert hover rule.** A class beats a bare
attribute selector, so the note list's `+` lit up on hover as though live while
the sidebar's did not — the same state reading as two different affordances.
The inert hover rules now repeat each owning class to win on specificity;
`!important` was not needed and was not used.

**`.tt` paints an empty bubble without `data-tip`.** Dropping the tip in
`pending` left the class behind, so a slow probe showed a blank tooltip on
hover — visible only with the probe artificially delayed, which is how it was
caught. The fix was to make the helper own the class as well as the tip, since
they are one decision; splitting them between the helper and four call sites is
what produced the bug.

**Share was left the only action that still arrives**, and it had never carried
the removed `wv-fade-in` (that covered `.list-new` and `.group-action` only).
The snap predates this item and only became conspicuous once its neighbours
stopped moving. It now fades at 220ms — longer than the 180ms removed, because
this control genuinely appears rather than changing state.

Also worth recording: `aria-disabled` is advisory and blocks nothing on its own,
so the helper swallows the handler explicitly — otherwise click and Enter would
still fire. And a lazily-loaded icon arrives with `icon-fade-in`, an animation
that outranks the static inert opacity while it runs, so an inert icon would
flash at full strength; suppressed with `animation: none`.

`.nav-edit` needed its own rule in both directions: it is `opacity: 0` at rest,
so the generic inert opacity would have made it *more* visible when read-only
than when writable.

Delete and share keep their absence for now, and criteria 11-12 are met in the
places that shift rather than app-wide; item `0002` closes them alongside the
tooltip migration, which is where they belong.

14 new tests across `src/lib/writeAction.test.js` (new) and a rewritten
`src/components/writeGating.test.jsx`, whose old assertions encoded r4's absence
rule and had to invert. 501 total, `yarn verify` green.

---

Shipped at HEAD `2ddc185`, released as `v0.11.1`.
