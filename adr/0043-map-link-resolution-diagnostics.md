---
adr: 0043
title: Map link resolution diagnostics — unresolved links surfaced to the client and an opt-in strict gate
status: Proposed
date: 2026-08-02
owner: marco
supersedes:
superseded-by:
depends-on: [0002, 0028]
tags: [maps, build, diagnostics, ui]
---

# ADR 0043 — Map link resolution diagnostics — unresolved links surfaced to the client and an opt-in strict gate

## Context

Map links are resolved at build time
(`adr/0028-google-maps-places.md`). Resolution can fail, and after 0028 r2 a
failure is honest: a link that Google would not resolve is omitted from the
content artifact rather than cached as a bogus place.

Honest, but nearly invisible. The only trace is a line in the build log. A vault
owner who edits from the web editor never sees that log — the build runs on CI —
so a note whose place card silently renders as a plain link gives no clue why,
and no indication that the next build will retry it. The failure that motivated
0028 r2 went unnoticed for weeks precisely because a bad resolution was
indistinguishable from a good one at a glance.

Two forces pull against each other:

- **Visibility.** The person who can fix a bad link (the vault owner, editing
  the note) is not the person reading the CI log. The signal has to reach the
  product surface.
- **Availability.** Resolution failures are dominated by Google `429`s, which
  are transient and IP-sticky across an entire build. 0028 r2 deliberately
  refused to fail the build on them: a hard gate would block deploys of edits
  that have nothing to do with maps, and would re-fatalise exactly what the
  cross-build cache exists to absorb.

These reconcile only if failures are **classified**. A transient block and a
permanently dead link deserve different treatment: the first is noise that
resolves itself, the second is a defect in the note that only a human can fix.
Today nothing distinguishes them, which is why the build cannot safely be strict
about either.

## Capability statement

The build **records why each unresolved map link failed**, classified as
transient (rate-limited, network, timeout) or permanent (malformed URL, link
resolves to no place), and carries that record into the content artifact
alongside the resolved places. The client uses it to explain, at the point of
the affected link, that the place could not be loaded and whether it will be
retried — never exposing internal identifiers. Independently, an **opt-in**
strict mode lets a pipeline fail the build on permanent failures only; the
default remains that no resolution failure ever fails a build. The record is
recomputed every build and never cached, so a link that starts resolving stops
being reported without any manual step.

## User stories / scenarios

- As a vault owner, when a place card does not render, I can see that the link
  could not be resolved and whether the site will try again, instead of
  wondering whether I wrote the link wrong.
- As a vault owner, I can tell a link I mistyped apart from a temporary Google
  block, because only the first is presented as something I need to fix.
- As an operator, a transient rate limit still deploys: my unrelated edits are
  never held hostage by Google.
- As an operator running a pre-merge check, I can opt into failing on
  permanently broken links so a typo does not reach the deployed site.
- As a vault owner, once a previously blocked link resolves, the warning
  disappears on its own.

## Acceptance criteria

1. The content artifact carries, alongside resolved places, an entry for every
   map link that was collected but not resolved, each with the link and a
   classification of `transient` or `permanent`.
2. Classification is derived from the failure: a `429`, a blocked/interstitial
   response, a network error, or a timeout is `transient`; a URL that is
   malformed or resolves to no place is `permanent`.
3. The unresolved record is recomputed on every build and written to neither the
   local resolver cache nor the published cross-build cache, so it disappears by
   itself on the build after a link starts resolving.
4. The client surfaces an unresolved link at the point of use, distinguishing a
   link that will be retried from one that needs the note edited, in the product's
   own vocabulary. No ADR number, ADR title, or internal artefact name appears in
   any string a user can read.
5. By default no resolution failure changes the build's exit status.
6. With strict mode enabled, the build fails **only** when at least one link is
   classified `permanent`; a build whose failures are all `transient` still
   succeeds.
7. A vault with no unresolved links produces no diagnostic surface at all — no
   empty state, no placeholder.

## Out of scope

- Changing what counts as a resolved place, or the caching and retry rules for
  resolution itself. Those are settled in `adr/0028-google-maps-places.md`.
- Repairing or rewriting bad links automatically.
- A general-purpose build-diagnostics channel for other content problems
  (wikilinks, media, views). If that is wanted, it supersedes this ADR rather
  than growing inside it.
- Notifying anyone out-of-band (email, webhook) about unresolved links.

## Open questions

- Where the client surface belongs: only at the affected link, or additionally
  as a vault-wide summary somewhere in the UI. The per-link case is the one the
  acceptance criteria require; a summary view may not be worth its footprint.
- Whether the strict gate is worth shipping at all before there is a pre-merge
  pipeline that would use it. It may be sound but premature.
- Whether a permanently unresolved link should still render its raw URL as a
  plain link (today's fallback) or be visually marked as broken.

## References

- adr/0028-google-maps-places.md — build-time resolution, place cards, and the
  cross-build cache this ADR reports on.
- adr/0002-build-time-content-pipeline.md — the content artifact that would
  carry the record.
- scripts/resolve-maps.mjs, scripts/build-content.mjs
- src/components/MapCard.jsx, src/components/MapView.jsx
- plan/done/2026-08-02-maps-resolver-reject-blocked-responses.md — the fix that
  made failures honest and left this gap.

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-08-02 | r1 | marco | Initial draft. Split out of ADR 0028 r2, where surfacing unresolved links was left as an open question after the resolver stopped caching blocked responses as places. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
