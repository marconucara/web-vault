---
adr: 0024
title: Share and unshare a note from the app
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0019, 0022]
tags: [share, ux, commit]
---

# ADR 0024 — Share and unshare a note from the app

## Context

Public sharing is a core feature (`adr/0004-vault-compatibility-target.md`).
Publishing a note is not new infrastructure: it is adding `share_id` to the
frontmatter and committing (`adr/0022-frontmatter-preserved-line-ops.md`), which
makes the build generate the isolated public page
(`adr/0025-public-share-pages.md`). But unlike editing (batched, you decide when),
Share is an act of publishing "now", and the public URL is **dead until the build
has deployed the page** — so the UI must not hand over a link that doesn't work
yet.

## Capability statement

A share sheet publishes a note: it stages `share_id` (plus any pending body edit
of that note) and commits **that single note immediately**, leaving other notes'
drafts intact. Because there is only one working copy per note, Share commits the
current file state (edits + `share_id` together), which is the only honest option
since the public page is generated from the committed file. After committing, the
sheet shows "activation in progress" and **polls `/shared/<id>/` until it responds
200 with the share-page marker** (`adr/0027-real-404-and-share-marker.md`) — a
plain 200 is not enough because the host may serve a fallback for an unknown path.
When the page is live, the URL is copied and an Open link appears. In-flight
publications are persisted (`shares.js`, localStorage) so a refresh or navigating
away **resumes polling** without minting a second `share_id`; the record
self-heals once the build carries the `share_id`. Unshare removes the `share_id`
line and commits, so the build removes the page; it is optimistic (treated as not
shared immediately, self-healing when the build aligns).

## User stories / scenarios

- As a vault owner, I press Share and get a link that is only handed to me once it
  actually works.
- As a vault owner, if I refresh mid-publish, the sheet reopens and resumes
  waiting, not a duplicate share.
- As a vault owner, I unshare a note and its public page goes away.

## Acceptance criteria

1. Share stages `share_id` (plus that note's pending edits) and commits only that
   single note; other notes' drafts are untouched.
2. The share sheet waits for the build by polling `/shared/<id>/` until it returns
   200 **with the share-page marker**, then enables copy and Open with the URL.
3. In-flight publications persist and resume polling after a refresh without
   generating a second `share_id`; the record clears once the build reflects it.
4. Unshare removes the `share_id` line and commits; the UI treats the note as
   unshared optimistically and self-heals on the next build.

## Out of scope

- Generating the public page itself (`adr/0025-public-share-pages.md`).
- The Access Bypass that makes `/shared/*` public
  (`adr/0026-cloudflare-pages-access.md`).

## Open questions

- In-app hot-refresh of a note's own content after an edit commit (not
  implemented; share already re-fetches content on completion).

## References

- src/components/ShareSheet.jsx, src/lib/shares.js, functions/commit.js
- adr/0022-frontmatter-preserved-line-ops.md, adr/0025-public-share-pages.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
