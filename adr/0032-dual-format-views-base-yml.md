---
adr: 0032
title: Dual-format saved views — Obsidian .base and Tolaria .yml with dedup
status: Proposed
date: 2026-07-30
owner: marco
supersedes: [0007]
superseded-by:
depends-on: [0002]
tags: [views, compatibility, content, obsidian]
---

# ADR 0032 — Dual-format saved views — Obsidian .base and Tolaria .yml with dedup

## Context

`adr/0007-tolaria-views-evaluator.md` shipped a build-time evaluator for Tolaria
`views/*.yml` and deliberately **ignored** Obsidian Bases `.base` companion files
"for now", naming full dual-format support as the postponed compatibility
objective. This ADR delivers that objective and supersedes 0007.

A vault following the common convention (verified against the maintainer's vault)
keeps each saved view in **both** formats under `views/` with the same filename
stem — e.g. `portafoglio.yml` and `portafoglio.base` — so either client works.
Obsidian-only vaults, conversely, have `.base` as the *only* source. The two
formats are not the same model dressed differently:

- Tolaria `.yml`: a closed `all:`/`any:` tree of `field` / `op` / `value`
  conditions plus a top-level `sort`.
- Obsidian `.base`: `and:`/`or:` lists of **expression strings**
  (`type == "Topic"`, `related_to.toString().contains("x")`, a bare `share_id`
  truthy check), plus one or more `views:` (table/cards) each with their own
  `order`, `sort`, and `limit`, and optional `formulas:`.

The `.base` language is open-ended (formulas, arbitrary functions, computed
properties), but the real-world views that mirror Tolaria's use a small, closed
subset that maps cleanly onto the existing internal filter model. This ADR
supports that subset now and defers the rest.

## Capability statement

The build reads both `views/*.yml` and `views/*.base`. Views are deduplicated by
**filename stem**: when both `foo.yml` and `foo.base` exist, the **`.base` is
used and the `.yml` twin is ignored entirely** — `.base` is the richer,
forward-looking format, so no capability check or fallback is performed. A stem
present only as `.yml` is evaluated by the existing `.yml` evaluator, unchanged; a
stem present only as `.base` is evaluated from the `.base`. Supported `.base`
constructs are translated into the same internal filter model the `.yml` evaluator
already uses, so there is a single evaluation path, not a second one. Unsupported
`.base` constructs are handled **fail-soft** rather than breaking the build.

## User stories / scenarios

- As an Obsidian user whose vault has only `.base` views, my saved views appear in
  the client and filter/sort as they do in Obsidian.
- As a user whose vault keeps both formats per view, each view appears **once**
  (no duplicate), sourced from the `.base`.
- As a maintainer, a `.base` that uses a feature the client does not yet support
  degrades predictably — the view is omitted with a warning, never rendered with a
  silently wrong result set.

## Acceptance criteria

1. Both `views/*.yml` and `views/*.base` are parsed at build time into the content
   artifact; each view carries an id equal to its filename stem.
2. Deduplication is by stem: when both `foo.yml` and `foo.base` exist, the `.base`
   is used and the `.yml` twin is not evaluated. A stem with only `.yml` uses the
   existing `.yml` evaluator unchanged; a stem with only `.base` uses the `.base`.
3. The supported `.base` subset translates into the internal model: `and:`/`or:` →
   `all:`/`any:`; `field == value` → `equals`; `field != value` → `not_equals`;
   `field.toString().contains(value)` → `contains`; a bare `field` → `is_not_empty`;
   view name and sort taken from the `.base` view (`file.name` → title/name,
   `file.mtime` → modified, `file.ctime` → created, `property:<name>` →
   `property:<name>`, direction `ASC`/`DESC`).
4. Fail-soft is split by role: a `.base` view whose **filter** contains an
   unsupported construct is **omitted with a build warning** (never rendered with a
   partial/incorrect filter); unsupported **non-filter** features (formulas,
   additional or `cards` views, `limit`) are ignored and the remainder of the view
   is rendered.
5. The `.yml` evaluator behaviour specified in 0007 (its operators and `sort`
   options) remains available for `.yml`-sourced views.

## Out of scope

- Rich `.base` features: `formulas:`, arbitrary functions (e.g. `file.hasTag(...)`),
  date/relational comparisons (`<`, `>`), computed properties, `cards` views,
  multiple views per `.base` file, and `limit`. Candidates for a future ADR.
- Authoring or editing views from the client (views remain read-only).
- Keeping `.yml` and `.base` in sync — a vault-side concern, not the client's. When
  both exist and diverge, the `.base` is authoritative.
- Deduplicating semantically-equivalent views that have **different** stems.

## Open questions

- None.

## References

- src/lib/views.js, scripts/build-content.mjs
- adr/0007-tolaria-views-evaluator.md (superseded)
- adr/0002-build-time-content-pipeline.md
- adr/0004-vault-compatibility-target.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. Supersedes 0007 to add `.base` support with stem dedup. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
