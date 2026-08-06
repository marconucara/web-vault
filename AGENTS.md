# AGENTS.md

This file provides guidance to coding agents working in this repository.

## What this repository is

web-vault is a distributable, static web viewer and editor for Markdown
knowledge vaults: browse notes and saved views in a browser, edit them with a
WYSIWYG block editor, and publish isolated public share links. It is packaged
as a **framework** — a single npm package exposing a `wv` CLI (`dev` / `build`
/ `preview`) that owns all the app code and the build pipeline, while each
adopter's project keeps only a thin shell (config + dependency). It is strongly
inspired by and compatible with [Tolaria](https://github.com/refactoringhq/tolaria)
vaults and targets generic Markdown vaults; compatibility is verified against
Tolaria and Obsidian. The `adr/` catalogue is
the source of truth for the decisions this system embodies.

## Repository structure

- `adr/0000-template.md` — canonical ADR template.
- `adr/NNNN-<kebab-slug>.md` — one ADR per decision, contiguous numbering, no
  gaps.
- `INDEX.md` — table regenerated from every ADR's metadata block.
- `CONVENTIONS.md` — authoring rules (read before editing anything).
- `plan/todo/NNNN-<slug>.md` — pending work, lower numbers run first.
- `plan/done/<YYYY-MM-DD>-<slug>.md` — shipped work, chronological.
- `_agent/` — single-agent coordination: `ROLES.md`, `WORKLOG.md`,
  `CURRENT_FOCUS.md`, `HANDOFF.md`, `prompts/`.

The web-vault application and build scripts live in `src/`, `scripts/`,
`lib/`, `functions/`, `bin/`, and `index.html`.

## Hard rules when editing ADRs

These come from `CONVENTIONS.md` and override default behaviour:

- **One decision per ADR.** Splits become new ADRs that supersede; never expand
  scope inside an existing one.
- **Status lifecycle:** `Proposed → Accepted → Implemented → (Superseded | Deprecated)`.
- **Capability ADR section order:** metadata → Context → Capability statement →
  User stories / scenarios → Acceptance criteria → Out of scope → Open
  questions → References → Revision History → Approvals.
- **Acceptance criteria are testable and numbered.**
- **ADRs are internal artefacts — never user-visible.** ADR numbers, ADR
  titles, and the existence of the ADR catalogue must NEVER appear in any
  string the product emits to users: UI copy, API response bodies, error
  messages, customer-visible log lines, public documentation, release notes,
  marketing copy, or support communications. References ARE allowed in: code
  comments (`// see adr/0015-*.md`), commit messages, PR descriptions, internal
  docs, `AGENTS.md`, `CONVENTIONS.md`, `INDEX.md`, and the `plan/` queue.

## Language (hard rule)

- All repository content — source code, comments, error messages, UI copy,
  documentation, these files — is **English**. The only non-English text
  allowed is content coming from a user's own vault notes.
- Chat with a contributor or agent may be in any language; that is for the
  conversation only and never reaches files, documents, or UI.
- A future user-facing i18n layer (i18n message files) does not change this:
  source strings and repo docs stay English; i18n is a separate layer.

## Implementation work

- Start from the ADRs. Identify which ADRs a code change implements or affects
  before changing behaviour.
- If implementation reveals a capability gap or changed decision, update the
  relevant ADR rather than silently diverging.
- Add or update tests for implemented behaviour. Map tests back to ADR
  acceptance criteria where practical.
- **Do not leak ADR identifiers into user-visible surfaces.** Refer to
  behaviour by its product-level name; the ADR link belongs in the commit
  message and (optionally) an inline code comment, not in the string the user
  reads.

## Audit trail and revision discipline

- Substantive ADR changes append a row to the Revision History table. Editorial
  changes (typos, formatting, link fixes) are excluded but flagged `editorial`
  in the commit message.
- Approvals table populates when an ADR is Accepted and updates on each later
  substantive revision.
- Regenerate `INDEX.md` from ADR metadata after any ADR status change or new
  ADR.

## Multi-agent workflow

A single agent owns this repo. The `_agent/` directory tracks live state and
history; LOCKS discipline is not in use.

## Plan folder

- A pending item gets a `plan/todo/NNNN-<slug>.md` file BEFORE work starts,
  naming the owning ADR(s), scope, and exit criteria.
- The completion event is: the change is fast-forwarded onto `main` and pushed,
  with the verify gate green. On completion, `git mv` the file to
  `plan/done/<YYYY-MM-DD>-<slug>.md` with a footer naming the HEAD SHA and any
  artefact id.
- The owning ADR(s) advance `Accepted → Implemented` on the same commit.
  Regenerate `INDEX.md`.

## Git contract

- Commit messages follow **Conventional Commits**.
- Mandatory `Rationale:` footer on any commit touching an ADR.
- Signed commits: yes.
- ADR-revision tags `adr-NNNN-rN`: no.
- Co-Authored-By trailer: no.
- Cross-references between ADRs use relative paths (`adr/NNNN-*.md`).
- **Integration:** direct-to-main, **fast-forward only**. No merge commits on
  `main`. The verify gate is `yarn verify` (`yarn typecheck` + `yarn test`); it
  must pass before push. Completion event: fast-forwarded to `main` + remote
  push succeeded.
- **The gate is self-contained in this repo.** It must stay runnable from a bare
  clone + install so it can move to a hosted CI unchanged. Never add a step that
  needs a vault outside the repo.
- **Never run `wv build`/`wv dev` from this repo's root.** `wv` resolves the
  vault as `process.cwd()/..`, so from here it treats the parent directory as a
  vault and builds unrelated notes into a stray `dist/`. Those commands belong
  to a consumer `.web` project; linking one with `portal:` is a development aid,
  not a gate step.

## Cutting a release

Versioning follows `adr/0037-versioning-and-release-policy.md`: semver over
annotated git tags `vX.Y.Z`, no GitHub Releases. In `0.x` a breaking change to
the adopter-facing contract (CLI, shell config, vault layout, deploy substrate)
rides the **minor**; additive changes and fixes ride the **patch**.

The version lives in **four** places and they must move together, in the same
commit as the tag. A stale one is silent — nothing fails, the damage shows up
later in someone else's install:

| Where | What | If it is stale |
|-------|------|----------------|
| `package.json` `version` | the declared version | the running app reports the wrong version, so the upgrade notice compares against it wrongly (`adr/0038-*.md`) |
| git tag `vX.Y.Z` | the published version | — |
| `SETUP.md` (dependency pin) | `web-vault#vX.Y.Z` | new adopters install an old version |
| `README.md` (`blob/vX.Y.Z/SETUP.md`) | the onboarding prompt link | the agent follows outdated install instructions |

The declared `version` and the tag name must match at the tagged commit — that
is what makes a version *published*. This has drifted before: at `v0.5.0` the
`SETUP.md` pin still said `v0.3.0`, two releases behind, and was caught by
chance rather than by any check. Grep `v[0-9]` across the repo before tagging;
treat any hit outside `_agent/` history as a place to update.
