---
adr: 0025
title: Isolated public share pages
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002, 0024]
tags: [share, build, privacy]
---

# ADR 0025 — Isolated public share pages

## Context

Public sharing (`adr/0024-share-unshare-from-app.md`) marks a note with a
`share_id` in its frontmatter. From that, the build must produce a **public**
page for the note — but the vault is private, so the page must reveal nothing
about the notes that are not shared, and must not be search-indexed. It also must
not ship the private app bundle (which carries the whole vault's content).

## Capability statement

At build time, for each note carrying a `share_id`, the build generates an
**isolated, self-contained static page** at `dist/shared/<share_id>/index.html`,
marked `noindex` and rendered by a standalone renderer (not the private app
bundle). Isolation: `[[wikilinks]]` in the body become links only to notes that
are **themselves shared**, otherwise they stay plain text; frontmatter
relationships show only shared targets. This way the titles and content of
private notes are never revealed on a public page. The same renderer serves these
pages on demand under `wv dev`, so dev matches production.

## User stories / scenarios

- As a vault owner, a shared note becomes a public page that exposes only that
  note, never the private ones it links to.
- As a vault owner, share pages are not indexed by search engines.
- As a reader of a shared link, the page is self-contained and does not pull in
  the private app.

## Acceptance criteria

1. Each note with a `share_id` produces `dist/shared/<share_id>/index.html`,
   `noindex`, rendered by the standalone share renderer (no app bundle).
2. Body `[[wikilinks]]` link only to targets that are themselves shared; others
   render as plain text; frontmatter relationships show only shared targets.
3. No content, title, or metadata of a non-shared note appears on any share page.
4. The dev server renders the same share pages on demand via the shared renderer.

## Out of scope

- The in-app share/unshare flow and wait-for-build
  (`adr/0024-share-unshare-from-app.md`).
- Making `/shared/*` publicly reachable — that is the Access Bypass
  (`adr/0026-cloudflare-pages-access.md`).
- The share-page marker used to detect a live page
  (`adr/0027-real-404-and-share-marker.md`).

## Open questions

- None.

## References

- scripts/build-shared.mjs, scripts/shared-render.mjs
- adr/0024-share-unshare-from-app.md, adr/0026-cloudflare-pages-access.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
