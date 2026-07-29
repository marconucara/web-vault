---
adr: 0011
title: Read-only Properties panel
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002, 0008, 0010]
tags: [ui, properties]
---

# ADR 0011 — Read-only Properties panel

## Context

A note carries structured metadata (type, frontmatter properties, relationships)
and derived facts (dates, size, last commit) that are useful to see without
reading the raw frontmatter. A Tolaria-style Properties drawer presents these.
Editing frontmatter would reopen the YAML round-trip problem (line-level edits
without re-serialisation, `adr/0022-frontmatter-preserved-line-ops.md`), so this
panel is read-only.

## Capability statement

A right-side drawer, toggled from the note toolbar, shows the note's properties
read-only: **Type** (icon + colour from the Type document), **scalar properties**
(non-`_`, non-relationship frontmatter; `url` rendered as a link),
**Relationships** grouped by key with clickable chips
(`adr/0008-wikilink-resolution.md`), an **Info** section (modified/created from
git dates, word count, byte size), and the **last commit** that touched the file
(short sha + subject, linked to the repo host). Only the last commit is shown,
not the full history — too costly to bundle for a secondary datum.

## User stories / scenarios

- As a reader, I inspect a note's type, properties, and relationships without
  opening its raw frontmatter.
- As a reader, I follow a relationship chip to the related note.
- As a reader, I see when the note was created/modified, its size, and the last
  commit that changed it.

## Acceptance criteria

1. A toggle in the note toolbar opens/closes a read-only Properties drawer.
2. Sections render: Type (icon+colour), scalar properties (excluding `_`-prefixed
   and relationship keys; `url` as a link), Relationships grouped by key with
   clickable chips, Info (modified/created, words, bytes), Last commit
   (sha+subject, linked).
3. The panel never mutates the note; frontmatter editing is not offered here.
4. Word count and byte size are computed at build time and read from the content
   artifact.

## Out of scope

- Editing properties/frontmatter (a future capability; would use line-level ops
  per `adr/0022-frontmatter-preserved-line-ops.md`).

## Open questions

- Editable properties: deferred. It reopens frontmatter YAML round-trip and needs
  line-level operations like the ones used for `share_id`.

## References

- src/components/PropertiesPanel.jsx
- scripts/build-content.mjs (words, bytes, lastCommit)
- adr/0008-wikilink-resolution.md, adr/0010-git-derived-dates.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
