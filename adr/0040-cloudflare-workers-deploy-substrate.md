---
adr: 0040
title: Cloudflare Workers as the deploy substrate, superseding Pages
status: Implemented
date: 2026-07-31
owner: marco
supersedes: [0026]
superseded-by:
depends-on: [0017, 0018, 0035]
tags: [deploy, cloudflare, workers, access, privacy, onboarding]
---

# ADR 0040 — Cloudflare Workers as the deploy substrate, superseding Pages

## Context

The first supported Cloudflare target was **Pages**
(`adr/0026-cloudflare-pages-access.md`): static `dist/` plus a single Pages
Function at `/api/commit` (`adr/0018-edit-commit-via-pages-function.md`), gated by
Cloudflare Access with a `/shared/*` `Bypass`. Two forces make Pages the wrong
long-term substrate:

1. **One-click onboarding needs Workers.** The near-one-click template path
   (`adr/0035-cloudflare-template-onboarding.md`) depends on the "Deploy to
   Cloudflare" button, which **only supports Workers applications, not Pages**.
   Staying on Pages blocks 0035's acceptance criterion 2 outright.
2. **Workers Static Assets is the unified successor.** A Worker can serve the
   static `dist/` directory *and* the one dynamic route in a single deployment,
   with `run_worker_first` scoping the Worker to `/api/*` so static hits cost the
   same as Pages.

The concern that motivated the investigation — *does Cloudflare Access still work
on the free default domain?* — was settled by a live spike (`../wv-access-spike`):
Access protects `*.workers.dev` with full parity to `*.pages.dev`, so no custom
domain is required. The remaining differences from Pages are mechanical
(deploy-command split, Access hostname syntax, per-branch preview URLs) and are
captured as acceptance criteria below so they land in the deploy runbook rather
than being rediscovered per adopter.

The host-neutral deployment model (`adr/0017-deployment-model.md`) is unchanged:
this ADR only replaces the **first supported target's** substrate.

## Capability statement

web-vault deploys to Cloudflare as a **single Worker with Static Assets**: the
build output `dist/` is served as static assets and the sole dynamic route,
`POST /api/commit`, runs in the same Worker via a thin adapter over the existing
host-agnostic commit logic. The security posture is unchanged and remains
configurable (public, or private behind Cloudflare Access/Zero Trust) — and Access
now protects the **free `*.workers.dev` domain**, including per-branch preview
URLs, so a default-domain private deployment needs no custom domain. Owner-specific
hosting config stays versioned in the repo (`wrangler` config); secrets and the
build command stay out of it. The deploy + Zero Trust runbook is updated for the
Workers model.

## User stories / scenarios

- As a vault owner, I deploy to Cloudflare Workers and keep the free
  `*.workers.dev` domain, private behind Access, with `/shared/*` public — exactly
  as I did on Pages.
- As a newcomer, I can use the "Deploy to Cloudflare" one-click button, because the
  substrate is now a Worker (unblocks `adr/0035-*`).
- As an editor-user, committing still POSTs to same-origin `/api/commit`; the
  GitHub token stays a server secret and never enters the bundle
  (`adr/0018-*` intent preserved, endpoint mechanism updated).
- As a maintainer, per-branch preview deployments do not clobber production, and
  one Access policy covers both production and preview hosts.

## Acceptance criteria

1. The Cloudflare deployment is a **Worker with Static Assets**: `dist/` is served
   as assets and only `POST /api/commit` invokes the Worker
   (`run_worker_first: ["/api/*"]`); all other paths are served directly from
   assets.
2. `not_found_handling: "404-page"` serves the existing `dist/404.html`, preserving
   the real-404 and share-marker behavior (`adr/0027-real-404-and-share-marker.md`);
   hash routing means no SPA rewrite and no `_redirects`
   (`adr/0006-hash-based-routing.md`).
3. The commit endpoint is a **Worker `fetch` route** reusing `makeCommitHandler`
   (`functions/commit.js`) unchanged; the Cloudflare-specific pieces (`env.ASSETS`,
   the request routing) live only in the generated adapter, not in the shared
   handler, so the core stays host-agnostic (`adr/0017-deployment-model.md`).
4. The GitHub token is read only from `env.GITHUB_TOKEN` (a Worker secret) and never
   appears in the bundle or a response body — `adr/0018-*` criteria 1–3 still hold,
   with "Pages Function" now realised as a Worker route.
5. **Access on `*.workers.dev` is documented with the exact syntax**: production
   protected on the exact host `<worker>.<account>.workers.dev`; previews protected
   on the wildcard `*-<worker>.<account>.workers.dev`; a path-scoped `Bypass` on
   `/shared` on both host forms keeps share pages public while the rest is
   Restricted.
6. The runbook documents the **Workers Builds deploy-command split**: production
   branch runs `npx wrangler deploy`; non-production branches run
   `npx wrangler versions upload` (otherwise every branch overwrites production).
   The `npx` prefix is used so the command works with or without a local wrangler.
7. Owner-specific hosting config is versioned in the repo as a Workers `wrangler`
   config (`name`, `main`, `assets.directory`, `compatibility_date`,
   `run_worker_first`, `not_found_handling`); secrets and the build command are not
   in it.
8. `adr/0026-cloudflare-pages-access.md` is marked `Superseded` by this ADR, and
   the deploy documentation (`DEPLOY.md`) no longer instructs a Pages deployment as
   the primary path.

## Out of scope

- The template one-click flow and starter repo themselves — owned by
  `adr/0035-cloudflare-template-onboarding.md`; this ADR only makes them possible
  by switching substrate.
- Automating the Access setup via the Cloudflare API (still a documented runbook,
  as in `adr/0026-*`); a future `wv cloudflare setup` remains possible.
- Non-Cloudflare targets (Vercel, Netlify, …) — the host-agnostic core keeps them
  open (`adr/0017-deployment-model.md`) but they are not implemented here.
- The versioning/release mechanics for publishing the framework change
  (`adr/0037-versioning-and-release-policy.md`).

## Open questions

- Whether `dist/_headers` (security + immutable asset caching) is applied via a
  Workers Static Assets `_headers` file or moved into the Worker response — to be
  settled in the plan, keeping the same header rules either way.
- Whether the migrated `marconucaravault` reuses the existing Access applications
  or recreates them on the new hostname.

## References

- adr/0026-cloudflare-pages-access.md (superseded)
- adr/0018-edit-commit-via-pages-function.md (endpoint mechanism revised)
- adr/0035-cloudflare-template-onboarding.md (unblocked by this change)
- adr/0017-deployment-model.md, adr/0027-real-404-and-share-marker.md
- functions/commit.js, scripts/generate-functions.mjs, scripts/build-headers.mjs, DEPLOY.md
- Live spike: ../wv-access-spike (Workers + Static Assets + Access on *.workers.dev)

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-31 | r1 | marco | Initial draft. Records the Pages→Workers substrate migration validated by the wv-access-spike. |
| 2026-07-31 | r2 | marco | Accepted and implemented in web-vault v0.4.0 (`functions/worker.js`, `scripts/generate-worker.mjs`, `wv build` wiring; Pages `generate-functions.mjs` removed) and migrated in marconucaravault (`.web/wrangler.toml` → Workers shape). DEPLOY.md rewritten for Workers. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-31 | — |
