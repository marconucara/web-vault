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
BlockNote schema; a chip opens its target note (resolved per
`adr/0008-wikilink-resolution.md`) on **Cmd/Ctrl+click**, while a plain click does
not navigate, so the chip can be placed and edited. Media and file links render
as native elements: inline image/video/audio/file links as
chips, and block-level media as native BlockNote players/cards (images, video,
audio, files). All of these serialise back to their plain-markdown form on
export, preserving the round-trip.

## User stories / scenarios

- As an editor-user, a `[[wikilink]]` shows as a chip I can Cmd/Ctrl+click to
  follow, and plain-click to edit around.
- As an editor-user, an image/video/audio/file renders as a real player/card in
  the editor, not a raw link.
- As a vault owner, these rich elements export back to the same markdown they
  came from.

## Acceptance criteria

1. Wikilinks render as chips through a custom BlockNote schema and open their
   target on Cmd/Ctrl+click (plain click does not navigate).
2. Inline media/file links render as chips; block-level media render as native
   BlockNote players/cards for images, video, audio, and files.
3. All wikilink and media elements round-trip back to their plain-markdown form
   on export (consistent with `adr/0015-durable-markdown-round-trip.md`).

## Out of scope

- Google Maps links, which are a distinct place-card block
  (`adr/0028-google-maps-places.md`).
- Wikilink resolution itself (`adr/0008-wikilink-resolution.md`).

## Open questions

- None.

## References

- src/lib/blocknoteSchema.jsx, src/lib/mdLinks.js
- adr/0014-wysiwyg-blocknote-editor.md, adr/0015-durable-markdown-round-trip.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
