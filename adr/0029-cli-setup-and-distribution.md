---
adr: 0029
title: Delivery — wv CLI, agent-driven setup, and git-repo distribution
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0005]
tags: [cli, setup, onboarding, distribution, packaging]
---

# ADR 0029 — Delivery — wv CLI, agent-driven setup, and git-repo distribution

## Context

web-vault is a framework package (`adr/0005-framework-package.md`); this ADR covers
how a vault owner **receives it, installs it, and runs it**. The audience is vault
owners who are not necessarily developers: someone using a Markdown vault should not
have to learn npm, Vite, or bundler flags. Three delivery questions follow —
what command they run, how the package gets into their vault, and how it is
distributed — and they are decided together because they share that audience.

## Capability statement

**One command: `wv`.** The package exposes a `wv` bin with `wv dev`, `wv build`,
and `wv preview`, wrapping the Vite pipeline so the owner never invokes Vite or
bundler internals directly. The CLI also absorbs the local-linking mechanics that
would otherwise leak to the user: it runs children under `--preserve-symlinks` /
`--preserve-symlinks-main`, propagates `process.execArgv` to spawned build scripts,
and the Vite config sets `resolve.preserveSymlinks`, so a linked (`portal:`) package
resolves correctly without the user configuring anything.

**Agent-driven setup.** Installation into an existing vault is **agent-driven from a
spec file** the coding agent reads — not a separate skill, prompt, or interactive
`npx` wizard. The flow is: create/point at a vault, add the dependency, and write the
minimal config; the agent performs it from the spec, consistent with the product's
primary editing path being coding agents (`adr/0004-vault-compatibility-target.md`).
Scaffolding the shell is **pure file-writing and requires no local toolchain** — no
Node, Yarn, or install — so a vault owner who is not a developer can be onboarded.
Node and Yarn are needed only to *test the site locally* (optional); the deploy
build runs in the cloud, so it needs no local toolchain either.

**Distribution: public git repo.** The package is distributed as a **git dependency
from a public GitHub repository**, not an npm publish (for now). This keeps the first
release simple and needs no registry account. GitHub is used concretely rather than
abstracted away, but the choice is not exclusive: an npm publish or another host
remains open as a later addition.

## User stories / scenarios

- As a vault owner, I run `wv dev` / `wv build` and never touch Vite or symlink
  flags.
- As a vault owner, my coding agent installs and configures web-vault from a spec
  file, without me running an interactive wizard.
- As a vault owner, I add the package straight from its public GitHub repo, with no
  npm-registry account.

## Acceptance criteria

1. The package exposes a `wv` bin providing `dev`, `build`, and `preview`; the user
   does not invoke Vite or symlink flags directly.
2. The CLI makes a locally linked package resolve correctly (preserve-symlinks for
   itself and spawned children, `execArgv` propagation, Vite `preserveSymlinks`).
3. Setup into an existing vault is performed by a coding agent from a spec file — no
   separate skill/prompt and no interactive `npx` wizard.
4. The package is installable as a git dependency from a public GitHub repo without
   an npm publish, and the design does not preclude npm/other hosts later.
5. Scaffolding the consumer shell into a vault requires no local toolchain (no
   Node, Yarn, or install step); Node and Yarn are needed only for optional local
   testing, and the deploy build runs in the cloud.

## Out of scope

- The framework-package architecture itself (`adr/0005-framework-package.md`).
- Cloudflare deploy and Zero Trust setup (`adr/0026-cloudflare-pages-access.md`).

## Open questions

- Whether/when to also publish to npm.
- The exact contents and location of the setup spec file — to be defined with the
  plan for this ADR (status Accepted: the `wv` CLI is implemented, while the
  agent-driven setup and public-repo distribution are not yet realised).

## References

- bin/wv.mjs, lib/vite-config.mjs, package.json
- adr/0005-framework-package.md, adr/0004-vault-compatibility-target.md,
  adr/0026-cloudflare-pages-access.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded the delivery model: `wv` CLI (implemented), agent-driven setup and public git-repo distribution (accepted, not yet realised) merged into one ADR (backfill). |
| 2026-07-30 | r2 | marco | Clarified that shell scaffolding requires no local toolchain (non-developers can onboard); Node/Yarn only for optional local testing, deploy builds in the cloud. Added acceptance criterion 5. |
| 2026-07-30 | r3 | marco | Implemented: shipped SETUP.md onboarding spec and README (public git-repo distribution) in v0.2.0; status Accepted → Implemented. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-30 | — |
