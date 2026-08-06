# Give the manual update check a visible outcome

**Owning ADR(s):** `adr/0038-in-app-upgrade-notice.md` (r7)
**Dependencies:** None

## Context

The upgrade notice works in the direction it was built for: a published tag
newer than the running build produces a marker, a panel, and — where the
deployment can write — a one-click upgrade (`adr/0039-*.md`). What it does not
do is answer the question adopters actually click it to ask.

**Clicking the version when you are already current changes nothing on screen.**
Three separate paths converge on the same non-result:

| Path | Where | What renders |
|---|---|---|
| refused by the throttle | `src/lib/upgrade.js:160` — `return Promise.resolve(null)` | nothing; no state touched |
| fetch in flight | `run()` only writes state on completion | nothing; no pending state exists |
| completed, no update | `state.checkedAt` updates | nothing — see below |

The third is the interesting one. `run()` (`src/lib/upgrade.js:146`) does write
`checkedAt`, and `useUpgrade()` does return it (`src/lib/upgrade.js:175`) — but
`VersionIndicator` destructures only `{ running, latest, available }`
(`src/components/VersionIndicator.jsx:14`), so the one field that changed is
read by nobody. The store re-renders the component into an identical tree.

So the commonest interaction with this feature — *am I current? let me check* —
is indistinguishable from a dead button. That is a defect against AC8, which
specified a manual re-check without specifying that it be observable; r7 of the
ADR adds AC9 to close that.

Two further problems surfaced with it:

- **A failed check would report success.** AC6 made failure silent, which is
  right for the hourly background check and wrong for an invoked one: with a
  visible outcome bolted on, a network failure would land on "up to date" —
  asserting something the check did not establish. `run()` cannot currently tell
  the two apart, because it writes `checkedAt` identically whether `fetchLatest`
  returned a version or `null` (`src/lib/upgrade.js:146`). ADR r7 AC6 now
  distinguishes them by mode.
- **The update marker is green** (`src/styles.css:1070-1077`, and again for
  dark at `:1077`). Green reads as "nothing to do" everywhere else in this app —
  `In sync` in the status bar — while here it means the opposite. ADR r7 AC10
  settles colour: nothing at rest, non-green when an update waits, green only as
  a transient confirmation.

## Scope

- **Model the check's outcome, not just its result.** `checkForUpdate` today
  resolves to `latest | null` with `null` covering "refused", "failed" and "no
  usable tags" alike. Give the store an explicit status the UI can render —
  including a pending state, which does not exist at all today — and distinguish
  a failed fetch from a successful one that found nothing. `checkedAt` should
  advance on success only; a hard-down endpoint still must not be re-fetched on
  every render, so keep a separate attempt timestamp for the throttle rather
  than reusing the success one.
- **Make a throttle refusal present as a completed check** (AC8). Same pending
  state, same terminal outcome, drawn from the stored result. Nothing about the
  rate limit reaches the adopter. This is the one place where the UI is
  deliberately not a faithful mirror of what happened underneath — record why in
  a comment, or the next reader will "fix" it.
- **Render the three outcomes on the indicator** (AC9): pending, up to date,
  could not check. The up-to-date confirmation is transient — it clears itself
  and leaves the resting indicator behind. Pending needs a floor on its visible
  duration; a check that answers in 80ms must not flash a spinner nobody can
  read. Pick the floor during implementation and say why in a comment.
- **Fix the colour semantics** (AC10): drop the green update dot, use a warning
  hue for update-available, and use green only for the transient confirmation.
- **Give the indicator a real tooltip** (AC11). `.tt` / `data-tip` already
  exists (`src/styles.css:879-901`) with hover *and* `:focus-visible`, so this is
  the existing component, not a new one. It opens **downward**
  (`top: calc(100% + 6px)`), and this element sits in the status bar at the
  bottom of the viewport — an upward-opening variant is needed. Build it as a
  reusable modifier, not a one-off: the other status-bar items still use native
  `title` and will want the same thing.
- Settle the ADR's open question — relative vs absolute last-check time — and
  record the choice in the ADR (clearing the open question) as part of shipping.

## Tests

`src/components/versionIndicator.test.jsx` and `src/lib/upgrade.test.js` already
cover the store and the marker; extend them.

Store (`upgrade.test.js`):

- a successful check finding no newer version advances `checkedAt` and reports
  the up-to-date outcome — not the same shape as a failure;
- a failed fetch does **not** report up to date, and does not advance the
  success timestamp, while still suppressing an immediate re-fetch;
- a manual check inside the one-minute floor resolves to the stored outcome
  rather than a distinct "refused" the UI would have to render;
- the existing throttle windows (hourly automatic, one-minute manual) and the
  "never checked is not checked at the epoch" case stay green.

Component (`versionIndicator.test.jsx`):

- clicking when current renders a pending state and then the up-to-date
  confirmation, and the confirmation clears itself;
- clicking with the fetch failing renders "could not check" and never the
  up-to-date confirmation;
- clicking while throttled is indistinguishable from a completed check;
- an available update still opens the panel on click and does **not** re-check
  (the current behaviour at `VersionIndicator.jsx:87-92`);
- the marker is absent when up to date and present when an update waits;
- the tooltip names the running version and the last-check time.

## Out of scope

- Any change to how the upgrade itself is performed (`adr/0039-*.md`) — the
  panel, its actions, the capability probe, and the build polling stay as they
  are.
- Surfacing rate-limit or API errors as actionable messages. AC6 stands: no
  error the adopter is asked to do something about.
- Migrating the other status-bar items off native `title`. The reusable
  upward tooltip lands here; adopting it elsewhere is separate work.
- Any change to the automatic hourly check's silence.

## Exit criteria

1. Clicking the version indicator while up to date produces a visible pending
   state followed by a visible up-to-date confirmation, in all three paths:
   fetched, throttle-refused, and cache-warm.
2. A failed check never renders the up-to-date confirmation; it renders the
   "could not check" outcome, with no error the adopter is asked to act on.
3. The up-to-date confirmation is transient and leaves no standing badge.
4. No marker is rendered at rest; the update-available marker is not green;
   green appears only as the transient confirmation.
5. The indicator has an in-app tooltip (not native `title`) naming the running
   version, update availability, and last-check time, rendering fully on screen
   from the status bar — verified at the bottom of the viewport, not only in a
   unit test.
6. The pending state is legible on a fast check — verified against a real
   sub-100ms response, not only a mocked slow one.
7. Every case under Tests has a test; the existing upgrade and version-indicator
   suites stay green.
8. ADR `0038`'s open question is closed by the shipped choice, with the ADR
   updated in the same change.
9. `yarn verify` green.

## Outcome

All nine exit criteria met. `yarn verify` green, 210 → 228 tests. Criteria 5 and
6 — the two that a unit test cannot settle, the upward tooltip staying on screen
from the bottom of the viewport and the pending state being legible on a fast
check — were confirmed in a browser against a linked consumer project before
this shipped.

**No version bump and no tag with this change.** Another fix is in flight in a
parallel session; the two ride the same release, whenever it is cut. Nothing
here is adopter-visible until then.

**The store now models the outcome, not just the result.** `fetchLatest` returns
`{ ok, latest }` instead of `latest | null`, which had collapsed "GitHub
answered and we are current" together with "nothing answered". `checkForUpdate`
resolves to `OUTCOME.checked | OUTCOME.failed`. The store key went to
`vault-web:upgrade:v2` — a v1 record cannot express a failed check, and the only
cost of discarding one is an extra check.

**The two timestamps had to split**, as the Scope suspected. `attemptedAt` drives
the throttle, `checkedAt` records the last *success* and is the only one shown.
Sharing one forces a choice between hammering a dead endpoint on every render and
telling the adopter their information is fresh when nothing answered. A test
pins each half.

**A 200 carrying no usable tag is a success, not a failure** — the check ran and
GitHub answered; there is simply no published version. It moved out of the
"failure" suite into its own case. This is the one classification the old code
got right by accident and would have been easy to lose here.

**The pending floor runs alongside the fetch, not after it** (`Promise.all`), so
the floor never adds latency to a slow check — it only stops a fast one from
flashing. Set to 450ms with the reasoning in a comment.

**Colour.** The green dot is gone; update-available is amber. The CSS comment
that defended green was arguing against using the brand colour and about staying
distinct from `.status-item.sync` by shape and position — not against the
"green reads as no-action-needed" point — so it was removed with the green
rather than rewritten. Green now appears only as the transient confirmation.

**Tooltip.** `.tt-up` is a modifier on the existing `.tt`, flipping it above the
element and left-aligning it (a right-aligned bubble at the left edge of the bar
would run backwards off screen). Built as a reusable modifier per Scope; the
other status-bar items still use native `title` and can adopt it.

It **leads with the answer** — `Up to date · checked 12 minutes ago`, not
`WebVault 0.6.1 — up to date · …`. The version is rendered immediately beside
the tooltip, so repeating it there spends the first half of the line on
something already on screen. The `aria-label` is the exception and keeps the
version, because it *replaces* the visible text for a screen reader rather than
sitting next to it.

**One neighbouring test needed a change**: `statusBarIdentities.test.jsx`
asserted `class="sb-version"` exactly, which the tooltip modifiers break. Relaxed
to match the class token, since the assertion's intent is that the version is its
own element — not that it carries exactly one class.

Left as it was: the automatic hourly check's silence, and the upgrade panel.

## Notes

- ~~`checkedAt` is already persisted under `vault-web:upgrade:v1`. If the stored
  shape changes incompatibly, bump the key version rather than tolerating
  both~~ — done: the key is now `vault-web:upgrade:v2`.
- ~~The `storage` event listener syncs the store across tabs. A transient
  confirmation belongs to the tab that was clicked in~~ — holds by construction:
  the confirmation is component state (`check`), set only by the click handler,
  so a second tab observing the write re-renders the version but never the
  confirmation. Worth keeping in mind if that state is ever moved into the
  store, where it would leak across tabs.
