# 0004 — Emphasis spanning an inline code span is lost on parse

**Owning ADRs:** adr/0015-durable-markdown-round-trip.md

## Problem

An emphasis run that contains an inline code span does not survive the round
trip. The delimiters end up around the wrong text, and on two of the four cases
the emphasis on the code span is dropped outright:

| Source | After a round trip |
|---|---|
| ``A **policy that leaves `/shared/*` public** here.`` | ``A **policy that leaves** `/shared/*`** public** here.`` |
| ``A **bold with `code` inside** it.`` | ``A **bold with** `code`** inside** it.`` |
| ``A **bold with `code`** at the end.`` | ``A **bold with** `code` at the end.`` |
| ``Start **`code` then bold** end.`` | ``Start `code`** then bold** end.`` |

Rows 3 and 4 are the serious ones: the code span loses its emphasis outright, so
this is formatting loss and not only a syntax churn. Plain emphasis and a code
span that merely sit side by side are unaffected.

Found while writing the starter template's welcome note, which needed a bold
sentence mentioning a path in code. The sentence was reworded to avoid the
defect; the defect itself is untouched and affects any vault note.

## Root cause — the loss is at parse time, not on export

The original framing of this item ("the exporter splits the delimiters") was
wrong, and so was the fix it proposed. **The emphasis is already gone before
anything is exported.**

TipTap's `code` mark declares `excludes: "_"`
(`node_modules/@tiptap/extension-code/dist/index.js:42`), which means it excludes
every other mark. Parsing row 3 gives, verbatim:

```
[{"t":"A ","s":{}},
 {"t":"bold with ","s":{"bold":true}},
 {"t":"code","s":{"code":true}},          <- bold already dropped here
 {"t":" at the end.","s":{}}]
```

By the time the document reaches the exporter there is no bold on that span left
to serialise, so no post-processing stage can restore it — there is nothing to
stitch back together.

This also makes the original criterion 2 unsatisfiable as written. On the
exported markdown, a genuine author-written `**bold** ` + `` `code` `` and the
broken output of row 3 converge on the same string; a regex over that output
cannot tell them apart. The distinction only exists upstream, in the source being
parsed — which is precisely where the fix has to live.

The encouraging half: the **schema can represent bold+code and exports it
correctly**. Only the parser refuses the combination.

## Scope

- Override the `code` mark in the editor schema so it no longer excludes other
  marks, keeping bold/italic/strike alongside code through parsing.
- Treat this as an **editor behaviour change, not a serialisation fix**.
  Relaxing `excludes` affects more than the round trip and all of it needs
  covering: the formatting toolbar (applying code over a bold selection and the
  reverse), pasting markdown and rich HTML, and the input rules that create a
  code span while typing.
- Verify the four rows round-trip, and that the parse step retains both marks —
  assert on the parsed block styles, not only on the final string, so a
  regression is caught where it actually happens.

## Exit criteria

1. Each of the four rows above round-trips to itself.
2. Emphasis and code spans that are genuinely adjacent (`**bold** \`code\``) are
   left alone — an author who wrote them separately gets them back separately.
   With the fix at parse time this follows from the source, which still
   distinguishes the two cases; it was unsatisfiable under the original
   post-processing approach, where both collapse to the same output string.
3. Parsing a run of bold-containing-code yields a span carrying **both** marks
   (`{bold: true, code: true}`), asserted on the parsed blocks and not only on
   the exported markdown.
4. The same holds for single-delimiter emphasis (`*italics*`), for strikethrough,
   and for a run containing more than one code span.
5. Editor behaviour is intact after relaxing `excludes`: applying code to a bold
   selection (and the reverse) via the toolbar keeps both; pasting markdown and
   rich HTML containing bold code preserves both; the typing input rule for a
   code span still fires.
6. Idempotence still holds: a second round trip is a no-op.
7. `yarn verify` green.

## Risks

Relaxing `excludes` on `code` is a deliberate divergence from TipTap's default,
which exists because in many editors code is meant to be a terminal formatting
state. The exposure is the editor surface rather than the file format: the
markdown produced stays standard, and a vault opened elsewhere is unaffected.
Criterion 5 exists to bound that exposure — if any of those behaviours cannot be
kept, stop and re-scope rather than shipping a fix that trades a round-trip
defect for an editing one.

## Verification

Re-verified 2026-08-05 by running the round trip on all four rows: every one
reproduces exactly as tabulated above, including the two lossy cases (rows 3
and 4, where the code span loses its emphasis outright). A genuinely adjacent
`**bold** ` + `` `code` `` was confirmed unaffected.

Re-diagnosed the same day, after an implementation attempt found the original
approach unworkable: the parse-time block dump quoted under Root cause was taken
from `bodyToBlocks` on row 3, confirming the bold mark is dropped before export.
`excludes: "_"` was confirmed in the installed `@tiptap/extension-code`. The item
was rewritten from a post-processing stitch to a schema override on that basis.

## Outcome

Both causes were addressed, and the scope held: the fix is a schema override plus
a change to how a run is serialised, with no rewriting of the exporter's output.

The schema override landed as scoped — `code` no longer excludes the other marks,
so a code span keeps its emphasis through the parse (criterion 3). `code: true`
was left as upstream has it, having been confirmed to play no part in the
stripping; the divergence from TipTap's default is therefore the minimum that
fixes the defect.

The export side needed an approach the item did not anticipate. Relaxing
`excludes` is necessary but not sufficient: BlockNote's exporter has no notion of
a run and brackets every span on its own, so the marks were correct but came back
as `**bold with** **`code`**** inside**`. Repairing that string after the fact was
attempted and abandoned — `**` and `*` overlap in the delimiter alternation, and
the rules for the opening and closing seams interfere with each other. Emphasis
runs are instead rendered whole, from the styles, before the exporter sees them.
`blocksToBody` had to be routed through `extractCustomBlocks`, which it
previously bypassed, so the round-trip path gets the same treatment as the
mounted editor.

Criterion 5 was verified at the API level (`toggleStyles` for the toolbar, and
HTML paste), not through a mounted editor: the repo has no harness for editor
interaction and building one was out of proportion to this item. The typing input
rule for a code span is therefore unverified — the residual risk of this change.

Two round-trip defects remain, both **pre-existing and unchanged** by this work,
confirmed by diffing behaviour against the unmodified tree: `[**bold link**](url)`
comes back as `**[bold link](url)**`, and a code span at a link's trailing edge
escapes the link. Both are emphasis *inside* a link — a different defect, noted in
ADR 0015 r4 and left for a separate item.

Coverage: 41 → 63 tests. 13 of the new assertions were confirmed to fail against
the unmodified tree, so they pin the behaviour rather than merely passing.

**Shipped:** 2026-08-05 · ADR 0015 (r4; already `Implemented`, no status change)
