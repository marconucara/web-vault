# A code fence is rewritten on round-trip

**Owning ADR(s):** `adr/0015-durable-markdown-round-trip.md`
**Dependencies:** None

## Problem

A fenced code block written without an info string comes back labelled `text`
after an open-and-save cycle:

| Source | After a round trip |
|---|---|
| ```` ```\nSee [[welcome]] here\n``` ```` | ```` ```text\nSee [[welcome]] here\n``` ```` |

The fence content itself is untouched — this is not content loss — but the
note's source is rewritten in a way the author did not ask for. Opening a note
and saving it without editing anything should be a no-op, which is the promise
ADR 0015 makes; a diff appearing in the vault for a note nobody changed
undermines it.

Found on 2026-08-05 while re-verifying `plan/todo/0003`; it is the only
difference that survived in an otherwise clean set of wikilink/code round-trip
cases.

## Re-diagnosed 2026-08-06 — one cause, four symptoms

This item first placed the fix in the export-side normalisation stage and
scoped it to the info string alone. Both turned out to be wrong.

A BlockNote code block stores only its **language**. Everything else about how
the fence was written is dropped on parse and re-invented by the exporter,
which always emits three backticks at column zero and labels an unlabelled
block `text`:

| Source | Parsed block | Exported |
|---|---|---|
| ```` ``` ```` | `language: "text"` | ```` ```text ```` |
| ```` ```text ```` | `language: "text"` | ```` ```text ```` |
| `~~~js` | `language: "js"` | ```` ```js ```` |
| ```` ````  ```` | `language: "text"` | ```` ```text ```` |
| a fence indented under a list item | child block | flattened to column zero |

So the fix could not live in `normalizeMarkdown`: `text` is BlockNote's default,
which makes a bare fence and one that really declares `text` parse to the *same*
block. By export time the distinction is gone, and any export-side rule would
have to strip `text` blindly — which the "preserve an explicit `text`"
requirement rules out.

Three further differences surfaced while verifying the first. All four are the
same defect — fence shape is not carried through the parse — so they are fixed
together rather than split across items:

1. an unlabelled fence gains `text`;
2. a marker longer than three characters (```` ```` ````) is shortened;
3. a `~~~` fence becomes a backtick fence;
4. a fence indented under a list item is flattened to column zero.

The fourth has its own mechanism: the parse is correct (the code block *is* a
child of the list item), but `blocksToHTMLLossy` lifts every non-list child out
of its `<li>` and records the depth only in a `data-nesting-level` attribute
that the HTML→markdown step never reads. It cannot be repaired after the fact
either — in the emitted markdown a fence that merely *follows* a list is
indistinguishable from one nested *inside* it.

## Scope

- Carry the fence's written shape — marker kind, marker length, original info
  string, and indent — across the parse in the one field that survives it, the
  block's language, by rewriting the opening fence into a sentinel before the
  parse and restoring it after the export. A fourth pre/post pair alongside the
  existing wikilink, media-link and map-link ones in `src/lib/richMarkdown.js`.
- Preserve a language the author *did* write, including one that happens to be
  `text` — the fix must distinguish "no info string in the source" from "the
  author wrote `text`", so it cannot be a blanket strip.
- Never let the sentinel reach the vault, on any path.

## Out of scope

- The flattening of *other* nested block types. A paragraph or a blockquote
  indented under a list item is de-indented by the same exporter behaviour;
  only the code-fence case is fixed here, because only it was in evidence. The
  general fix means replacing `blocksToMarkdownLossy` with a pipeline that
  reads `data-nesting-level`, which is a change to every export path and wants
  its own item.
- Normalising the info string's casing or aliases (`js` vs `javascript`).
- Migrating these modules to TypeScript. The repo is JS under `checkJs`, with
  no `.ts` files; introducing the first one is an architecture decision for an
  ADR, not a side effect of this fix. The data shapes touched here are pinned
  with JSDoc instead, which `checkJs` verifies.

## Exit criteria

1. An unlabelled fence round-trips unlabelled.
2. A fence with an explicit language keeps it, `text` included.
3. A marker longer than three characters keeps its length, and a `~~~` fence
   stays a `~~~` fence — each with and without a language.
4. A fence indented under a list item keeps its indent, at one and two levels
   of nesting, and for both bullet and ordered items.
5. A marker the exporter had to lengthen (because the block's own content holds
   a backtick run) is not shortened back.
6. The sentinel never appears in round-tripped output.
7. Idempotence: a second round trip is a no-op.
8. `yarn verify` green.
