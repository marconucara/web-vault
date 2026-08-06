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

## Outcome

All three shapes reproduced against the real pipeline before the fix, and the
three structural tests fail against the unmodified tree — the defect was real and
this file's reversal of the 2026-08-05 downgrade was correct.

**The fix.** Both matchers are bounded to a single line (`[^\]|\n]` in `WIKILINK`,
`[^\]\n]` in `MD_LINK`), which removes shape 1 outright. A new `outsideCode`
helper applies a replacer only to the stretches of the body outside a fenced
block and outside an inline code span; `preProcessWikilinks` and
`preProcessMediaLinks` both go through it, removing shapes 2 and 3.

**The ordering question the Scope left open, and why it resolved the other way.**
Neither option in the file was taken as written. Moving `preProcessFences` ahead
of the link passes would not have worked: it rewrites only the *opening fence
line* into a sentinel language and leaves the block's content untouched, so a
`[[note]]` inside the fence would still have been visible to the wikilink pass.
The ordering was never the mechanism that protected fence content. And no
ordering of the existing passes can protect an inline code span, since nothing
marks one. So the wikilink pass learned both itself, in one shared helper, and
the pipeline order — and `postProcess`'s mirror of it — is unchanged. Recorded in
a comment above `outsideCode`.

**Exit criterion 5 verified by breaking it.** `postProcessWikilinks` was
temporarily changed to emit `[x]` instead of `[[x]]`; 10 tests failed, including
the dedicated inverse test. Restored.

Also recorded near `preProcessWikilinks`, per Scope: its correctness depends on
`postProcessWikilinks` being its exact inverse. That symmetry is what made the
defect invisible to a bytes-only check — which is what the 2026-08-05 audit ran,
and why it concluded there was nothing to fix. ADR `0015` r7 adds criterion 7 so
the rule is stated rather than rediscovered: the block structure is part of the
contract, not only the bytes.

**Known limitation, deliberately not fixed here.** `bodyHasUnsafeForBlockNote`
(`src/lib/mdLinks.js`) also runs `MD_LINK` over the whole body without skipping
code, so a note that merely *mentions* a media link inside a fence is still
routed to the raw editor. It is a false positive in the safe direction — the note
is editable, just not in the block editor — and outside this item's scope.

190 → 210 tests. `yarn verify` green.

---

Shipped at HEAD `c2cd6e0` — see the commit for the exact tree.
