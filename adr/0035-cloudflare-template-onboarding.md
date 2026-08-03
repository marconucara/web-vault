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
deploy to Cloudflare in roughly one click, getting a working web-vault with a
sample vault immediately, then repoint it at their own content. `adr/0005-framework-package.md`
considered a "template" only as a *package architecture* (and chose the dependency
shape); this is different — a template as an **onboarding and deploy path**, not a
way to own the code. This ADR adds that second path **alongside** 0029; it does not
replace it.

## Capability statement

web-vault provides a public template/starter repository that a user can instantiate
and deploy to Cloudflare Workers with near-one-click (a "Deploy to Cloudflare" flow),
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
2. The template supports a near-one-click Cloudflare Workers deploy (a "Deploy to
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
6. **The one-click path does not reshape the product.** No change to the vault
   layout, the `.web` shell, or the repository structure is made for the sole
   purpose of satisfying the one-click deploy flow. Where the flow's constraints
   conflict with the structure the product has chosen, the flow yields: the
   onboarding path absorbs the extra manual step, or is delivered differently.
   This is scoped to this ADR — other tooling may well deserve accommodation.
7. **The template is a real vault.** The template repository is shaped exactly
   like an ordinary vault an adopter would keep: sample notes at the root, the
   shell in `.web/`, no structural variant that exists only to make the one-click
   flow work. What the newcomer deploys is what they keep working in afterwards.
8. **The starter note is a round-trip fixture.** `welcome.md` is the first note a
   newcomer opens in the editor, so it doubles as the fidelity fixture for
   `adr/0015-durable-markdown-round-trip.md`: a verbatim copy lives at
   `src/lib/__fixtures__/welcome.md` and the round-trip suite runs against it.
   The two copies are kept in sync — a change to the template's welcome note is
   mirrored into the fixture in the same change. Testing the real note (rather
   than a reduced stand-in) is what makes the guarantee meaningful; keeping the
   note authored as ordinary markdown, never reshaped to dodge a round-trip
   defect, is criterion 7 applied to its content.

## Out of scope

- The framework-package architecture (`adr/0005-framework-package.md`) and the
  agent-driven / existing-vault path (`adr/0029-cli-setup-and-distribution.md`).
- Cloudflare access / Zero Trust configuration (`adr/0026-cloudflare-pages-access.md`).
- Publishing to npm (an open question in 0029).

## Open questions

Resolved during implementation (see Revision History r3, r4):

- **Location: a separate repository** — `marconucara/web-vault-template`, not a
  subfolder of this one. A same-repo `templates/base/` was tried and reverted.
  The "Deploy to Cloudflare" button accepts a subfolder URL and its UI does show
  the folder, but the flow then fails with a generic monorepo error *before*
  reaching the configuration screen, because the pointed folder has no
  `wrangler.toml` at its root. With the `.web` shape it never will — and the
  **Path** setting that would point the build at `.web/` is only reachable after
  the step that fails. The same folder as the root of its own repository is
  accepted, despite having no root-level `wrangler.toml` either. The entry point
  must therefore be a repository root.

  Flattening the template — hoisting the shell so a `wrangler.toml` sits at the
  pointed folder's root — is the obvious way to make the subfolder acceptable,
  and was not pursued: acceptance criteria 6 and 7 rule it out regardless of
  whether it would have worked. It would bend the vault layout around one deploy
  flow and hand the newcomer a template that is not shaped like the vault they go
  on to keep.
- **Starter vault:** a **curated minimal sample** — `welcome.md` (a setup
  checklist plus a live feature demo with map pins) and one saved view.
- **Shape:** the `.web` layout, identical to a real vault: the sample vault at
  the repository root with the shell in `.web/`. The adopter sets **Path =
  `/.web/`** in the flow — the one manual step inherent to the `.web` shape, and
  the cost this ADR accepts rather than reshaping the vault (criterion 6).

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
| 2026-07-31 | r4 | marco | Reverted the same-repo location: the button rejects a subfolder without a root `wrangler.toml`, failing before the screen where Path would be set, so the entry point must be a repository root. Template returns to the standalone `web-vault-template` repository and `templates/base/` is removed. Added acceptance criteria 6 and 7 — the one-click path does not reshape the product, and the template is a real vault — the principles under which reshaping the template to fit the button was rejected. |
| 2026-08-01 | r5 | marco | Implemented. The standalone `marconucara/web-vault-template` repository is restored as the one-click entry point and a live button test from its root reaches the configuration screen — the step that failed with the subfolder. All seven acceptance criteria met. |
| 2026-08-03 | r6 | marco | Added acceptance criterion 8: the starter `welcome.md` is mirrored as the round-trip fixture for ADR 0015 and the two copies move together. Opening it in the editor degraded it (soft wraps became hard breaks, task-item continuations escaped their item), which a reduced stand-in fixture had not caught. Testing the real note keeps the guarantee honest and stops the template from being reshaped to hide an editor defect — criterion 7 applied to note content. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-31 | — |
