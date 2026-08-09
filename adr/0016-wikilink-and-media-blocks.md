---
adr: 0016
title: Wikilinks and media as interactive blocks/chips in the editor
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0008, 0014, 0015]
tags: [editor, wikilinks, media]
---

# ADR 0016 — Wikilinks and media as interactive blocks/chips in the editor

## Context

In the block editor, `[[wikilinks]]` and media/file links should be first-class
interactive elements, not raw markdown text the user has to read around. This
needs custom BlockNote schema so the elements render as chips/blocks while still
round-tripping to plain markdown (`adr/0015-durable-markdown-round-trip.md`).

## Capability statement

The block editor renders `[[wikilinks]]` as interactive **chips** via a custom
BlockNote schema. A chip whose target resolves (per
`adr/0008-wikilink-resolution.md`) is a real **anchor** carrying the note's
in-app route, and a **plain click or tap opens it** — the same gesture as every
other link surface in the product, and the only one a touch device can offer. A
modifier click (Cmd/Ctrl/Shift) or a middle click opens the target in a **new
tab**; a right click or long press is left to the browser, so its own "Open in
new tab" still works. A chip whose target does not resolve stays a dead,
non-navigating chip. Media and file links render as native elements: inline
image/video/audio/file links as chips — anchors that open the file in a new tab —
and block-level media as native BlockNote players/cards (images, video, audio,
files). All of these serialise back to their plain-markdown form on export,
preserving the round-trip.

## User stories / scenarios

- As an editor-user, a `[[wikilink]]` shows as a chip I can click — or tap on my
  phone — to follow, and Cmd/Ctrl/Shift- or middle-click to open in a new tab.
- As an editor-user, an image/video/audio/file renders as a real player/card in
  the editor, not a raw link.
- As a vault owner, these rich elements export back to the same markdown they
  came from.

## Acceptance criteria

1. Wikilinks render as chips through a custom BlockNote schema. A chip with a
   resolved target is an anchor carrying `#/n/<id>`, opens that note on a plain
   left click or tap, opens it in a new tab on Cmd/Ctrl/Shift- or middle-click,
   and does not pre-empt the browser on a right click or long press. A chip with
   an unresolved target does not navigate on any gesture.
2. Inline media/file links render as chips that open their url in a new tab;
   block-level media render as native BlockNote players/cards for images, video,
   audio, and files.
3. All wikilink and media elements round-trip back to their plain-markdown form
   on export (consistent with `adr/0015-durable-markdown-round-trip.md`).

## Out of scope

- Google Maps links, which are a distinct place-card block
  (`adr/0028-google-maps-places.md`).
- Wikilink resolution itself (`adr/0008-wikilink-resolution.md`).

## Open questions

- None.

## References

- src/lib/blocknoteSchema.jsx, src/lib/chipClick.js, src/lib/mdLinks.js
- adr/0014-wysiwyg-blocknote-editor.md, adr/0015-durable-markdown-round-trip.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |
| 2026-08-09 | r2 | marco | A chip opens on a plain click or tap, not Cmd/Ctrl+click, which a touch device cannot produce at all; a resolved chip is an anchor, and modifier/middle click opens a new tab. Media chips open their url. Capability statement and AC1–AC2 rewritten. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-08-09 | — |
