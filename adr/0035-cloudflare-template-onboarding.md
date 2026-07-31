---
adr: 0035
title: Second delivery path — Cloudflare starter template for near-one-click onboarding
status: Implemented
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0029, 0005, 0040]
tags: [distribution, onboarding, deployment, cloudflare]
---

# ADR 0035 — Second delivery path — Cloudflare starter template for near-one-click onboarding

## Context

`adr/0029-cli-setup-and-distribution.md` established the **first** delivery path:
the `wv` CLI plus agent-driven setup from a spec file into an **existing** vault,
distributed as a git dependency, with the Cloudflare deploy done manually
(`adr/0026-cloudflare-pages-access.md`). That path fits a vault owner who already
has a vault and a coding agent.

A second audience wants to start from near-zero: no existing vault, no agent
walkthrough — just a **starter/template repository** they can instantiate and
deploy to Cloudflare Pages in roughly one click, getting a working web-vault with a
sample vault immediately, then repoint it at their own content. `adr/0005-framework-package.md`
considered a "template" only as a *package architecture* (and chose the dependency
shape); this is different — a template as an **onboarding and deploy path**, not a
way to own the code. This ADR adds that second path **alongside** 0029; it does not
replace it.

## Capability statement

web-vault provides a public template/starter repository that a user can instantiate
and deploy to Cloudflare Pages with near-one-click (a "Deploy to Cloudflare" flow),
producing a running instance with minimal manual steps. The template carries the
thin consumer shell — config plus the web-vault dependency, per
`adr/0005-framework-package.md` — and a minimal starter vault, so a new user gets a
working viewer/editor out of the box and can point it at their own vault afterward.
The commit token remains a deploy secret set in the deployment, never baked into the
template. The README documents **both** delivery paths and when to use each.

## User stories / scenarios

- As a newcomer with no vault, I click "Deploy to Cloudflare" on the template and
  get a running web-vault with a sample vault, without scaffolding anything by hand.
- As that user, I later repoint the instance at my own vault.
- As a prospective adopter, the README shows me both onboarding paths and which fits
  me.

## Acceptance criteria

1. A public template/starter repository exists that instantiates the consumer shell
   (config + web-vault dependency, per `adr/0005-framework-package.md`) plus a
   minimal starter vault.
2. The template supports a near-one-click Cloudflare Pages deploy (a "Deploy to
   Cloudflare" button/flow) yielding a running instance with minimal manual
   configuration.
3. The deployed instance runs the viewer/editor against the starter vault out of the
   box, and the user can repoint it at their own vault.
4. The one-click flow surfaces where to set the GitHub commit token as a **deploy
   secret** (`adr/0018-edit-commit-via-pages-function.md`,
   `adr/0026-cloudflare-pages-access.md`) rather than baking it into the template.
5. **The README is updated** to document both delivery paths — agent-driven setup
   into an existing vault (`adr/0029-cli-setup-and-distribution.md`) and the
   one-click template — and when to use each.

## Out of scope

- The framework-package architecture (`adr/0005-framework-package.md`) and the
  agent-driven / existing-vault path (`adr/0029-cli-setup-and-distribution.md`).
- Cloudflare access / Zero Trust configuration (`adr/0026-cloudflare-pages-access.md`).
- Publishing to npm (an open question in 0029).

## Open questions

Resolved during implementation (see Revision History r3):

- **Location:** the template lives in the **same repository**, at
  `templates/base/` (not a separate starter repo). The "Deploy to Cloudflare"
  button clones that subfolder as the new repo's root, so it ships self-contained.
- **Starter vault:** a **curated minimal sample** — `welcome.md` (a setup
  checklist plus a live feature demo with map pins) and one saved view.
- **Shape:** the `.web` layout (identical to a real vault), so `templates/base/`
  holds the sample vault at its root with the shell in `.web/`. The button points
  at `templates/base`; the adopter sets **Path = `/.web/`** in the flow (the one
  manual step inherent to the `.web` shape — the button's subdirectory model
  clones only the pointed folder, which is why the folder must be self-contained).

## References

- adr/0029-cli-setup-and-distribution.md
- adr/0005-framework-package.md
- adr/0040-cloudflare-workers-deploy-substrate.md
- adr/0026-cloudflare-pages-access.md
- adr/0018-edit-commit-via-pages-function.md
- README.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |
| 2026-07-31 | r2 | marco | The substrate is now Workers (`adr/0040-*`), which is what makes the one-click button viable (the button supports only Workers). Added the template-shape open question (`.web` subdirectory vs flat repo) deferred to this ADR's implementation. |
| 2026-07-31 | r3 | marco | Implemented. Template lives at `templates/base/` in this repo (same-repo, self-contained folder the button clones as root); curated sample vault with a `welcome.md` demo; `.web` shape with a manual `Path = /.web/` step. README documents both onboarding paths. Live button test confirmed the subfolder-as-root clone behaviour. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-31 | — |
