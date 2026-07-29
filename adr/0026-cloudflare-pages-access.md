---
adr: 0026
title: Cloudflare Pages deployment — configurable access, versioned config, runbook setup
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0017]
tags: [deploy, cloudflare, access, privacy, config, runbook]
---

# ADR 0026 — Cloudflare Pages deployment — configurable access, versioned config, runbook setup

## Context

The deployment model is host-neutral (`adr/0017-deployment-model.md`) and
Cloudflare Pages is the first supported target. How the deployment is **secured
is the user's choice**: the vault is usually private, so a private-by-default
posture is recommended, but a fully public deployment is also valid. When private,
the isolated share pages (`adr/0025-public-share-pages.md`) must still be publicly
reachable. Separately, the Pages hosting/build settings should be **versioned in
the repo**, not only clicked into a dashboard, so a deployment is reproducible.
Some setup steps cannot live in the repo at all: Cloudflare Access applications
and policies live in the account, so they are delivered as a documented runbook
rather than infrastructure-as-code.

## Capability statement

On the first supported deployment (Cloudflare Pages) the security posture is
configurable:

- **Public** — no identity gate. Advisably the GitHub token is then **not**
  configured, so there is no editing surface exposed; enabling the editor on a
  public site is technically possible but only if the owner accepts the exposure.
- **Private (recommended)** — an identity gate via Cloudflare Access / Zero Trust,
  using email or **any access method Zero Trust offers** (and, in future, another
  provider's equivalent — `adr/0017-deployment-model.md`). A path-scoped `Bypass`
  on `/shared/*` keeps the share pages public while the rest is gated; the commit
  endpoint at `/api/commit` (`adr/0018-edit-commit-via-pages-function.md`) inherits
  the gate.

Hosting/build config is **versioned in the repo**: `wrangler.toml` (project name,
build output dir, compatibility date) and `public/_headers` (security headers +
immutable caching for fingerprinted assets); there is **no `_redirects`**, because
hash routing needs no SPA rewrite (`adr/0006-hash-based-routing.md`). Secrets and
the build command stay out of these files (dashboard/host settings).

The step-by-step deploy + Zero Trust setup is delivered as a **documented
runbook** (a README or a dedicated section), not Terraform / IaC: connecting the
repo to Cloudflare Pages, setting the build command, adding secrets (e.g.
`GITHUB_TOKEN`), and — for a private deployment — creating the Access
application(s): an `Allow` policy for the chosen identity/method over the domain
and a path-scoped `Bypass` on `/shared/*`. Codifying the Access setup via the
Cloudflare API (for example a `wv cloudflare setup` command) is a possible future
step, not part of this release.

## User stories / scenarios

- As a vault owner, I choose whether the deployment is public or private.
- As a privacy-conscious owner, I gate the whole site with my email — or any Zero
  Trust access method — and only `/shared/*` stays public.
- As an owner of a public site, I deploy without a gate and, advisably, without a
  GitHub token, so there is no editing surface.
- As a maintainer, hosting/build config lives in the repo, so the deployment is
  reproducible rather than dashboard-only.
- As an adopter, I follow one runbook to deploy and (optionally) gate my site,
  without learning Terraform.

## Acceptance criteria

1. The deployment posture is configurable: fully public, or private behind a
   Cloudflare Access / Zero Trust identity gate using email or any available
   access method.
2. Private-by-default is the recommended posture for a private vault, but not a
   hard requirement; a fully public deployment is supported.
3. When private, a path-scoped `Bypass` on `/shared/*` makes share pages public
   while the rest is gated, and the commit endpoint inherits the gate.
4. When public, editing is advisably disabled by not configuring the GitHub token;
   enabling it remains technically possible if the owner accepts the exposure.
5. Hosting/build config is versioned in the repo: `wrangler.toml` (name, output
   dir, compatibility date) and `public/_headers` (security + asset caching); no
   `_redirects`. Secrets and the build command are not in these files.
6. A runbook (README or dedicated section) documents: repo→Pages connection, build
   command, secrets, and — for private — the Access `Allow` policy plus the
   `/shared/*` `Bypass`. No Terraform / IaC dependency is introduced.

## Out of scope

- Automating the Access setup (a possible future `wv cloudflare setup` via the
  Cloudflare API).
- Non-Cloudflare deployment targets (`adr/0017-deployment-model.md`).

## Open questions

- The recommended default access method, and where the runbook lives (top-level
  README vs a dedicated deploy doc) — to be settled with the plan for this ADR.
- Whether and when to codify the Access setup via the Cloudflare API rather than a
  manual runbook.

## References

- wrangler.toml, public/_headers
- adr/0017-deployment-model.md, adr/0025-public-share-pages.md
- adr/0018-edit-commit-via-pages-function.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact; folds the versioned deploy config and the documented runbook setup into this ADR and states the configurable public/private posture (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
