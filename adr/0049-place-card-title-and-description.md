---
adr: 0049
title: A place card's title and description are the author's to write
status: Proposed
date: 2026-08-16
owner: marco
supersedes:
superseded-by:
depends-on: [0028, 0015]
tags: [maps, editor, markdown, ui]
---

# ADR 0049 — A place card's title and description are the author's to write

## Context

`adr/0028-google-maps-places.md` made a Maps link that starts its own line render
as a place card, and it settled where the card's text comes from: the **title is
always the Maps place name**, and whatever the author wrote is demoted to a
description line — but only *conditionally*. `MapCard` reads

```
title = info.title || label
note  = desc || (info.title ? label : null)
```

so the link's own text (`label`) is the title when Google resolved nothing and
the description when it did. Its meaning flips on the outcome of a build-time
network fetch the author cannot see, let alone control.

The consequence, hit in a real vault: **the author cannot write both.** Given

```
- [Ciolo](https://www.google.com/maps/search/Il+Ciolo+Gagliano+del+Capo) ~30 min. Fiordo con ciottoli in fondo, spettacolare ma scomodo (scalinata lunga).
```

the card shows Google's name as the title and the trailing sentence as the
description, and `Ciolo` — the short name the author chose, the one that reads
well in a list of twenty places — is silently dropped. Writing it the other way
round does not help: there is exactly one slot for author text and its role is
decided elsewhere.

The in-place editor makes the same assumption structurally. Its popover offers
*URL* and *Description*, and `buildLine` writes the description **into the link
label** (`[desc](url)`). So editing a card rewrites the author's title as a
description, and a line that had both loses one on save. The markdown still
round-trips — 0028's token machinery is intact, `adr/0015-durable-markdown-round-trip.md`
is not at risk — but it round-trips the *wrong text*, which the round-trip
guarantee cannot catch.

The parser is not the problem. `parseMapCardLine` has always returned
`{ label, desc }` separately for `[text](url) trailing text`. Only the reader
collapses them.

## Capability statement

**The author writes the card's title and its description, independently, in
ordinary markdown.** On a place-card line, the link's own text is the card's
**title** and the text following the link is its **description** — both optional,
neither conditional on anything the build resolved. A card with no link text
falls back to the Maps place name, and then to the link itself; a card with link
text uses it, whether or not Google resolved a name. Everything Maps resolved
that is not the name — address, category, rating, photo, coordinates — keeps
appearing exactly as it does today, so an override changes what the card is
*called*, never how much it knows. The in-place editor exposes the same three
fields it can now write — URL, title, description — and saving a card preserves
the parts the author did not touch.

## User stories / scenarios

- As a vault owner, I write `[Ciolo](…maps…) ~30 min. Fiordo con ciottoli` and
  the card is titled *Ciolo* with my sentence below it, next to the address and
  rating Maps resolved.
- As a vault owner, I write a bare Maps link and the card is titled with the
  place name Maps resolved, as it always was.
- As a vault owner, a build where Google answered `429` changes the card's
  address and photo but never renames my place.
- As a vault owner, I open a card's editor, fix a typo in the description, and
  my title is still there after saving.
- As a vault owner, I give a place a short title in a long list, so twenty
  entries read as a list rather than as twenty full official names.

## Acceptance criteria

1. On a place-card line, the link text is the card's title and the text after
   the link is its description. Both are optional and independent: a line may
   carry neither, either, or both.
2. The title resolves as: the link text if present; else the resolved Maps place
   name; else the link's own URL text. It never depends on whether the build
   resolved a name.
3. The description is the text after the link, and nothing else. Link text is
   never shown as a description, on any resolution outcome.
4. A resolved place's address, category, rating and photo render on the card
   unchanged when the title is overridden, and the marker keeps its coordinates.
5. The in-place editor offers URL, title and description as three separate
   fields. An empty title field means *no override* — it writes no link text and
   the card falls back per criterion 2.
6. Saving from the editor rewrites only the fields the author changed; a
   title-and-description line saved with an edited description keeps its title,
   and its list marker and number are preserved.
7. The description renders inline markdown — at least emphasis, strong emphasis
   and inline code. Any markup it cannot render degrades to its literal source
   text rather than being dropped.
8. The line round-trips to the vault verbatim per
   `adr/0015-durable-markdown-round-trip.md`: opening a note and saving it
   without touching a card leaves that card's line byte-identical, including a
   description containing markdown.
9. The map view's marker popup follows the same title and description rules as
   the card, so a place is named identically in both surfaces.

## Out of scope

- Editing the resolved place data (address, category, rating, photo). Those stay
  build-resolved and read-only, per `adr/0028-*.md`.
- Block-level markdown in the description (lists, headings, images). Inline only.
- Any change to link *detection* — which lines become cards is 0028's rule and is
  unchanged here.
- Multi-line descriptions.

## Open questions

- None.

## References

- adr/0028-google-maps-places.md — the card and the map view this revises.
- adr/0015-durable-markdown-round-trip.md — the round-trip guarantee.
- src/components/MapCard.jsx, src/components/MapView.jsx, src/lib/mdLinks.js

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-08-16 | r1 | marco | Initial draft. Splits the single author-text slot 0028 defined into an explicit title and description, and removes the conditional in which the link text meant one or the other depending on whether the build resolved a place name. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
