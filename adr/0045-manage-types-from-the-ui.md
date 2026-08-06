---
adr: 0045
title: Manage note types from the UI — create, edit, and guarded delete
status: Proposed
date: 2026-08-06
owner: marco
supersedes:
superseded-by:
depends-on: [0019, 0021, 0022, 0023]
tags: [types, ui, editor, commit, vault]
---

# ADR 0045 — Manage note types from the UI — create, edit, and guarded delete

## Context

A type is not a first-class object in the vault: it is an ordinary note carrying
`type: Type`, whose H1 is the type's name and whose frontmatter holds its
presentation metadata. Notes join a type by repeating that name as a string in
their own `type:` frontmatter. Nothing else binds the two — the Type document's
filename plays no part in resolution.

Today the only way to add a type is to write that file by hand, or have an agent
write it. Everything the app needs is already in the file; what is missing is the
surface to author it. Four properties of the current implementation shape the
answer.

**The list of types is derived from usage, not from declaration.** `src/content.js`
builds it from the notes that carry a type:

```js
export const contentNotes = notes.filter((n) => n.type !== 'Type');
export const types = [...new Set(contentNotes.map((n) => n.type).filter(Boolean))].sort();
```

A Type document with no notes attached is therefore invisible everywhere — not in
the sidebar, not as a choice. A create action built on today's derivation would
write a file and produce no observable result. The derivation has to become the
union of declared types and types in use, so that declaring one is enough to see
it, while a `type:` written by hand with no Type document behind it keeps working
as it does now.

**Renaming is a fan-out, not a field edit.** Because notes reference the type by
name, changing the name means rewriting `type:` in every note that carries it,
alongside the H1 of the Type document itself. That is a multi-file change, which
the commit path already supports atomically
(`adr/0019-atomic-commit-git-data-api.md`). It is also the reason rename cannot be
deferred: with delete blocked while notes exist, a type with notes attached would
otherwise be neither renamable nor removable.

**`order:` is written by vaults and ignored by the app.** Real Type documents carry
an `order:` that expresses the author's intended sequence; the sidebar sorts
alphabetically and discards it. Offering the field in an editor while the product
ignores it would ship a control that does nothing, so honouring it in the sidebar
is part of this decision rather than a separate one.

**Frontmatter edits are line-level.** `adr/0022-frontmatter-preserved-line-ops.md`
forbids re-serialising YAML, so editing an existing Type document updates the lines
it owns and leaves every other key — including keys this panel does not know about
— exactly as written. Creating a new document is unconstrained, since there is
nothing to preserve.

The description is the Type document's body, below the H1. It is the one field
with no consumer inside the app: its audience is the agents that work on the vault,
and the human reading or editing the type. It therefore needs to be authored and
displayed in this panel, and nowhere else.

## Capability statement

Types are managed from the app as first-class objects: the sidebar lists every type
the vault declares or uses, and a dedicated panel creates a new one and edits an
existing one through the same form — name, description, icon, colour, and order.
Saving writes an ordinary Type document to the vault (`type: Type` frontmatter, H1
as the name, description as the body), through the existing commit path. Renaming a
type is the same edit, and carries the rename into every note that references it,
atomically. Deleting a type is offered only while no note carries it; otherwise the
action is blocked and states how many notes stand in the way. Type documents stay
out of the note lists, as they are today.

## User stories / scenarios

- As a vault owner, I create a type from the sidebar and see it appear immediately
  with its icon and colour, with no notes attached yet.
- As a vault owner, I edit a type's icon, colour, order, or description without
  opening the Markdown file.
- As a vault owner, I rename a type and every note that carries it follows, in one
  commit.
- As a vault owner, I try to delete a type that 12 notes use and I am told so
  instead of silently orphaning them.
- As a vault owner, I delete a type nothing uses, and its document leaves the vault.
- As an agent working on the vault, I read a type's description in its document body
  and understand what belongs under that type.
- As a vault owner, the type I create by hand or by agent, and the one I create from
  the app, are the same kind of file.

## Acceptance criteria

1. The sidebar's type list is the union of the types declared by Type documents and
   the types carried by notes; a declared type with no notes appears with a count of
   zero.
2. Types are ordered by their `order:` ascending where present, before types without
   one; ties and the remainder are ordered alphabetically.
3. A create action in the sidebar's Types group opens a panel with fields for name,
   description, icon, colour, and order, all empty or defaulted.
4. Creating writes a new Markdown file at the vault root, named as the kebab-case of
   the type name and made unique on collision, containing `type: Type`, `icon`,
   `color`, and `order` frontmatter, plus `_organized: true` for Tolaria
   compatibility; the body is the H1 name followed by the description.
5. Selecting an existing type opens the same panel prefilled from its document.
6. Saving an edit to an existing Type document changes only the lines it owns; any
   other frontmatter key present in the file is preserved verbatim.
7. Changing the name rewrites the Type document's H1, renames its file to the
   kebab-case of the new name, and rewrites `type: <old>` to `type: <new>` in every
   note carrying it — all in a single commit.
8. A name that matches an existing type is rejected before commit, and the panel
   says why.
9. Delete is available only when no note carries the type; otherwise it is disabled
   and shows the number of notes that use it. Notes are never reassigned.
10. Deleting removes the Type document from the vault via the existing delete path.
11. The icon field offers the set of icons the app can render, searchable by name,
    and its preview matches what the app will actually render for that name.
12. Type documents remain excluded from All notes, Inbox, Shared, and views, exactly
    as they are today.
13. After a create, rename, or delete is committed, the sidebar reflects the change
    without waiting for the next build.

## Out of scope

- Reassigning notes to another type as part of deleting one. Delete stays blocked;
  the way out of a populated type is to rename it or to change the notes.
- Changing a single note's type. That is a note-level edit, not type management.
- Placing the Type document anywhere but the vault root. Creation follows the same
  rule as note creation (`src/lib/noteFile.js`): the vault owner moves it afterwards
  if their organisation calls for it.
- Editing frontmatter keys of a Type document beyond the panel's fields. Unknown
  keys are preserved, not exposed.
- Any type-related change to saved views (`adr/0007-tolaria-views-evaluator.md`,
  `adr/0032-dual-format-views-base-yml.md`).

## Open questions

- Whether to drop the app's local icon set in favour of resolving every icon through
  lucide. The local set currently takes precedence over lucide names, so a type
  whose icon name collides with one of them renders the local glyph. To be assessed
  visually during implementation; the outcome does not change any criterion above
  except how criterion 11 is satisfied.

## References

- src/content.js, src/components/Sidebar.jsx, src/components/Icon.jsx
- src/lib/noteFile.js, src/lib/drafts.js, src/lib/created.js, src/lib/deleted.js
- adr/0019-atomic-commit-git-data-api.md
- adr/0021-draft-state-optimistic-ui.md
- adr/0022-frontmatter-preserved-line-ops.md
- adr/0023-note-create-delete.md
- adr/0011-read-only-properties-panel.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-08-06 | r1 | marco | Initial draft. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
