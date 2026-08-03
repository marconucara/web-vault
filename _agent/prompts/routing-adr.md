# Handoff — an ADR for routing

Write a new ADR for what the URL addresses in this app. None exists: routing was
never a decision, it accumulated.

## What surfaced

A heading link inside a note (`[jump](#some-heading)`) goes nowhere. The
read-only renderer (`src/components/Markdown.jsx`) runs `react-markdown` with
`remark-gfm` and nothing else, so no `id` is ever put on a heading and there is
no anchor to land on. The editor is a separate path (BlockNote) with its own
notion of a heading.

Found while writing the starter template's welcome note, which wanted to link
forward to one of its own sections. The link was replaced with a sentence in
prose; the gap is untouched.

## Scope to decide

The heading case is the smallest instance of a larger question — what belongs in
the URL:

- Headings within a note, and what a slug looks like. The starter notes have
  headings like `### 🗺️ Drop a place on the map`, so emoji and punctuation are
  not hypothetical. Slugs are a compatibility surface: once links are written
  against them, changing the rule breaks those links.
- Whether an anchor is also honoured in the editor, or reading only.
- The sidebar selection — which built-in view, saved view, or type is open.
- Whether a saved view's own state (sort, filters if they ever become
  interactive) is addressable.

## Worth checking while scoping

- What the app currently puts in the URL, and how a note is addressed today.
- `/shared/<id>/` pages are rendered by a separate path
  (`scripts/shared-render.mjs`) — whether anchors are expected to work there too.
- ADR 0008 covers links *between* notes (`[[wikilinks]]`); this is navigation
  *within* one, plus app state. Check the boundary rather than assuming it.

## Related

- `plan/todo/0003-wikilink-preprocess-skips-inline-code.md` and
  `plan/todo/0004-emphasis-around-inline-code-splits.md` — both are round-trip
  defects around inline code, unrelated to routing but open in the same area.
