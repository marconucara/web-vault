---
adr: 0008
title: Wikilink resolution by title and filename
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002]
tags: [wikilinks, content, navigation]
---

# ADR 0008 — Wikilink resolution by title and filename

## Context

Notes connect through `[[wikilinks]]` in both body text and frontmatter values.
The current Tolaria canonicalises links to the vault-root-relative path form
`[[folder/filename]]`, but legacy `[[Note Title]]` and bare `[[filename]]` links
still occur and must resolve. To make links clickable in-app and to render
frontmatter relationships, the client needs a resolver that maps a link's target
to a real note regardless of which of those forms was used.

## Capability statement

At build time the client indexes every note by its id/path, its first-H1 title,
and its basename (all lower-cased). `[[wikilinks]]` in a note's body and in
frontmatter values resolve against that index to a target note; resolved links
become clickable in-app (hash routes, `adr/0006-hash-based-routing.md`), and a
link that resolves to no note stays plain text. This works in the reading view,
in frontmatter relationship rendering, and — for the editor — underpins
interactive wikilink chips (`adr/0016-wikilink-and-media-blocks.md`).

## User stories / scenarios

- As a reader, I click a `[[wikilink]]` and land on the target note.
- As a reader, I see frontmatter relationships (`related_to`, `belongs_to`, …)
  as clickable links to their targets.
- As a vault owner using older link forms, my `[[Note Title]]` and
  `[[filename]]` links still resolve, not only the canonical path form.

## Acceptance criteria

1. The content artifact includes a title/id index mapping lower-cased id, H1
   title, and basename to the note id.
2. `[[wikilinks]]` in body text resolve to the target note and render as in-app
   links; unresolved links render as plain text.
3. Frontmatter values containing `[[wikilinks]]` are treated as relationships and
   resolved to their targets.
4. The path form `[[folder/filename]]`, the title form `[[Note Title]]`, and the
   bare `[[filename]]` form all resolve.

## Out of scope

- Rewriting or canonicalising links in the vault (the client does not modify
  vault files for reading).
- Interactive wikilink chips in the block editor
  (`adr/0016-wikilink-and-media-blocks.md`) — this ADR covers resolution only.

## Open questions

- None.

## References

- src/lib/wikilinks.js
- src/lib/mdLinks.js
- adr/0002-build-time-content-pipeline.md
- adr/0044-what-the-url-addresses.md — a target may carry a heading anchor
  (`[[note#heading]]`). The rules below are unchanged: they answer which note the
  target names, applied to the substring left of the anchor, and the anchor
  itself is never resolved here.

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
