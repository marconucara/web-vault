# 0004 — Emphasis spanning an inline code span is split on export

**Owning ADRs:** adr/0015-durable-markdown-round-trip.md

## Problem

An emphasis run that contains an inline code span does not survive the round
trip. The exporter closes the emphasis before the code span and reopens it
after, so the delimiters end up around the wrong text:

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

## Scope

- Stitch emphasis delimiters that the exporter split around an inline code span,
  in the same post-processing stage that already handles emphasis split across a
  soft wrap (`joinSplitEmphasis` in `src/lib/richMarkdown.js`).
- The seam here is not a hard-break marker but the code span itself, so it needs
  its own recognition rule: `**a** `c`** b**` → `**a `c` b**`.
- Cover the closing-edge case (row 3) and the opening-edge case (row 4), where
  one of the two emphasis runs is empty and the delimiter pair is dropped
  entirely rather than merely displaced.

## Exit criteria

1. Each of the four rows above round-trips to itself.
2. Emphasis and code spans that are genuinely adjacent (`**bold** \`code\``) are
   left alone — the stitch must not merge runs the author wrote separately.
3. The same holds for single-delimiter emphasis (`*italics*`) and for a run
   containing more than one code span.
4. Idempotence still holds: a second round trip is a no-op.
5. `yarn verify` green.

## Verification

Re-verified 2026-08-05 by running the round trip on all four rows: every one
reproduces exactly as tabulated above, including the two lossy cases (rows 3
and 4, where the code span loses its emphasis outright). A genuinely adjacent
`**bold** ` + `` `code` `` was confirmed unaffected, so the stitch in criterion 2
has a real case to distinguish. This item is accurate as written and ready to
implement.
