---
adr: 0015
title: Durable-markdown round-trip layer for the block editor
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0008]
tags: [editor, markdown, fidelity]
---

# ADR 0015 — Durable-markdown round-trip layer for the block editor

## Context

BlockNote works on its own block model and its markdown conversion is **lossy**:
naively importing markdown into blocks and exporting it back changes bytes
(reordered attributes, dropped constructs, escaped characters). For an editor
over a git-tracked vault this is unacceptable — opening a note and committing it
untouched must produce an **empty diff**, or every open would churn the file.
Tolaria solves this with a dedicated round-trip layer that preserves its durable
syntax; this project is strongly inspired by that approach and has its **own**
implementation.

## Capability statement

A durable-markdown layer sits between the vault's markdown and BlockNote so the
round-trip is byte-preserving for everyday notes. Import (md→blocks) splits the
frontmatter out, pre-processes wikilinks into placeholder tokens (using the
Unicode guillemets `‹ ›` so they don't collide with markdown), parses to blocks,
then injects the wikilinks; export (blocks→md) runs the lossy exporter, post-
processes the wikilink placeholders back, and re-prepends the untouched
frontmatter. Frontmatter is kept **out** of BlockNote entirely, and the H1/title
is handled by a dedicated field (hidden H1), so neither is mangled by the block
model.

## User stories / scenarios

- As an editor-user, opening a note and committing it without edits produces no
  diff.
- As a vault owner, my wikilinks, lists, tables, code fences, and frontmatter
  survive an edit unchanged except where I actually changed them.
- As a maintainer, the round-trip layer is the project's own implementation,
  strongly inspired by Tolaria's approach.

## Acceptance criteria

1. **Blocking:** open a real note, make no change, start a commit → **empty
   diff** (byte-identical round-trip) on a sample of real notes containing
   wikilinks, lists, tables, code fences, and frontmatter.
2. Frontmatter is preserved verbatim (kept outside BlockNote) and re-prepended on
   export; the title/H1 is handled by a dedicated field, not a normal block.
3. Wikilinks survive the round-trip via placeholder tokens that do not collide
   with markdown parsing.
4. The implementation is the project's own, strongly inspired by Tolaria's
   approach.

## Out of scope

- Full fidelity for advanced Tolaria blocks (math, mermaid, callout, tldraw) —
  the minimum durable set is frontmatter + wikilinks; the rest can follow.
- Map place-card blocks, whose exact round-trip is covered separately
  (`adr/0028-google-maps-places.md`).

## Open questions

- Extending the durable set beyond frontmatter + wikilinks (math/mermaid/callout)
  as real notes need it; re-evaluate if BlockNote's markdown round-trip degrades.

## References

- src/lib/richMarkdown.js
- adr/0014-wysiwyg-blocknote-editor.md, adr/0008-wikilink-resolution.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |
| 2026-08-03 | r2 | marco | Criterion 1 did not hold for soft-wrapped notes: wraps became hard breaks and list-item continuations escaped their item, splitting the list. Continuations are now folded before the parse and hard-break artefacts undone after it. Wrap columns inside a list item are not restored, so the guarantee for such notes is idempotence after the first normalization rather than a byte-identical first save. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
