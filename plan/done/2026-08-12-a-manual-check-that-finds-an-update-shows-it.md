# A manual check that finds an update shows it

**Owning ADR(s):** `adr/0038-in-app-upgrade-notice.md` (criteria 8-9; AC9.2 is
amended by this item)

## Context

Clicking the version indicator to check for an update, when there is one, leaves
the adopter where they started. The check runs, the spinner shows, the tick
appears — and nothing else happens. The panel naming the new version and
offering the upgrade does not open. A second click opens it.

The cause is that the click has two meanings and the wrong one is chosen before
the answer is known (`src/components/VersionIndicator.jsx`, `onClick`):

```js
const onClick = () => {
  if (available) setOpen((v) => !v);
  else runCheck();
};
```

The dispatch is on `available` **as it was at click time**. The case this bug
lives in is the one where `available` is `false` precisely because the check has
not run yet: the click routes to `runCheck()`, the fetch discovers the update,
`available` flips to `true` — and the click that caused the discovery has
already been spent. Nothing consumes the new state.

The two-meaning click is deliberate and documented in the file: with an update
already known, re-checking would tell the adopter nothing, so the click opens the
panel instead. That reasoning is sound and is not what this item changes. What it
misses is the transition — the click that *turns* not-known into known. In that
one case the adopter has expressed interest twice over (they clicked to check,
and there is something to report) and is shown the least of anyone.

**The ADR is genuinely silent here, so it is amended rather than just
implemented against.** AC9.2 requires the manual check to end in "exactly one
terminal outcome — *up to date*, *update available*, or *could not check*", and
AC9.3 goes on to specify what the *up to date* outcome looks like in detail: a
transient confirmation that clears itself. The *could not check* outcome is
specified by AC6 and AC9. The *update available* outcome is named and then never
described. The shipped behaviour — a tick, and a panel the adopter must find a
second click for — satisfies the letter of AC9.2 while missing what the criterion
is for, which is that a manual check tells you what it found.

The confirmation tick is worth calling out as its own small wrongness. `runCheck`
sets `check = 'confirmed'` on every non-failed outcome, and the tick is styled
green. AC10 reserves green for the *up to date* confirmation and states the
update-available marker is not green. A check that finds an update currently
renders the green tick — the confirmation for the opposite answer — for
`CONFIRM_MS`. Whatever the found-an-update outcome becomes, it must not be that.

## Scope

`src/components/VersionIndicator.jsx`:

- `runCheck` inspects the outcome and, when the check moves the state from no
  update to update-available, opens the panel. `checkForUpdate` already returns
  an `OUTCOME`; the store's `available` after the await is the other half of the
  answer. Opening on the transition, not on `available` being true, keeps a
  refused-by-throttle re-check of an already-known update from popping the panel
  open under the adopter — AC8 requires a refusal to present exactly as a
  completed check, and it already opens the panel via the `available` branch of
  `onClick`.
- The green confirmation tick is suppressed when the outcome is
  update-available; the panel is that outcome's terminal state. *Up to date* and
  *could not check* keep the states they have.
- The `alive.current` guard applies to the new state change as it does to the
  existing ones — a check that answers after unmount must not open anything.

`adr/0038-in-app-upgrade-notice.md`:

- AC9.2 gains a sub-criterion specifying the *update available* outcome the way
  AC9.3 specifies *up to date*: the panel opens as part of the outcome, without a
  further click, and the outcome does not present as the green confirmation.
- Revision History row; Approvals updated. Substantive.

## Out of scope

- The two-meaning click itself. With an update already known, clicking still
  toggles the panel and still does not re-check.
- The panel's contents, actions, or the `canWrite` branch within it.
- The throttle, its window, or its unobservability (AC8).
- The tooltip that covers the panel once it is open — `done/2026-08-12-a-control-with-its-popover-open-drops-its-tooltip`.
- Anything about the automatic on-open check.

## Exit criteria

1. With an update published and not yet known to the client, one click on the
   indicator runs the check and leaves the panel open, naming the new version.
   No second click. *(0038 AC9.2)*
2. That outcome does not render the green confirmation tick. *(0038 AC10)*
3. A manual check finding no update is unchanged: transient green tick, clears
   itself, no panel. *(0038 AC9.3)*
4. A failed manual check is unchanged: the *could not check* state, no panel.
   *(0038 AC6, AC9.2)*
5. A click when the update is already known still toggles the panel, and still
   does not re-check. *(0038 AC8)*
6. A check whose answer arrives after the component unmounts opens nothing and
   throws nothing.
7. `adr/0038-in-app-upgrade-notice.md` specifies the *update available* outcome
   under AC9, with Revision History and Approvals updated.
8. Unit coverage for the transition case, the no-update case, and the failure
   case.
9. `yarn verify` green.
10. Verified by hand in the running app before the change is committed.

## Dependencies

None. `done/2026-08-12-a-control-with-its-popover-open-drops-its-tooltip`
touches the same component and depended on this one's panel-opening behaviour
existing, not the reverse. Both shipped together.

---

**Shipped:** 14d815f — `fix(ui): report what a manual update check found, and
get out of its way`, together with the tooltip item below it in the queue.
`adr/0038-in-app-upgrade-notice.md` → r10 (AC9.4 added), stays Implemented, so
`INDEX.md` needs no regeneration. Verified by hand against the real endpoint
with the declared version temporarily lowered, so the published `v0.11.1`
registered as newer — the same technique the `0038` implementation used, since
this repo is always at or ahead of its newest tag. Released as **v0.11.2**.
