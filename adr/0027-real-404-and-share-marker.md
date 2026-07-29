---
adr: 0027
title: Real 404 page and a share-page marker
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0006, 0025]
tags: [routing, share, build]
---

# ADR 0027 — Real 404 page and a share-page marker

## Context

Two related needs come out of static hosting with hash routing
(`adr/0006-hash-based-routing.md`). First, an unknown path should show a real,
styled not-found page, not a raw host error. Second, the share wait-for-build
polling (`adr/0024-share-unshare-from-app.md`) must tell a **live** share page
from a host fallback: a static host can answer `200` for a path that does not
exist yet, so a bare `200` is not proof the share page is deployed.

## Capability statement

The build emits a real `dist/404.html` styled like the app's empty state. Each
generated share page (`adr/0025-public-share-pages.md`) carries a marker meta tag
`<meta name="x-web-vault-shared">`, and the share wait-for-build polling checks
for that marker — not just a `200` — to confirm the page is genuinely live before
handing the user a working link. The 404 page and the marker together let the
client distinguish app route, live share page, and genuine not-found.

## User stories / scenarios

- As a reader, an unknown URL shows a proper not-found page.
- As a vault owner publishing a share, the "activation in progress" state ends
  only when the real page (with the marker) is live, so the copied link works.

## Acceptance criteria

1. The build writes a styled `dist/404.html`.
2. Every share page includes the `x-web-vault-shared` marker meta tag.
3. The share wait-for-build polling treats a page as live only when the response
   is `200` **and** contains the marker (`adr/0024-share-unshare-from-app.md`).
4. The marker string is consistent between the page generator and every consumer.

## Out of scope

- The share flow and polling loop itself
  (`adr/0024-share-unshare-from-app.md`).
- Share-page generation and isolation (`adr/0025-public-share-pages.md`).

## Open questions

- None.

## References

- scripts/build-404.mjs, scripts/build-shared.mjs, src/components/ShareSheet.jsx
- adr/0006-hash-based-routing.md, adr/0025-public-share-pages.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
