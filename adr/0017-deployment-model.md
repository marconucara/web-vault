---
adr: 0017
title: Deployment model — deployment-agnostic core, Cloudflare Pages as the first target
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002, 0003]
tags: [architecture, deploy, portability]
---

# ADR 0017 — Deployment model — deployment-agnostic core, Cloudflare Pages as the first target

## Context

web-vault is a web tool meant to run under **different deployments**. No single
host may be the architectural centre. The product decomposes into portable
primitives: a **static site** (the build output) and — only when the convenience
editor is enabled — a **same-origin serverless commit endpoint** plus a bit of
host deploy config. These primitives exist on every serious static/serverless
host, so the architecture stays host-neutral and the host-specific pieces are an
**adapter**, not the core.

Cloudflare Pages is the **first** deployment with native, first-class support
(static hosting, Pages Functions for the commit endpoint, and Access for
privacy), which is why the current ADRs describe Cloudflare specifics. That is a
starting target, not the architecture: other deployments (Netlify, Vercel, a
plain static host plus a separate function, or self-hosted) can be added without
touching the app or the content pipeline.

## Capability statement

The build produces host-neutral artifacts — a static site, and (when editing is
enabled) a same-origin serverless commit endpoint plus deploy config — and
web-vault natively supports **Cloudflare Pages as its first deployment**. Nothing
in the app core or the content pipeline assumes Cloudflare; the host-specific
pieces (Pages Functions file layout, `wrangler.toml`, `_headers`, Access, the
`CF_PAGES_*` build variables) form the Cloudflare adapter, isolated and
replaceable. Adding another deployment target is an adapter, not a rewrite.

## User stories / scenarios

- As an adopter, I deploy web-vault on Cloudflare Pages with first-class support
  today.
- As a future adopter, I can target another host by adding an adapter, without
  the app or content pipeline changing.
- As a maintainer, Cloudflare-specific config lives in one place and does not
  leak into the app core.

## Acceptance criteria

1. The core build output is a static site consumable by any static/CDN host, with
   no host-specific assumptions in the app or content pipeline.
2. The editor's commit endpoint is a same-origin serverless function whose
   handler logic is host-neutral (a factory), with only the route wiring being
   host-specific (`adr/0018-edit-commit-via-pages-function.md`,
   `adr/0005-framework-package.md`).
3. Host-specific configuration (`wrangler.toml`, `_headers`, Access, `CF_PAGES_*`)
   is confined to the Cloudflare deployment adapter, not the app core
   (`adr/0026-cloudflare-pages-access.md`).
4. Cloudflare Pages is the one deployment supported today; the architecture does
   not preclude adding others.

## Out of scope

- Implementing a second deployment target now — only Cloudflare Pages is
  supported today.
- The Cloudflare Access privacy model itself
  (`adr/0026-cloudflare-pages-access.md`).

## Open questions

- Which second deployment target to support first (Netlify / Vercel / plain
  static host + function), and how the deploy-config-as-code generalises beyond
  `wrangler.toml`.
- How much of the current Cloudflare specifics (Functions layout, `CF_PAGES_*`)
  should be abstracted behind an adapter interface before the second target.

## References

- adr/0002-build-time-content-pipeline.md
- adr/0018-edit-commit-via-pages-function.md
- adr/0026-cloudflare-pages-access.md
- adr/0026-cloudflare-pages-access.md
- adr/0005-framework-package.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after articulating the deployment-agnostic stance; Cloudflare Pages is the first supported target (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
