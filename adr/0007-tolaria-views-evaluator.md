---
adr: 0007
title: Tolaria views/*.yml evaluator, Obsidian .base ignored
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002]
tags: [views, compatibility, content]
---

# ADR 0007 — Tolaria views/*.yml evaluator, Obsidian .base ignored

## Context

A vault groups notes into saved views. Tolaria stores them as `views/*.yml`
files: a filter tree rooted in a single `all:` or `any:` group whose conditions
are `field` / `op` / `value`, plus a `sort`. The same views often also exist as
Obsidian Bases `.base` companion files. To ship the feature the client
standardises on the `.yml` format first and ignores `.base` **for now**;
supporting **both** formats is the compatibility objective and is postponed, not
abandoned (see Open questions).

## Capability statement

The client reads the vault's `views/*.yml` at build time and evaluates each view
client-side over the notes: the `all:`/`any:` filter tree with the operators
`equals`, `not_equals`, `contains`, `not_contains`, `any_of`, `none_of`,
`is_empty`, `is_not_empty`, `before`, `after` (with optional `regex`), matching
built-in fields (`type`, `status`, `title`, `favorite`, `body`) and frontmatter
keys, plus `sort` by a built-in option or a custom property. Obsidian `.base`
companion files are ignored for now; full compatibility (supporting both view
formats) remains the objective.

## User stories / scenarios

- As a Tolaria user, my saved views appear in the client and filter/sort notes
  as they do in Tolaria.
- As a maintainer, one view format is supported end-to-end; the `.base` twin is
  not a second code path to keep in sync.

## Acceptance criteria

1. `views/*.yml` are parsed at build time into the content artifact with their id
   (filename without extension) and definition.
2. The client evaluates the `all:`/`any:` filter tree with the operators listed
   above, including `regex`, over built-in fields and frontmatter keys.
3. `sort` is applied by built-in option (`modified`, `created`, `title`,
   `status`) or `property:<name>`.
4. `.base` files are not read or evaluated (current limitation; the dual-format
   objective is tracked in Open questions).

## Out of scope

- Authoring or editing views from the client (views are read-only here).
- Keeping `.yml` and `.base` in sync — that is a vault-side concern, not the
  client's.

## Open questions

- **Full-compatibility objective (postponed):** also support Obsidian `.base`
  companion views, not only `.yml`, so a vault whose views are maintained as
  Obsidian Bases works without a hand-written `.yml` twin. Ignoring `.base` is a
  current limitation, not a permanent decision — likely a future ADR + plan
  item that supersedes this one's "`.base` ignored" stance.

## References

- src/lib/views.js
- adr/0002-build-time-content-pipeline.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |
| 2026-07-30 | r2 | marco | Superseding ADR 0032 (dual-format views with `.base` support) proposed; supersession pending its implementation — this ADR stays Implemented and live until then. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
