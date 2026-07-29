---
adr: 0013
title: Copy vault attachments into the build output
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002]
tags: [build, attachments, assets]
---

# ADR 0013 — Copy vault attachments into the build output

## Context

Vault notes link binary assets (PDFs, images, …) kept in the vault's
`attachments/` folder, typically with relative links like `../attachments/x.pdf`.
With hash routing (`adr/0006-hash-based-routing.md`) the document stays served at
`/`, so such a link resolves to `/attachments/x.pdf`. If those files are not in
the deploy, the host returns its 404 fallback (HTML) instead of the asset.

## Capability statement

After the app build, the build copies the vault's `attachments/` folder into
`dist/attachments`, so relative asset links in notes resolve to real files. These
assets are private — the whole site is behind Access
(`adr/0026-cloudflare-pages-access.md`); only pages under `/shared/*` are public.

## User stories / scenarios

- As a reader (authenticated), I open a note's linked PDF/image and it downloads
  or renders, rather than hitting a 404.
- As a vault owner, my attachments stay private behind the same gate as the rest
  of the site.

## Acceptance criteria

1. The build copies the vault `attachments/` directory into `dist/attachments`.
2. A note's relative link (`../attachments/x`) resolves to `/attachments/x` at
   runtime under hash routing.
3. If the vault has no `attachments/` folder, the step is a no-op and the build
   still succeeds.

## Out of scope

- Making attachments public (they are private by default; only `/shared/*` is
  public — `adr/0026-cloudflare-pages-access.md`).
- Rendering attachments in the editor (`adr/0016-wikilink-and-media-blocks.md`).

## Open questions

- None.

## References

- scripts/copy-attachments.mjs
- adr/0006-hash-based-routing.md, adr/0026-cloudflare-pages-access.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
