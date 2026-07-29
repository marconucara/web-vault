---
adr: 0022
title: Preserve frontmatter with line-level operations, no YAML re-serialization
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0015, 0019]
tags: [commit, frontmatter, fidelity]
---

# ADR 0022 — Preserve frontmatter with line-level operations, no YAML re-serialization

## Context

A note's frontmatter carries wikilink relationships and vault-specific keys whose
exact text matters. Parsing frontmatter into an object and re-serializing it would
reorder keys, change quoting, and risk breaking those values. So the editor edits
only the body (`adr/0015-durable-markdown-round-trip.md` keeps frontmatter out of
the block model) and re-attaches the frontmatter untouched, and any unavoidable
frontmatter mutation is a **line-level text operation** rather than a
parse-and-re-serialize. The mutation the product needs is inserting or removing a
**single frontmatter field's line**; its first consumer is the sharing feature
(`adr/0024-share-unshare-from-app.md`), but the mechanism is generic.

## Capability statement

Frontmatter is preserved verbatim across an edit: the commit endpoint keeps the
current frontmatter block as-is and re-attaches it to the new body. Any
frontmatter mutation is **line-level** — inserting or removing a single field's
line as a text operation on the block, without parsing or re-serializing the YAML
— so every other key, its order, and its formatting stay untouched. When a field
must be inserted and no frontmatter block exists, a minimal one is created.

## User stories / scenarios

- As a vault owner, editing a note's body never reorders or reformats its
  frontmatter.
- As a vault owner, when a single frontmatter field must be added or removed, only
  that one line changes and the rest stays byte-for-byte identical.

## Acceptance criteria

1. On a body edit, the current frontmatter block is preserved verbatim and
   re-attached; only the body is replaced.
2. Adding a single frontmatter field inserts one line via a text operation; if no
   frontmatter block exists, a minimal one is created; if the field is already
   present, it is left unchanged.
3. Removing a single frontmatter field deletes only that line.
4. No path parses-then-re-serializes the whole frontmatter as YAML.

## Out of scope

- Editing arbitrary frontmatter properties from the UI (deferred; would extend the
  same line-level approach — `adr/0011-read-only-properties-panel.md`).

## Open questions

- Editable properties from the UI would generalise these single-field line ops;
  deferred until needed.

## References

- functions/commit.js (reconstructFile, applyOps; the current single-field
  helpers used by sharing)
- adr/0015-durable-markdown-round-trip.md, adr/0019-atomic-commit-git-data-api.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
