---
adr: 0006
title: Hash-based routing, no server SPA fallback
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0003]
tags: [architecture, routing, deploy]
---

# ADR 0006 — Hash-based routing, no server SPA fallback

## Context

The app is a static single-page app served from any static/CDN host. web-vault is
deployment-agnostic (`adr/0017-deployment-model.md`); no specific host is
assumed here. Client-side routing can use the History API (clean paths) or the
URL hash (`#/...`). History-API routing needs the host to rewrite every unknown
deep-link path back to `index.html`, and that catch-all rewrite collides with the
real paths this product serves: the isolated public share pages at
`/shared/<id>/`, the copied vault `/attachments/*`, and — where editing is
deployed — a same-origin serverless commit endpoint. Hash routing keeps the
requested server path always `/`, so those real paths are always served directly
and no SPA fallback is needed on any host. The cost is a `#` in in-app URLs,
acceptable for a private viewer.

## Capability statement

In-app navigation uses hash-based routes (`#/n/...`); the server only ever serves
real files at real paths and needs no catch-all SPA rewrite. Deep links into the
app resolve client-side from the hash, while `/shared/<id>/`, `/attachments/*`,
and `/api/*` remain real server paths served or executed directly.

## User stories / scenarios

- As a reader, I can deep-link to a note and it opens, with no server route
  configuration.
- As an operator, I deploy static files with no rewrite rules and nothing
  shadows the share pages, attachments, or Functions.

## Acceptance criteria

1. All in-app routes are hash-based (`#/...`); a deep link resolves client-side.
2. No catch-all `_redirects`/rewrite to `index.html` exists (see
   `adr/0026-cloudflare-pages-access.md`).
3. `/shared/<id>/`, `/attachments/*`, and `/api/*` are served/executed as real
   paths, not intercepted by app routing.

## Out of scope

- The real 404 page and how a genuine not-found is distinguished from an app
  route (`adr/0027-real-404-and-share-marker.md`).

## Open questions

- None.

## References

- adr/0026-cloudflare-pages-access.md
- adr/0027-real-404-and-share-marker.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
