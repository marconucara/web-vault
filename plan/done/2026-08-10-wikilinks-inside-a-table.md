# A wikilink inside a table cell stays a link

**Owning ADR(s):** `adr/0015-durable-markdown-round-trip.md`, `adr/0008-wikilink-resolution.md`

## Context

A wikilink written inside a table cell was not a link in the editor. Instead of
a chip, the cell showed the protection token verbatim —
`‹portafoglio%2Fdecisioni-aperte-portafoglio›` — and correcting it by hand did
not help: the next save wrote the token back, so the note re-opened broken.
Reported from a real vault note whose portfolio table links a decisions note
from two rows.

Two independent defects sat on the same path.

**1. Table cells were never scanned.** `injectCustomBlocks` /
`extractCustomBlocks` map a block's inline content behind
`Array.isArray(b.content)`. A table's content is not an array — it is a
`tableContent` object holding `rows[].cells[]`, where each cell is itself either
a bare inline array or a `tableCell` object wrapping one. The guard is false for
every table, so no cell ever reached `injectInline`: the token was left as text
on the way in, and there was no chip to encode on the way out.

**2. The alias pipe split the cell.** Once the first defect is fixed, an
aliased link (`[[folder/target|Alias]]`) still degrades — but on the serialize
side. `blocksToBody` ran `normalizeMarkdown(postProcess(out))`, so the wikilink
was restored *before* the table row was compacted, and `compactTableLine` splits
a row on every `|`. The alias pipe read as a cell boundary and
`[[folder/target|Alias]]` was written back as `[[folder/target | Alias]]` —
a different link target, spread across two cells.

## Scope

- Scan and rewrite the inline content of table cells in both directions,
  handling both cell shapes.
- Restore the tokens *after* the row is compacted, not before, so an alias pipe
  is still url-encoded (`%7C`) while `compactTableLine` splits the row.

Both fixes are on the editor's markdown layer. The static/read-only renderer
(`scripts/shared-render.mjs`, markdown-it) has its own wikilink pass and never
had either bug.

## Out of scope

- Media links (`⟦…⟧`) and map cards in table cells beyond what the same shared
  mapping gives for free — they travel through the same `injectInline`, so a
  media link in a cell is fixed by the same change, but no separate behaviour is
  designed for it here.
- Any change to how a wikilink resolves (`adr/0008-*.md` is untouched).

## Exit criteria

1. A wikilink in a table cell renders as a chip in the editor, in both the plain
   `[[target]]` and the aliased `[[target|alias]]` form.
2. A note holding such a table round-trips byte-identical: opening it and saving
   without an edit rewrites the same markdown, alias pipe included.
3. Tests cover both directions (inject renders chips, round-trip preserves the
   source) and pin the pipe case that the serialize order broke.
4. `yarn verify` green.
5. Verified by hand in the running app against the reporting vault note before
   the change is committed.

---

## Outcome

Both defects were on the editor's markdown layer, and the second was only
reachable once the first was fixed — the alias never survived far enough to be
split while the cell was not scanned at all.

`mapBlockContent` / `mapTableContent` in `src/lib/blocknoteSchema.jsx` map a
block's inline content whatever shape it has, so `injectCustomBlocks` and
`extractCustomBlocks` reach table cells through the same call they already used
for paragraphs. Both cell shapes are handled: the bare inline array and the
`tableCell` object wrapping one. Media links in cells are fixed by the same
change, since they travel through the same `injectInline`.

`blocksToBody` and `serializeEditorBody` now run `postProcess(normalizeMarkdown(out))`
rather than the reverse. The ordering is load-bearing rather than incidental, so
the reason sits on `postProcess` itself: while the payload is inside its token
the alias pipe is `%7C`, and `compactTableLine` can split the row on `|` without
seeing it.

Both tests were checked against the pre-fix code rather than assumed to bite:
reverting the cell mapping fails the chip test with an empty wikilink list, and
reverting the serialize order fails the round-trip with the exact reported
symptom, `[[folder/target | Alias]]`. A test that passes either way would have
protected nothing.

The static renderer (`scripts/shared-render.mjs`, markdown-it) has its own
wikilink pass and never had either bug — the share pages were always correct,
which is part of why this read as an editor-only defect.

335 tests (2 new). No ADR moves: `adr/0015-*.md` and `adr/0008-*.md` are both
already `Implemented`, and this is a defect against them, not a new decision.

Verified by hand against the reporting vault note before the commit landed.

---

Shipped at HEAD `2ebcf6b`, released as `v0.9.1`.
