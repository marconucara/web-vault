---
adr: 0038
title: In-app upgrade notice — fetch published tags, compare, notify
status: Implemented
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0012, 0037]
tags: [ux, release, distribution]
---

# ADR 0038 — In-app upgrade notice — fetch published tags, compare, notify

## Context

An adopter running an older framework version has no way to learn a newer one
exists short of checking the repository. The versioning policy
(`adr/0037-*.md`) makes both halves of the comparison available: the published
versions are the repository's `vX.Y.Z` git tags, readable from a public,
token-free endpoint, and the running framework version is baked into the build
and shown in the status bar beside the vault build chip
(`adr/0012-build-version-chip.md`). That indicator is where this notice
attaches: the version is already displayed, so the notice marks it rather than
introducing a second surface.

Two properties of that data shape the decision. The tag list is returned in
lexicographic order, not semver or chronological order — `v0.10.0` sorts before
`v0.6.1` — so "the newest version" requires sorting the list by semver rather
than taking the first entry. And a build can legitimately be *ahead* of every
published tag (a maintainer working on `main` after tagging), so the comparison
must be "strictly newer", not "different": inequality would show a permanent,
wrong upgrade notice in that case.

The check runs in two modes, and they have opposite requirements. The
**automatic** one is background work nobody asked for: it must stay invisible
unless it has something to report, so a failure is nothing and "no update" is
nothing. The **manual** one — the adopter clicking the version to confirm they
are current — is an invoked action, and the answer they came for is *"yes, you
are up to date"*. That answer is the common case, far more common than an
update being available. Treating both modes as "silent unless newer" makes the
click produce no observable change at all in the case it exists to serve, which
is indistinguishable from a broken control; and after a failed check it would
be worse than silent, since showing the up-to-date answer would assert
something the check did not establish. So the manual mode reports its own
outcome, including the failure, while never surfacing an error the adopter is
expected to act on.

This also fixes what the indicator's colour means. An "everything is normal"
state that is permanently lit is chronic noise, and the rest of the status bar
already says nothing when there is nothing to say. Absence is therefore the
up-to-date state; the marker appears only when an upgrade is waiting, and it is
not green, because green already reads as "no action needed" everywhere else.
Green is reserved for the transient confirmation of a manual check.

## Capability statement

While the portal is open it fetches web-vault's published tag list from the
GitHub API, resolves the highest `vX.Y.Z` by semver comparison, compares it to
the running build's framework version, and — when the published one is strictly
newer — surfaces a non-blocking "update available" indicator naming that
version. It is **read-only**: it notifies, it does not upgrade anything.
Performing the upgrade is `adr/0039-*.md`.

## User stories / scenarios

- As an adopter, I see an unobtrusive notice when a newer web-vault version is
  published, so I know an update exists.
- As an adopter who is already current, I click the version to make sure, and I
  get a visible answer — the check is running, then it is done and I am up to
  date — rather than nothing happening.
- As an adopter clicking the version while offline, I am told the check could
  not run, and I am never told I am up to date on the strength of a check that
  failed.
- As a maintainer running a build ahead of the newest tag, I see no notice.

## Acceptance criteria

1. The portal fetches web-vault's published tags from GitHub without any secret
   or token (public endpoint), against the framework's own repository — not a
   repository derived from the adopter's environment.
2. Tags are filtered to the `vX.Y.Z` form and the highest is selected by
   numeric semver comparison of the three components, never by the order the
   API returns or by string comparison.
3. The notice is shown only when that version is strictly newer than the
   running build's framework version; an equal or older one shows nothing.
4. The notice attaches to the status-bar version indicator
   (`adr/0037-*.md`), which keeps showing the running version whether or not an
   update exists, and opens an anchored panel naming the new version, the
   running one, and a link to that version on the repository host. The panel
   closes on click-outside or Escape; the marker itself has no hide action.
5. The notice is non-blocking and dismissible: the panel closes on
   click-outside or Escape, and it never auto-upgrades or reloads. Dismissing
   closes the panel, not the marker — the dot stays until the upgrade actually
   happens, since suppressing it would have to persist and would then outlive
   the moment it was clicked in.
6. A network/API failure never surfaces an error the adopter is asked to act
   on, and never shows an upgrade notice. In the **automatic** check it is
   entirely silent. In the **manual** check it resolves to a distinct
   "could not check" outcome (AC9) — never the up-to-date outcome, which would
   assert something the failed check did not establish.
7. The check is throttled so that ordinary use stays well inside the
   unauthenticated GitHub rate limit (60 requests/hour per IP): at most one
   automatic check per hour, persisted across page loads.
8. The indicator is clickable for a manual re-check, and the fetch is refused
   if the previous check was under a minute ago. The refusal is not observable:
   a refused re-check presents exactly as a completed one (AC9), reporting the
   stored result of the last check. The rate limit is the implementation's
   constraint, not something the adopter is shown or asked to wait out.
9. A manual re-check is observable from click to outcome, in every case —
   fetched, refused by the throttle (AC8), or failed (AC6):
   1. a pending state appears next to the version and is legible as "working",
      held long enough to be seen even when the answer is immediate;
   2. it is followed by exactly one terminal outcome — *up to date*, *update
      available*, or *could not check*;
   3. the *up to date* outcome is a transient confirmation that clears itself
      and leaves the indicator in its resting state; it never becomes a
      persistent badge;
   4. the *update available* outcome opens the notice panel as part of the
      outcome itself, on the click that ran the check — the adopter never has to
      click again to see what the check found. It does not present as the
      transient confirmation of AC9.3, which asserts the opposite answer.
      A check that is refused by the throttle when the update is already known
      is not this case: it is unobservable per AC8, and the panel opens there by
      the ordinary click behaviour.
10. Colour carries one meaning each. The resting, up-to-date indicator has no
    marker at all. The update-available marker is not green. Green appears only
    as the transient confirmation of a manual check (AC9.3), never as a standing
    state.
11. The indicator carries a tooltip, built from the same in-app tooltip
    component used elsewhere in the app rather than the browser's native
    `title`, naming the running version, whether an update is available, and
    when the last successful check happened. It is positioned so it stays fully
    on screen from the status bar at the bottom of the viewport, and it is
    withheld while the notice panel is open — the panel is the same answer at
    greater length, and the bubble opens into the space the panel occupies. The
    accessible name is unaffected in either state.

## Out of scope

- Performing the upgrade (`adr/0039-*.md`).
- Notifying about anything other than the framework version (e.g. vault
  content freshness — that is `adr/0030-*.md`).
- Showing release notes / a changelog in the notice: no notes surface is
  published (`adr/0037-*.md`).
- Pre-release or non-`vX.Y.Z` tags.

## Open questions

- None. The last-check format (AC11) is settled: relative under the hour
  ("checked 12 minutes ago"), a clock time within the same day beyond it, and a
  date before that. Under an hour the relative form is what a reader wants and a
  clock time makes them do arithmetic; past that the arithmetic stops being
  worth doing and the time is the useful fact.

## References

- adr/0012-build-version-chip.md
- adr/0037-versioning-and-release-policy.md
- adr/0039-adopter-upgrade-path.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |
| 2026-08-06 | r2 | marco | Retargeted from GitHub Releases to the published tag list, following `adr/0037-*.md` r2. Made semver sorting and the strictly-newer comparison explicit, dropped release notes from the notice, added a rate-limit criterion. |
| 2026-08-06 | r3 | marco | Anchored the notice to the status-bar version indicator introduced by `adr/0037-*.md` r3 (new AC4), closing the placement open question. |
| 2026-08-06 | r4 | marco | Settled the remaining open questions: hourly automatic check with a one-minute floor on manual re-checks (AC7/AC8), and an anchored panel that links to the new version on the repository host (AC4). |
| 2026-08-06 | r5 | marco | Clarified AC5: dismissing closes the panel, not the marker. Found in use — an explicit Dismiss button hid the dot persistently, which outlives the click and leaves no way back. |
| 2026-08-06 | r6 | marco | Implemented: tag fetch, semver selection, throttled checks, and the status-bar marker with its anchored panel. |
| 2026-08-06 | r7 | marco | Back to Accepted. Found in use: the manual re-check (AC8) had no observable outcome in the commonest case — an adopter clicking to confirm they are current saw nothing change, since a check finding no update touches no rendered state. AC8 specified the action without specifying its feedback, and AC6's blanket silence, correct for the automatic check, made a failed manual check indistinguishable from "up to date". Qualified AC6 by mode, rewrote AC8 so a throttle refusal is unobservable, and added AC9 (pending state and exactly one terminal outcome), AC10 (colour semantics — the shipped marker was green, which reads as "no action needed" while meaning the opposite), and AC11 (in-app tooltip carrying the running version and last-check time). |
| 2026-08-06 | r8 | marco | Closed the AC11 open question with the shipped format: relative under the hour, clock time within the day, date beyond. |
| 2026-08-06 | r9 | marco | Implemented: outcome-aware store (success and attempt timestamps split), visible pending state with a floor, the three terminal outcomes, amber marker with green reserved for the transient confirmation, and the upward in-app tooltip. |
| 2026-08-11 | r10 | marco | Found in use: a manual check that *finds* an update left the panel shut. The click dispatches on `available` as it stood before the check, so the click that discovers an update routes to the check and nothing consumes the result — a second click was needed to see what the first one found. AC9.2 named the *update available* outcome and, unlike AC9.3 for *up to date*, never described it, so the gap was in this ADR before it was in the code. Added AC9.4. Also extended AC11: the indicator withheld its tooltip nowhere, so the bubble covered the very panel it had just opened. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-08-11 | — (r10) |
