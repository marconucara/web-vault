# An unlabelled code fence gains a `text` language on round-trip

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

A fence that *does* declare a language is unaffected (```` ```markdown ````
stays ```` ```markdown ````). The rewrite comes from BlockNote's exporter, which
emits a default info string where the source had none, not from this repo's
pre/post-processing.

Found on 2026-08-05 while re-verifying `plan/todo/0003`; it is the only
difference that survived in an otherwise clean set of wikilink/code round-trip
cases.

## Re-diagnosed 2026-08-06 — the fix cannot live in `normalizeMarkdown`

This item first placed the fix in the export-side normalisation stage. Running
the parse shows that stage cannot tell the two cases apart:

| Source | Parsed block | Exported |
|---|---|---|
| ```` ``` ```` | `codeBlock`, `language: "text"` | ```` ```text ```` |
| ```` ```text ```` | `codeBlock`, `language: "text"` | ```` ```text ```` |

`text` is BlockNote's default for a code block, so a bare fence and one that
declares `text` collapse into the *same* block on parse. By export time "the
author wrote no info string" is already gone, and any rule in
`normalizeMarkdown` would have to strip `text` blindly — which the second scope
bullet rules out.

The distinction therefore has to be preserved *before* the parse, the same way
wikilinks, media links and map links already are.

## Scope

- Mark a fence that has no info string before the parse, so it stays
  distinguishable from one that declares `text`, and unmark it on the way out —
  a fourth pre/post pair alongside the existing token pairs in
  `src/lib/richMarkdown.js`.
- Preserve a language the author *did* write, including one that happens to be
  `text` — the fix must distinguish "no info string in the source" from "the
  author wrote `text`", so it cannot be a blanket strip.

## Out of scope

- Any other exporter-introduced formatting difference not observed here. Three
  such differences surfaced while fixing this one and are all pre-existing,
  unchanged by this item: a longer fence marker (```` ```` ````) is normalised
  back to three characters, a `~~~` fence becomes a backtick fence, and a fence
  indented inside a list item is de-indented.
- Normalising the info string's casing or aliases (`js` vs `javascript`).

## Exit criteria

1. An unlabelled fence round-trips unlabelled.
2. A fence with an explicit language keeps it, `text` included.
3. Idempotence: a second round trip is a no-op.
4. `yarn verify` green.
