---
adr: 0014
title: Inline WYSIWYG editor on BlockNote, CodeMirror raw fallback
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0003]
tags: [editor, ui, stack]
---

# ADR 0014 — Inline WYSIWYG editor on BlockNote, CodeMirror raw fallback

## Context

Editing the vault is a **convenience**, not the core of the product
(`adr/0004-vault-compatibility-target.md`); the primary editing path is via
coding agents. As a convenience, though, the in-app editor should edit inline on
the rendered note (Notion/Confluence/Tolaria style), not through a separate
source editor with an edit/preview toggle. **BlockNote** — a block editor on
ProseMirror/TipTap, with native blocks for images/video/audio/file and code —
provides the WYSIWYG, and CodeMirror 6 (already used earlier as a source editor)
stays as a "raw" fallback. **Milkdown** was considered and rejected as the
WYSIWYG. BlockNote core is **MPL-2.0** and is used as a plain library; its
Pro/AI/collab add-ons are commercial and not used.

## Capability statement

The in-app note view and edit use a WYSIWYG block editor built on BlockNote,
always-on for notes, with a CodeMirror 6 "raw" source mode kept as a fallback.
The editor is **lazy-loaded** (dynamic import) because the BlockNote/ProseMirror
bundle is heavy; the lightweight read rendering stays for the static share pages
(`adr/0025-public-share-pages.md`), which never load the editor. Fidelity of the
markdown it reads and writes is guaranteed by the durable-markdown round-trip
layer (`adr/0015-durable-markdown-round-trip.md`).

## User stories / scenarios

- As an editor-user, I edit a note inline on its rendered view, not in a
  split-pane source editor.
- As an editor-user, I can drop to a raw CodeMirror source mode when I need it.
- As a reader on a slow connection, the heavy editor code is not loaded until I
  edit.

## Acceptance criteria

1. The in-app editor is BlockNote-based, always-on for viewing and editing notes.
2. A CodeMirror 6 raw/source mode is available as a fallback.
3. The editor bundle is lazy-loaded (dynamic import), not in the initial payload;
   the static share pages do not load it.
4. BlockNote is used as a library under its MPL-2.0 license; no commercial
   BlockNote add-on is depended upon.

## Out of scope

- The lossless markdown round-trip guarantee
  (`adr/0015-durable-markdown-round-trip.md`).
- Interactive wikilink/media blocks in the editor
  (`adr/0016-wikilink-and-media-blocks.md`).

## Open questions

- None.

## References

- src/components/BlockEditor.jsx, src/components/Editor.jsx
- adr/0015-durable-markdown-round-trip.md
- https://github.com/refactoringhq/tolaria

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
