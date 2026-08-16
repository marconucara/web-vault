# A place card's title and description are written separately

**Owning ADR(s):** `adr/0049-place-card-title-and-description.md` (Proposed →
Implemented on this item's commit).

## Scope

Split the single author-text slot into an explicit title and description, per
0049's acceptance criteria.

**The reader.** `src/components/MapCard.jsx:122-126` today computes

```
title = info.title || label
note  = desc || (info.title ? label : null)
```

Replace with the unconditional rule: `title = label || info.title || url-text`,
`note = desc`. Nothing else on the card changes — `meta` (category · address),
rating and photo keep reading from `info`.

**The writer.** `buildLine` (`MapCard.jsx:20`) writes the description into the
link label; it must write `[title](url) description`, emitting the brackets only
when a title is present and the trailing text only when a description is. The
list marker and number keep being preserved as they are now.

**The editor.** `EditPopover` gains a third field between URL and Description.
Empty title = no override; its placeholder should say so. New i18n keys in
`src/locales/en.json` and every other catalogue (`adr/0047-*.md`) — English at
the point of use.

**Inline markdown in the description** (criterion 7). The description is plain
text in a custom BlockNote block today, so this needs an inline renderer for
emphasis / strong / code, degrading unrecognised markup to its literal source.
Keep it to a small local renderer over the description string — the description
is never parsed back out of the DOM (the block's source of truth stays the
token), so this cannot touch the round-trip.

**The map view.** `src/components/MapView.jsx` builds its popup title and note
from the same parsed line; apply the identical rule so both surfaces name a
place the same way (criterion 9).

The parser needs no change: `parseMapCardLine` already returns `label` and
`desc` separately (`src/lib/mdLinks.js:42-54`).

## Exit criteria

Mapped to `adr/0049-*.md`:

1. AC 1-3 — `[T](url) D` renders title `T`, description `D`; a bare link renders
   the Maps name; a resolved name never overrides link text and link text is
   never shown as a description. Unit tests over the reader's title/description
   rule for all four combinations of {link text present} × {Maps name resolved}.
2. AC 4 — address, category, rating, photo and marker coordinates unchanged
   under an overridden title.
3. AC 5-6 — editor writes and preserves all three fields; a round-trip through
   the popover on a line carrying both keeps both. Test `buildLine` for each
   combination, including empty title.
4. AC 7 — description renders emphasis, strong and inline code; unrecognised
   markup appears literally.
5. AC 8 — round-trip test: a note containing card lines with title only,
   description only, both, and a description containing markdown, comes back
   byte-identical. Extends the existing round-trip suite.
6. AC 9 — map popup title/description match the card's.
7. `yarn verify` green; `adr/0049-*.md` → Implemented; `INDEX.md` regenerated.

## Notes

Behaviour change on existing vaults, and it is the point of the item: a line
like `[Ciolo](…) trailing text` renders titled *Ciolo* where it used to render
titled with the Maps name. Vault markdown is not rewritten — only what is read
from it changes.

Independent of `plan/todo/0001-*.md`.
