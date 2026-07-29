---
adr: 0009
title: Three-panel responsive UI with a Tolaria-style note list
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002, 0007]
tags: [ui, navigation]
---

# ADR 0009 — Three-panel responsive UI with a Tolaria-style note list

## Context

The core capability is private viewing of the vault from any device
(`adr/0004-vault-compatibility-target.md`), so the UI must make notes and views
browsable on desktop and mobile. A familiar shape for a vault browser is a
three-panel layout — navigation (views + types), a list of notes, and the note
itself — collapsing gracefully on small screens.

## Capability statement

The client presents a three-panel, responsive UI: a sidebar of saved views and
note types, a note list, and the note view. The note list is Tolaria-style: each
entry shows the note's type icon and colour taken from its Type document, and the
Type documents themselves are excluded from the list. The list header offers
search (title, with an optional "search in body" toggle) and sort. On mobile the
panels collapse to a single-column flow.

## User stories / scenarios

- As a reader on mobile, I browse views, pick a note, and read it in a layout
  that fits a phone.
- As a reader, I recognise a note's type at a glance from its icon and colour.
- As a reader, I search and sort the note list to find a note quickly.

## Acceptance criteria

1. The UI has three panels — sidebar (views + types), note list, note view — and
   reflows to a single column on small screens.
2. Note-list entries show the type icon and colour resolved from the note's Type
   document; notes of `type: Type` are excluded from the list.
3. The list header provides search over titles with an optional body-content
   toggle, and a sort control.
4. Selecting a view or type filters the list (views evaluated per
   `adr/0007-tolaria-views-evaluator.md`).

## Out of scope

- The read-only Properties panel (`adr/0011-read-only-properties-panel.md`).
- The map view toggle (`adr/0028-google-maps-places.md`).

## Open questions

- None.

## References

- src/components/Sidebar.jsx, src/components/NoteList.jsx, src/components/NoteView.jsx
- src/components/Icon.jsx
- adr/0007-tolaria-views-evaluator.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
