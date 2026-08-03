# Fix Round-Trip Fidelity on Soft-Wrapped Notes

**Owning ADR(s):** `adr/0015-durable-markdown-round-trip.md`
**Dependencies:** None

## Context

ADR 0015 is `Implemented`, but its acceptance criterion 1 (byte-identical
round-trip on real notes) does not hold for notes whose paragraphs and list
items are **soft-wrapped** across source lines — the common shape of a
hand-authored note. The existing suite (`src/lib/richMarkdown.test.jsx`)
exercises the token helpers in isolation and never round-trips a whole
realistic note, which is why the regression went unnoticed.

Reproduced on the starter template's `welcome.md`:

| # | Symptom | Cause |
|---|---------|-------|
| 1 | `\` appended to every wrapped line | soft wrap re-serialized as a hard break |
| 2 | List-item continuation lines expelled from the item | 2-space continuation not kept with the item |
| 3 | `4.` renumbered to `1.` | consequence of 2 — the list is split |
| 4 | `**public and**\ ** read-only**` | emphasis spanning a soft wrap is closed and reopened |
| 5 | `- repo's*` phantom bullet | emphasis across a wrap plus a line-initial `-` |

Items 1, 4 and 5 are serialization-side and visible as raw markup on screen.
Item 2 is a structural loss (the note stops being a checklist) and is the one
that requires real work; 3 follows from it.

## Scope

- Add a round-trip fixture test over a realistic note (soft-wrapped paragraphs,
  a task list with continuation lines, an ordered list, wikilinks, map links,
  frontmatter), asserting an empty diff — mapping ADR 0015 criterion 1.
- Fix the soft-wrap/hard-break serialization (1) and the emphasis split it
  causes (4, 5).
- Assess fix (2): keep list-item continuation lines inside their item. Report
  the cost before committing to it; if it turns out to be disproportionate,
  leave it out and record it explicitly rather than widening this item.
- Keep `welcome.md` in the starter template authored as a normal note — the
  template must not be reshaped to dodge the bug (see the vault-shape rule).

## Out of scope

- Advanced block fidelity (math, mermaid, callout, tldraw) — already out of
  scope in ADR 0015.
- Map place-card round-trip, covered by `adr/0028-google-maps-places.md`.

## Exit criteria

1. A fixture-based round-trip test exists and fails before the fix, passes
   after, for symptoms 1, 4 and 5.
2. No `\` hard-break markers are introduced for source-level soft wraps.
3. Emphasis spanning a soft wrap survives the round-trip unsplit.
4. Symptom 2 is either fixed (with the ordered-list numbering in 3 restored) or
   explicitly recorded as deferred, with the reason.
5. `yarn verify` green.
6. ADR 0015 stays `Implemented`; a Revision History row records the fidelity
   fix.
