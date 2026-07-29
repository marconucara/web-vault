---
adr: 0020
title: Commit to the deployment's own branch by default
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0018]
tags: [commit, deploy, branch]
---

# ADR 0020 — Commit to the deployment's own branch by default

## Context

An edit committed from a running deployment should go to the branch **that
deployment was built from**, so the resulting push re-triggers that same build
and the site refreshes with the new content. Hardcoding `main` would break
preview/working-branch deployments (they would commit to `main` and never rebuild
themselves). The branch therefore has to be discovered from the build, not fixed
in the client.

## Capability statement

The commit endpoint targets, by default, the branch the deployment was built
from, so the push re-triggers the same build; a `GITHUB_BRANCH` runtime variable
overrides it when needed. On the first supported deployment (Cloudflare Pages)
the build branch comes from the host's `CF_PAGES_BRANCH` variable, injected into
the generated endpoint's config at build time
(`adr/0005-framework-package.md`); locally it defaults to `main`. The
resolution order is: `GITHUB_BRANCH` (runtime) → the build-injected branch →
`main`.

## User stories / scenarios

- As an editor-user on a preview/working-branch deployment, my commit goes to
  that branch and rebuilds that preview, not production.
- As an editor-user on the production deployment, my commit goes to the
  production branch and rebuilds it.
- As an operator, I can force a specific branch with a single runtime variable.

## Acceptance criteria

1. With no override, the endpoint commits to the branch the deployment was built
   from, so the push re-triggers that deployment's build.
2. The build branch is injected at build time from the host's build variable (on
   Cloudflare, `CF_PAGES_BRANCH`); locally it defaults to `main`.
3. A `GITHUB_BRANCH` runtime variable overrides the target branch and wins over
   the build-injected value.

## Out of scope

- How the endpoint file and its injected config are generated in the packaged
  framework (`adr/0005-framework-package.md`).
- Non-Cloudflare build variables — deferred with the deployment model
  (`adr/0017-deployment-model.md`).

## Open questions

- The build-branch variable is Cloudflare-specific (`CF_PAGES_BRANCH`); a second
  deployment target would supply its own equivalent, resolved by the same
  build-time injection.

## References

- functions/commit.js (branch resolution), scripts/generate-functions.mjs
- adr/0005-framework-package.md, adr/0017-deployment-model.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
