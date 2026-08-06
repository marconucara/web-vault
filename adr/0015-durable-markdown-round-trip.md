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
5. Where a block model field cannot represent how a construct was written, the
   written form is carried across the parse rather than re-invented on export.
   For a code fence this covers the marker kind and length and the presence and
   content of the info string; no marking used to carry it appears in the vault.
6. A block nested under a list item — paragraph, blockquote, table, heading or
   code fence, under a bullet, ordered or checklist item, at any depth — keeps
   the indent that holds it inside that item, and a list's ordinals survive the
   round trip.

## Out of scope

- Full fidelity for advanced Tolaria blocks (math, mermaid, callout, tldraw) —
  the minimum durable set is frontmatter + wikilinks; the rest can follow.
- Map place-card blocks, whose exact round-trip is covered separately
  (`adr/0028-google-maps-places.md`).
- **Spacing around a list nested under a checklist item — a known defect.** A
  blank line before it is dropped, turning a loose list tight. Spacing rather
  than structure, and consistent with the map-link post-processing, which
  already compacts loose lists.

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
| 2026-08-03 | r3 | marco | Extended the fold to prose: the parser kept a paragraph's soft wraps as literal newlines inside the block's text, so the editor displayed a break at whatever column the source happened to wrap at — the round-trip was clean but the reading experience was not. Paragraph continuations are now joined before the parse alongside list ones, leaving structural newlines (headings, tables, blockquotes, fences, thematic breaks) untouched. |
| 2026-08-05 | r4 | marco | Criterion 1 did not hold for an emphasis run containing an inline code span: the emphasis was lost outright where the code span sat at an edge of the run. Two causes, both addressed. TipTap's `code` mark excludes every other mark, so the emphasis was already stripped at parse time — the schema now relaxes that exclusion, making `code` combinable with bold/italic/strike. BlockNote's exporter then brackets each span separately, so a run is now rendered as a whole on export rather than one span at a time. Emphasis inside a link (`[**bold**](url)`) remains unnormalized and is not covered here. |
| 2026-08-06 | r5 | marco | Criterion 1 did not hold for code fences, which it names explicitly. A BlockNote code block keeps only its `language`, so four properties of the written fence were dropped on parse and re-invented on export: an unlabelled fence gained `text`, a marker longer than three characters was shortened, a `~~~` fence became a backtick fence, and a fence indented under a list item was flattened to column zero. The `text` case was unrecoverable after the parse — `text` is BlockNote's default, so a bare fence and one that really declares `text` produce the same block. All four are now carried across the parse in the language field itself, via a sentinel written onto the opening fence and stripped after export. Added criterion 5 to state the general rule the four symptoms shared. The same flattening applies to every non-list child of a list item (paragraph, blockquote, table, heading) and is recorded under Out of scope as a known defect; it is not fixed here because the repair reaches every export path. |
| 2026-08-06 | r6 | marco | Closed the known defect r5 left open, which criterion 1 also covered: a paragraph, blockquote, table or heading nested under a list item was exported at column zero, and unlike a rewrite that changes the document — the indent is what holds the block inside the item. Replacing the exporter proved unnecessary: each block exports correctly on its own and only the composition was wrong, so the export now walks the block tree and indents each child under its parent, calling the stock exporter on the parts. A run of items goes through it in one call (or every ordered list restarts at 1) and stops at a change of list type (or one emitted line stops pairing with one item, which dropped a whole list). Also fixed the checklist case, whose cause is separate and lives in the dependency: BlockNote's markdown parser counts a task item's content column including the `[ ] ` marker, so a child at the idiomatic column is read as a sibling — such children are re-indented to the column the parser expects before the parse and put back after it. The fence sentinel no longer carries an indent, since the tree walk applies it. Added criterion 6 for nesting depth, and narrowed criterion 5 to the fence properties the sentinel still carries. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-08-06 | — |
