---
adr: 0030
title: Background freshness detection and soft content re-fetch
status: Proposed
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0012]
tags: [sync, freshness, read, ux]
---

# ADR 0030 — Background freshness detection and soft content re-fetch

## Context

The web client reads a build-time snapshot of the vault. That snapshot can go
stale under it: someone commits and pushes to the same branch the client runs on
(for example from a desktop Tolaria session), and the open client keeps showing
the old content until a manual reload. Detection is only possible once the change
is **pushed** — the client sees the published branch state, never an unpushed
local edit elsewhere — and that is an accepted constraint, not a limitation to
work around.

The build already exposes an identity for the loaded snapshot: `gitBuildInfo()`
in `scripts/build-content.mjs` emits a commit SHA (from `CF_PAGES_COMMIT_SHA` or
`git rev-parse HEAD`) that the toolbar version chip surfaces
(`adr/0012-build-version-chip.md`). That SHA is a cheap, coarse freshness signal:
any push moves it. This ADR uses it to keep the open client current
**proactively**, sitting above the reactive branch-level 409 fast-forward
backstop in `functions/commit.js` — the client should not first learn the vault
moved by having a commit rejected.

This is a read-side decision with no data-loss risk. The one collision it must
not cause — a background update clobbering an edit in progress — is deliberately
excluded here and handed to the edit-time drift-policy decision
(`adr/0031-edit-time-drift-policy.md`).

## Capability statement

While the client is open it periodically polls the build identity (the
`build-info` SHA). When the polled SHA differs from the one the loaded snapshot
was built from, the client performs a **soft re-fetch** of the content data and
updates its in-memory application state in place — no full page reload. Read-only
surfaces (note list, saved views, and a viewed note with no unsaved draft) reflect
the newer content automatically. A note that has an active or dirty draft is
**exempted**: the re-fetched content is not applied to it and its working copy is
preserved; that case is governed by the drift-policy decision.

## User stories / scenarios

- As a viewer, I keep a note open while someone else commits and pushes a change
  from Tolaria, and the client picks up the new content on its own without my
  reloading the page.
- As a viewer browsing the note list, notes added or changed by an external push
  appear after the next poll, without a manual refresh.
- As an editor with an unsaved draft, a background update does not overwrite my
  in-progress edit — my working copy stays intact.

## Acceptance criteria

1. While the client is open it polls the `build-info` SHA on a bounded interval;
   the loaded snapshot's SHA is retained for comparison.
2. When the polled SHA differs from the loaded one, the client soft re-fetches the
   content data and updates in-memory state **in place**, issuing no full page
   reload (no `location.reload()`).
3. After a soft re-fetch, read-only surfaces (note list, saved views, and a viewed
   note without an unsaved draft) reflect the newer content.
4. A note with an active or dirty draft does not have re-fetched content applied to
   it; its working copy / draft is preserved. The collision is surfaced to the
   edit-time drift-policy decision rather than resolved here.
5. When the polled SHA equals the loaded one, no re-fetch and no visible change
   occur.

## Out of scope

- What to do when the changed content collides with a note being edited — warning,
  discard, or merge — belongs to `adr/0031-edit-time-drift-policy.md`.
- Note-level change granularity (a per-path content manifest/hash). v1 uses the
  coarse build SHA only; finer granularity, if ever needed, would supersede this
  ADR.
- Detecting changes that have not been pushed to the branch the client reads.
- Real-time push/streaming updates; this is interval polling, not a live channel.

## Open questions

- None.

## Implementation note — the reactive backstop that already exists

Shipped ahead of this ADR, and useful context whenever it is implemented: a tab
left open across a deploy can request a lazy chunk whose content hash no longer
exists on the server, because the entry bundle it is running predates the deploy.
`src/components/ChunkBoundary.jsx` catches that failed dynamic import and offers a
reload, and `scripts/build-headers.mjs` keeps the HTML entry always-revalidated so
the *next* navigation starts fresh.

That is the crude, reactive form of this capability: it acts only once something
has already broken, costs a full page reload, and reaches only the surfaces behind
a lazy boundary. This ADR is the proactive form. When it lands, the polled SHA
gives a real signal to act on before a 404 happens, and the boundary should become
the fallback for the case polling cannot cover rather than the primary path. Note
the copy constraint the boundary already follows: this situation is described to
the user as **new content**, never as a new version — the latter belongs to the
upgrade notice (`adr/0038-in-app-upgrade-notice.md`) and means a new web-vault
release.

## References

- scripts/build-content.mjs (`gitBuildInfo`), src/components/StatusBar.jsx
- src/components/ChunkBoundary.jsx, scripts/build-headers.mjs
- adr/0012-build-version-chip.md
- adr/0021-draft-state-optimistic-ui.md
- adr/0018-edit-commit-via-pages-function.md
- adr/0019-atomic-commit-git-data-api.md
- adr/0031-edit-time-drift-policy.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
