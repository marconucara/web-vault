# Stop the wikilink pass from consuming code spans and fenced blocks

**Owning ADR(s):** `adr/0015-durable-markdown-round-trip.md`, `adr/0008-wikilink-resolution.md`
**Dependencies:** None

## Context

This item was filed as a bug, then downgraded on 2026-08-05 to a coverage-only
task after a re-verification found no user-visible defect. **That downgrade was
wrong, and this file is rewritten to reverse it.** The defect reproduces; the
2026-08-05 check simply did not exercise the shape that triggers it.

The cause is in the wikilink regex (`src/lib/richMarkdown.js`):

```js
const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
```

`[^\]|]` matches newlines. So an **unmatched `[[`** — typically one inside a code
span, in a note that documents the wikilink syntax — is not left alone: it starts
a match that runs to the next `]]` **anywhere later in the file**, across
paragraphs and headings, and percent-encodes the whole span into a single inline
token.

Three shapes were measured against the real pipeline. In all three the tokens are
decoded symmetrically on the way out, so an untouched note still commits
byte-identical — the damage is in what the editor shows, and it becomes permanent
the moment the user edits the affected block, because the encoded blob is then
committed as literal text.

**1. Structural loss — the reported case.** An unmatched `[[` in a code span with a
real wikilink further down the note:

```markdown
### Wikilinks

Type `[[` to trigger autocomplete from your entire vault. This creates links to other notes, enabling the knowledge graph.

### Tasks

See [[welcome]] for more.
```

The editor receives **two blocks instead of four**. The second heading and its
paragraph are gone from the view, absorbed into one paragraph, and the code span's
closing backtick is encoded as `%60` inside the token so the span never closes:

```
[heading]   Wikilinks
[paragraph] Type `‹%60%20to%20trigger%20autocomplete…%0A%0A%23%23%23%20Tasks%0A%0ASee%20%5B%5Bwelcome› for more.
```

**2. Same-line variant.** `` Type `[[` then [[welcome]]. `` keeps its block
structure, but the closing backtick is still swallowed into the token
(`` Type `‹%60%20then%20%5B%5Bwelcome›. ``), so the code span is broken and the
real wikilink after it is destroyed as a link. This is the shape the previous
revision of this file documented and dismissed.

**3. Fenced blocks are not protected either.** In the pipeline,
`preProcessWikilinks` runs *before* `preProcessFences`, so a complete `[[note]]`
written inside a fence — exactly what a note explaining the syntax does — is
consumed as a wikilink instead of staying literal:

```
[codeBlock] Use ‹some%20note› to link.
```

`MD_LINK` in `src/lib/mdLinks.js` has the same defect in the same place —
`/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g`, where `[^\]]*` also matches newlines — so the
media-link pass can run away across blocks in the same way.

## Scope

- Bound the wikilink match to a single line. A wikilink never spans lines in
  Tolaria or Obsidian, so excluding newlines from both character classes is a
  faithful narrowing, and it removes shape 1 — the structural loss — outright.
- Apply the same narrowing to `MD_LINK`.
- Leave the content of code spans and fenced blocks alone, removing shapes 2
  and 3. Ordering has to be settled here rather than assumed: `preProcessFences`
  currently runs *after* `preProcessWikilinks`, so either the pipeline order
  changes (and `postProcess` order changes with it, symmetrically) or the wikilink
  pass learns to skip fenced regions itself. Pick one during implementation and
  record why in a comment.
- Record near `preProcessWikilinks` that its correctness depends on
  `postProcessWikilinks` being its exact inverse, so the next reader knows why the
  tests below exist.

## Tests

Round-trip tests locking in the fixed behaviour:

- the three shapes above, asserting both the resulting **block structure** and the
  round-tripped body — structure is what the previous revision failed to check,
  and it is where the defect shows;
- a bare `` `[[` `` in inline code followed by a real wikilink later in the line;
- a complete `[[note]]` inside an inline code span;
- the same inside a fenced code block, asserting the fence content stays literal;
- an aliased `[[a|b]]` in code alongside a real `[[target|alias]]`;
- a code span containing `]]` before a real wikilink;
- the media-link equivalents, which share the shape of the problem.

## Out of scope

- Escaping wikilinks outside code (e.g. a `\[[` escape hatch).
- Changing how a resolved wikilink renders (`adr/0016-wikilink-and-media-blocks.md`).
- Any change to wikilink *resolution* — this is the durable-markdown layer only.

## Exit criteria

1. The reported note round-trips **and** parses to the same block structure it has
   in the source: four blocks, both headings intact.
2. Shapes 2 and 3 are fixed: the code span keeps its closing backtick, and a
   wikilink inside a fence stays literal in the code block.
3. Each case listed under Tests has a test asserting the body is unchanged, and
   the structural cases additionally assert the block sequence.
4. The media-link equivalents are covered.
5. The tests fail if `postProcessWikilinks` stops being the exact inverse of
   `preProcessWikilinks` (verify by temporarily breaking one of them).
6. The existing `src/lib/richMarkdown.test.jsx` suite stays green — this change
   touches the layer those tests protect, so no round-trip regression is
   acceptable in exchange for the fix.
7. `yarn verify` green.

## Notes

- The fence defect found during the 2026-08-05 verification (an unlabelled fence
  came back labelled `text`) shipped separately on 2026-08-06; see
  `plan/done/2026-08-06-fence-shape-lost-on-round-trip.md`.
