---
adr: 0023
title: Create and delete notes from the client
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0019]
tags: [editor, commit, notes]
---

# ADR 0023 — Create and delete notes from the client

## Context

Beyond editing existing notes, the convenience editor should let a user create a
new note and delete one, still through the same commit path
(`adr/0019-atomic-commit-git-data-api.md`) and still respecting vault conventions
(H1 title, `type`, folder placement).

## Capability statement

The client can create a new note via a small form (title → kebab-case filename,
`type`, target folder) and delete an existing one, both committed through the
commit endpoint. Creation sends the full file content with an `isNew` flag; the
endpoint refuses if a file already exists at that path (409 collision) to avoid
clobbering a note added outside the web editor. Deletion removes the file via a
null-sha tree entry, treating an already-absent file as a no-op. New notes follow
vault conventions: an H1 title, a `type` in frontmatter, and placement in the
chosen folder.

## User stories / scenarios

- As an editor-user, I create a note by giving a title, type, and folder, and it
  is committed as a well-formed Markdown file.
- As an editor-user, I delete a note and it is removed from the vault on commit.
- As a vault owner, a new note created from the web follows the same conventions
  as one created elsewhere.

## Acceptance criteria

1. A create form derives a kebab-case filename from the title and captures `type`
   and target folder; the note is committed with an `isNew` flag and full content.
2. Creation fails with a 409 if a file already exists at the target path.
3. Deletion removes the file (null-sha tree entry); an already-absent file is a
   no-op.
4. Created notes carry an H1 title and `type` frontmatter and land in the chosen
   folder.

## Out of scope

- Renaming/moving notes (not covered here).
- The batch/optimistic commit mechanics (`adr/0021-draft-state-optimistic-ui.md`).

## Open questions

- None.

## References

- src/lib/noteFile.js, src/lib/created.js, src/lib/deleted.js, functions/commit.js
- adr/0019-atomic-commit-git-data-api.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
