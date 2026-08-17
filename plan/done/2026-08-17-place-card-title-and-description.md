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
7. AC 8-9 — a description carrying markup still promotes to a card, and its
   markup renders rather than being flattened. Covered by the
   `what becomes a place card` and `keeps its markup` suites in
   `src/lib/richMarkdown.test.jsx`; both confirmed to fail without the fix.
8. `yarn verify` green; `adr/0049-*.md` → Implemented; `INDEX.md` regenerated.

All met. `yarn verify` green at 609 tests / 41 files. Verified in the running app
by Marco: the card renders an overridden title with the description below it, and
emphasis in the description survives a reload and an edit-source round trip.

## What the description's markdown exposed

Rendering emphasis in the description (AC 7) surfaced a defect in the block
promotion that predates this item and was never reachable before, because a
description could not previously carry markup worth writing.

`⟬…⟭` token payloads are percent-encoded, but `encodeURIComponent` leaves most
markdown punctuation untouched — `*`, `_`, `~`, `!`, `[` are unreserved URI
characters. So a description carrying `**bold**` reached BlockNote's parser with
its markers intact, came back as three styled spans, and `paragraphSoleText` —
which required the paragraph to be a SINGLE text span — returned null. The
promotion silently failed and the reader was shown the raw
`⟬g0:-%20%5BCiolo%5D…⟭` token instead of the card. Inline code never showed it
only because backticks happen to be percent-encoded.

Escaping the offending characters was rejected: it is a list to keep in sync
with a markdown dialect, and the next unescaped character brings the bug back.
`paragraphSoleText` now joins the text across all the paragraph's spans, so what
a block IS depends on its text alone and not on the styling the parser applied
on the way — which is the rule the product actually wants: **a paragraph or list
item that starts with a Maps link is a place card, whatever the description
contains.**

Joining the spans then exposed the other half of the same problem. The parser
does not merely split the payload — it CONSUMES the markers into each span's
`styles`, so the joined text was `a b c` where the author wrote `a **b** c`. The
vault file stayed correct (the exporter re-applies the styles on the way out),
which is why the round-trip tests were green while the card on screen was flat:
the card renders from the token, and the emphasis was gone by the time it got
there. `paragraphSoleText` now re-emits the markers from each span's styles.
`~~strike~~` was added to the inline renderer at the same time — the editor's own
toolbar writes it, so a description can acquire one without the author typing
any markdown.

Two further gaps found while covering that rule, both fixed:

- A place nested under a plain parent item (`- outer` / `  - <link>`) came back
  with a blank line inserted, turning the parent into a loose list — so merely
  opening the note changed it. `postProcessMapLinks` only collapsed the blank
  line between two adjacent tokens; it now also collapses it after an ordinary
  list item. Pre-existing, unrelated to 0049, in scope here.
- `esc()` in `MapView` duplicated `escapeHtml`; consolidated.

Covered by the `what becomes a place card` suite in
`src/lib/richMarkdown.test.jsx`: twelve shapes that must promote (bullet,
ordered, paragraph, autolink, `*` marker, strong/em/code/strike/link/underscore
in the description, nested), three that must not (mid-prose, text before the
link, heading), and the round-trip for each. Confirmed to fail without the fix.

## Notes

Behaviour change on existing vaults, and it is the point of the item: a line
like `[Ciolo](…) trailing text` renders titled *Ciolo* where it used to render
titled with the Maps name. Vault markdown is not rewritten — only what is read
from it changes.

Independent of `plan/todo/0001-*.md`.

---

Shipped: `6f7d56c`.
