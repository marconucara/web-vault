# A block nested under a list item is flattened on export

**Owning ADR(s):** `adr/0015-durable-markdown-round-trip.md` — recorded there as
a known defect under Out of scope, and referenced by criterion 5 (r5).
**Dependencies:** None. Shares its cause with
`plan/done/2026-08-06-fence-shape-lost-on-round-trip.md`, which fixed the
code-fence case only.

## Problem

Every block type nested under a list item comes back de-indented, so an
open-and-save cycle rewrites the note:

| Source | After a round trip |
|---|---|
| `- item` ⏎ ⏎ `␣␣more prose` | `- item` ⏎ ⏎ `more prose` |
| `- item` ⏎ ⏎ `␣␣> quoted` | `- item` ⏎ ⏎ `> quoted` |
| `- item` ⏎ ⏎ `␣␣\| a \| b \|` … | the table, unindented |
| `1. one` ⏎ ⏎ `␣␣␣prose` | `1. one` ⏎ ⏎ `prose` |
| `- a` ⏎ `␣␣- b` ⏎ ⏎ `␣␣␣␣prose` | the paragraph, at column zero |

A nested *list* is unaffected — that is the one child type the exporter keeps
indented.

Unlike the fence-shape defect this is not only a rewrite: the indent is what
holds the block **inside** its item. Removing it changes the document — a
continuation paragraph becomes a sibling of the list, and a following ordered
item restarts its numbering. `joinListContinuations` already exists to stop the
parse from doing this; nothing stops the export from doing it.

Found on 2026-08-06 while fixing the code-fence case, which is the same defect
seen through one block type.

## Cause

The parse is correct: the nested block really is a child of the list item.
The loss is in the export, and specifically before the markdown step —
`blocksToHTMLLossy` lifts every non-list child out of its `<li>` and emits it as
a sibling, recording the depth only in a `data-nesting-level` attribute:

```
<ul><li><p>item</p></li></ul><p data-nesting-level="1">more prose</p>
```

BlockNote's `htmlToMarkdown` never reads that attribute — it indents from the
DOM nesting it walks, which by then is flat. So the markdown step cannot
recover what the HTML step discarded.

It cannot be repaired afterwards either: in the emitted markdown a paragraph
that merely *follows* a list is indistinguishable from one nested inside it.

The code-fence case escaped this because a fence carries a `language` prop — a
field that survives the parse and could be made to smuggle the indent across.
No such field exists on a paragraph, a blockquote, a table or a heading, so the
same trick does not generalise.

## Scope

- Make the export preserve the nesting depth of a non-list child of a list
  item, for at least: paragraph, blockquote, table, heading, and a second
  paragraph within the same item.
- Preserve depth beyond one level (a child of a nested item indents to that
  item's column) and under ordered items, whose marker width differs.
- Keep the existing code-fence behaviour working, and prefer folding its
  indent handling into the general mechanism if the result is simpler than the
  two living side by side.

## Approach — as implemented

The item expected to *replace* `blocksToMarkdownLossy`. That turned out to be
unnecessary: each block exports correctly on its own, and only the composition
was wrong. `exportBlocks` walks the block tree and indents each child under its
parent, calling the stock exporter on the parts — additive, not a rewrite, and
used by both export paths (`blocksToBody`, `serializeEditorBody`).

Three constraints the walk has to respect, each found by testing rather than by
reading:

1. **A run of items goes through the exporter in one call.** One call per item
   restarts every ordered list at 1, because the exporter counts the ordinals
   within a call.
2. **The run stops at a change of list type.** The exporter separates two
   different lists with a blank line, so one emitted line no longer pairs with
   one item. The first implementation paired them regardless and *dropped the
   second list outright* — content loss, caught by diffing edge cases against
   the unmodified tree, not by a failing test. A length guard now falls back to
   the exporter's output verbatim, losing the indent rather than content.
3. **A child indents to the item's text column**, which is the width of the
   marker actually emitted: two for a bullet, three for `1. `, four for `10. `.

## Out of scope

- Any exporter difference not about nesting depth.
- Changing how the *parse* nests blocks; it is already correct.
- Introducing a second serializer for one block type as a workaround — if the
  general fix proves too large, the item should be re-scoped rather than
  papered over per type.

## Exit criteria

1. A paragraph, a blockquote, a table and a heading nested under a list item
   each round-trip with their indent intact.
2. A second paragraph in the same item keeps its indent too.
3. Depth is preserved two levels down, and under an ordered item.
4. A nested list still round-trips unchanged (no regression on the one child
   type that already worked).
5. Every case fixed by
   `plan/done/2026-08-06-fence-shape-lost-on-round-trip.md` still passes.
6. Idempotence: a second round trip is a no-op.
7. The new assertions are confirmed to fail against the unmodified tree.
8. `yarn verify` green.

## Outcome

All eight criteria met, plus two cases the item did not list: a child three
levels deep, and the checklist item.

The checklist needed its own fix, with a different cause. BlockNote's markdown
parser counts a task item's content column *including* the `[ ] ` marker
(`markdownToHtml.ts`, `contentIndent`), so it expects a continuation at column 6
and reads the idiomatic column 2 as a sibling — while the same child under a
plain bullet nests correctly. A nested *list* survived only because a second
rule admits sub-lists between the marker and the content column; nothing covered
a paragraph, quote or table. The defect is in the dependency, so children of a
checklist item are re-indented to the column the parser expects before the parse
and put back after it.

Two parts of the fence item folded into this one: the sentinel no longer carries
the fence's indent (`exportBlocks` applies it, so carrying it too applied it
twice), and `compactTableLine` keeps the leading whitespace it used to trim.

Left as-is, and confirmed pre-existing by diffing against the unmodified tree: a
blank line before a list nested under a checklist item is dropped, which makes a
loose list tight. Spacing, not structure, and consistent with
`postProcessMapLinks`, which already compacts loose lists.

Coverage: 91 → 121 tests. 16 of the new assertions were confirmed to fail
against the unmodified tree, so they pin the behaviour rather than merely
passing. Verified against a real vault by the owner, as the item required.

**Shipped:** 2026-08-06 · HEAD 1f81806 · ADR 0015 (r6; already `Implemented`, no status change)
