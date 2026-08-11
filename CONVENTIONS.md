# Conventions

## Project

Project name: web-vault.

Artefact root: `.` (repository root) — `adr/`, `plan/`, `INDEX.md`, and this
file live at the repository root; `AGENTS.md` and `CLAUDE.md` also stay at the
root. Every lifecycle skill resolves paths against this root.

Assessment depth: full — the depth chosen at bootstrap. Skill assessments
pre-select it as the recommended depth; the depth selector always still
appears, so the record steers the recommendation and is never applied
silently. Change this line to change the recommendation.

## Language

All repository content is **English**: source code, code comments, error
messages, UI copy, documentation, and these convention files. Two kinds of text
are exempt:

- content that comes from a user's own vault notes; and
- **translated UI message catalogues** (`src/locales/<code>.json`) — a
  non-English catalogue is non-English *by definition*, which is the point of
  the file. The exemption covers the translated values only: keys, the reference
  catalogue `en.json`, and every string at its point of use in the source stay
  English.

Chat with a contributor or agent may happen in any language; that language is
for the conversation only and never reaches the files, documents, or UI. The
user-facing UI internationalisation (`adr/0047-ui-language-i18n-layer.md`) does
not change this rule: the source strings and all repository docs stay English,
and i18n is a separate translation layer on top.

## ADR Files

ADR filenames use `NNNN-kebab-case-slug.md`, zero-padded to 4 digits, with
contiguous numbering and no reserved gaps.

The number is an **integer**; the four-digit zero-padding is a display
convention only — tools sort ADRs **numerically**, not lexically, so the
catalogue is not capped at `9999` (widen the padding if you ever approach it).

Each ADR describes one decision. If a decision splits, supersede the original
ADR and create new ADRs rather than expanding scope inside a single document.

Status lifecycle: `Proposed → Accepted → Implemented → (Superseded | Deprecated)`.

| Status | Meaning |
|---|---|
| Proposed | Draft. Decision authored but not yet approved. |
| Accepted | Decision approved; implementation authorised. Work item lives in `plan/todo/`. |
| Implemented | Code shipped per the completion event. Work item moved to `plan/done/`. ADR is the authoritative spec the running system matches. |
| Superseded | Replaced by another ADR. The successor is named in `superseded-by:` metadata. |
| Deprecated | Was real; the world moved on; no successor. Capability is not being rebuilt. |

Terminal states (Superseded / Deprecated) are reachable from any prior state.

The first **persisted** status is `Proposed` — there is no separate `Draft`
state and no `drafts/` folder. Work-in-progress lives in the brainstorm
conversation; only an approved decision is written, as a numbered ADR.

Cross-references link by relative path to `adr/NNNN-*.md`.

## ADR Shapes

This project uses a single ADR shape. ADRs use `adr/0000-template.md` and
contain these sections in order: Context, Capability statement, User stories /
scenarios, Acceptance criteria, Out of scope, Open questions, References,
Revision History, Approvals.

## ADR Privacy

ADRs are internal artefacts. ADR numbers, ADR titles, and the existence of the
ADR catalogue must never appear in any string the product emits to users: UI
copy, API response bodies, error messages, customer-visible log lines, public
documentation, release notes, marketing copy, or support communications.

Allowed references:
- Inline code comments tying a non-obvious choice to its ADR
  (`// see adr/0018-edit-commit-via-pages-function.md`).
- Commit messages and PR descriptions.
- Internal documents: `AGENTS.md`, `INDEX.md`, the `plan/` queue, `_agent/`
  files, internal runbooks.

Rule of thumb: if a non-builder could ever read the string, the ADR reference
comes out. Refer to the behaviour by its product-level name instead.

## Tooltips

Two tooltips exist and the choice between them is not a preference.

**Use the in-app bubble** — `.tt` plus `data-tip` — for an **interactive
control**: anything a user clicks or focuses. It is styled with the app, appears
on keyboard focus as well as hover, and is the only one that works on a control
held inert with `aria-disabled`.

**Keep the native `title`** in four cases, and say why in a comment:

- **Truncation reveals.** Text clipped by CSS whose full value the `title`
  restores. A `nowrap` bubble would reproduce the truncation it exists to undo.
- **`<iframe>` titles.** An accessibility attribute naming the frame, not a
  tooltip. Converting one is a bug.
- **High-cardinality lists.** A grid of hundreds of cells, where a `::after` per
  cell is weight for no gain.
- **No room for the bubble.** Dense grids and open menus, where a bubble covers
  the neighbouring option the reader is comparing against. Judge this per site,
  in the running app.

`aria-label` is the accessible name in both cases. It is never replaced by
`data-tip` or by `title` — a tip that overwrites the name leaves the control
unnamed to a screen reader.

Placement is per-site: `.tt` hangs below and right-aligned, `.tt-up` opens
upward for the status bar, `.tt-end` right-aligns it there, `.tt-multi` allows
more than one line. A control stacked above the page (a map overlay, a floating
panel) needs its bubble's `z-index` raised to match, or it renders behind what
the control sits on.

## Multi-Agent Rules

A single agent owns this repo. The `_agent/` directory tracks live state and
history; no LOCKS discipline.

## Plan Folder

Pending and shipped work live in `plan/` at the repository root:

- `plan/todo/NNNN-<slug>.md` — pending work, lower numbers run first. Each file
  names the owning ADR(s), scope, and exit criteria.
- `plan/done/<YYYY-MM-DD>-<slug>.md` — shipped work, chronological. A `git mv`
  from `todo/` to `done/` is the completion event.

The completion event is: the change is fast-forwarded onto `main` and the
remote push succeeds, with the verify gate green.

When a `plan/todo/` item ships, the file moves to `plan/done/` AND the owning
ADR(s)' `status:` advances from `Accepted` to `Implemented`. `INDEX.md` is
regenerated to match.

## Audit Trail Policy

Every substantive change to an Accepted ADR appends a new row to its Revision
History table.

Editorial changes — typos, formatting, link fixes — are excluded from Revision
History but must be flagged "editorial" in the commit message.

The Approvals table is populated when an ADR transitions to Accepted and
updated on every subsequent substantive revision.

## Git Contract

Commit messages follow Conventional Commits with a mandatory `Rationale:`
footer for any commit that touches an ADR.

- Signed commits: yes.
- ADR-revision tags `adr-NNNN-rN`: no.
- Co-Authored-By trailer on agent commits: no.

Integration is **direct-to-main, fast-forward only**: changes are
fast-forwarded onto `main` with no merge commits. The verify gate runs locally
and must pass before push:

1. `yarn typecheck` (`tsc --noEmit` with `allowJs`/`checkJs`).
2. `yarn test` (Vitest unit and logic-level tests).

Both are bundled as `yarn verify`. The gate is **self-contained in this repo**:
it must stay runnable with nothing but a clone and an install, so it can move to
a hosted CI unchanged. Nothing that depends on a vault outside the repo belongs
in it.

`wv build` is therefore **not** a gate step. It only runs from a consumer `.web`
project — `wv` resolves the vault as `process.cwd()/..`, so from this repo's
root it would treat the parent directory as a vault and build unrelated notes.
Linking a local vault (`"web-vault": "portal:../../web-vault"`) to smoke changes
in a browser is a useful development aid, not a precondition for pushing.

A change is "shipped" when it is on `main` and pushed.
