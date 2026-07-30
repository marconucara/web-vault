---
adr: 0036
title: Local dev edit persistence — write to disk, no commit
status: Proposed
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0018, 0021]
tags: [dev, editor, tooling]
---

# ADR 0036 — Local dev edit persistence — write to disk, no commit

## Context

The client persists edits by POSTing to `/api/commit` (`src/lib/commit.js`). In
production that endpoint is the Cloudflare Pages Function
(`adr/0018-edit-commit-via-pages-function.md`, `functions/commit.js`), which
commits atomically to GitHub via the Git Data API
(`adr/0019-atomic-commit-git-data-api.md`) using a server-side token. The Vite dev
server does not serve Pages Functions, so under `wv dev` that POST has no handler
and **local editing does not work**. Local development also has no GitHub token and
must never push.

There is a precedent for closing this gap: `sharedPagesDev()` in
`lib/vite-config.mjs` reimplements a production Pages behaviour inside the dev
server by reusing the same build code (`shared-render.mjs`), so "dev matches
production". The edit path should follow the same pattern.

## Capability statement

Under `wv dev`, a dev-only Vite middleware handles `POST /api/commit` by applying
the **same file transforms** as the production Function — reusing the pure helpers
in `functions/commit.js` (path safety, op application, frontmatter/body
reconstruction, share-id handling) — and then **writing the resulting `.md` files
directly to the vault on disk**. There is no git commit, no push, and no token.
The handler returns a response shaped like the Function's success so the client's
optimistic UI (`adr/0021-draft-state-optimistic-ui.md`) clears the draft
unchanged. This gives a production-like edit experience for local development and
testing, so a developer sees how editing behaves before deploying.

## User stories / scenarios

- As a developer running `wv dev`, I edit a note and the change is written to the
  vault's `.md` file on disk — no commit, no token.
- As a developer, the local edit path behaves like production (same transforms), so
  I can validate the editing experience before I deploy.

## Acceptance criteria

1. Under `wv dev`, `POST /api/commit` is handled by a dev-only middleware;
   production continues to use the Pages Function unchanged.
2. The dev handler applies the same transforms as `functions/commit.js` (path
   safety, op application, frontmatter/body reconstruction, share-id handling) by
   reusing those pure helpers — dev matches production.
3. Changed notes are written directly to the vault's `.md` files on disk; no git
   commit, no push, and no GitHub token is used or required locally.
4. The dev handler returns a success response shaped like the Function's, so the
   client's optimistic draft-clearing works unchanged.
5. Writes are constrained to safe note paths within the vault (`isSafeNotePath`);
   unsafe paths are rejected as in production.

## Out of scope

- Any git operation locally (commit, branch, push) — local persistence is a plain
  file write, not a version-control action.
- Publishing share pages locally beyond what a build produces — sharing still needs
  a build to generate `/shared/<id>/` pages (`adr/0025-public-share-pages.md`); the
  dev write only updates the note's frontmatter (`share_id`).
- Reproducing the Git Data API's multi-file atomicity — a local write is per-file
  best-effort.

## Open questions

- Whether the dev write also refreshes the open session's in-memory content (so the
  edit shows without a manual reload) — this overlaps with the soft re-fetch of
  `adr/0030-background-freshness-detection.md`, or it can rely on Vite reload. To be
  fixed in the plan.

## References

- lib/vite-config.mjs (`sharedPagesDev` dev-middleware pattern)
- functions/commit.js, src/lib/commit.js
- adr/0018-edit-commit-via-pages-function.md
- adr/0019-atomic-commit-git-data-api.md
- adr/0021-draft-state-optimistic-ui.md
- adr/0029-cli-setup-and-distribution.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
