---
adr: 0045
title: Manage note types from the UI — create, edit, and guarded delete
status: Implemented
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

**Case is not part of a type's identity.** Because a note joins a type by repeating
its name as a free string, vaults accumulate spellings: `Note` from one hand,
`note` from another, `NOTE` from a paste. Deriving the list by exact match turned
those into separate entries — several sidebar rows reading the same, each holding a
slice of the notes, and a count that disagreed with itself depending on which
spelling was asked about. Nothing in the product treats them as different things,
so the derivation must not either. Unifying them is a rule about how the vault is
READ; the notes keep whatever their files say, since rewriting them would be a
migration nobody asked for.

That leaves the question of which spelling to show. When a Type document declares
the type, its H1 answers it — that is the name the vault chose, and it is kept
verbatim so a deliberate `iPhone` survives. When no document does, there is no
declared spelling, only however each note happened to write it: electing one of
those makes the label an accident of the notes and lets it shift as they are edited.
The label is therefore derived rather than chosen — title case, the form a type name
takes — which is also the form the panel prefills, so adopting such a type reads as
naming it rather than renaming it.

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
is part of this decision rather than a separate one. Honouring it changes the
sidebar's order in existing vaults that today see the alphabetical one: that
re-ordering is an accepted consequence of this decision, not a regression.

**The derived type data is a build-time constant.** `types` and `typeMeta` are
module-level constants computed once from the bundled `content.json`. Notes created
or deleted from the app already survive the gap before the next build through
optimistic stores (`src/lib/localNotes.js`, `src/lib/deleted.js`), but nothing routes
those stores back into the type derivation, and a rename touches notes that are
neither created nor deleted — they are existing notes whose `type:` changed. Making
a committed type change visible before the next build is therefore not a sidebar
detail: it requires the derivation to move off the static module and onto the same
bundle-plus-overlay composition the note lists already use, and it requires the
overlay to carry modified notes, not only created ones.

**Frontmatter edits are line-level.** `adr/0022-frontmatter-preserved-line-ops.md`
forbids re-serialising YAML, so editing an existing Type document updates the lines
it owns and leaves every other key — including keys this panel does not know about
— exactly as written. Creating a new document is unconstrained, since there is
nothing to preserve.

**Icon resolution is layered, and the local layer wins.** `src/components/Icon.jsx`
resolves a name in four steps: a local line-style set, then the lucide icons bundled
at build time from the vault's Type documents, then any other valid lucide name
loaded lazily, then a `file-text` fallback. The local set exists for two reasons
that both still hold: some of its names are custom and have no lucide equivalent
(`external`, `share`, `sort`, `pointer`), and the rest give the app's own chrome a
uniform stroke and viewBox. About twenty names sit in that set, and roughly half of
them also exist in lucide (`tag`, `user`, `filter`, `check`, …), so for those a
picker listing lucide would preview a glyph the app would not render. The picker
still needs the full lucide catalogue — choice is the point when naming a type — so
the fix belongs to the preview, not to the catalogue.

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
atomically. A committed create, rename, or delete is visible immediately, because
the type list is derived from the bundled content composed with the app's local
overlay of notes it has changed, rather than from the bundle alone. Deleting a type
is offered only while no note carries it; otherwise the action is blocked and states
how many notes stand in the way. Type documents stay
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
- As a vault owner, a type my notes already use but that no document declares can be
  created from the panel, which gives it an icon, a colour, and a description without
  touching the notes.
- As a vault owner, the type I create by hand or by agent, and the one I create from
  the app, are the same kind of file.

## Acceptance criteria

1. The sidebar's type list is the union of the types declared by Type documents and
   the types carried by notes; a declared type with no notes appears with a count of
   zero. A Type document with no H1 declares nothing and is skipped silently, so no
   empty-named type can reach the list.
   Names that differ only in case are the same type: `note`, `Note` and `NOTE` are
   one entry, holding every one of their notes, counted together and labelled once
   (criterion 15).
2. Types are ordered by their `order:` ascending where present, before types without
   one; ties and the remainder are ordered alphabetically. `order:` is read from
   `order` or, failing that, `_order`, matching how `icon` and `color` already accept
   their underscore-prefixed aliases; the panel always writes the un-prefixed key.
3. A create action in the sidebar's Types group opens a panel with fields for name,
   description, icon, colour, and order, all empty or defaulted.
4. Creating writes a new Markdown file at the vault root, named as the kebab-case of
   the type name and made unique on collision, containing `type: Type`, `icon`,
   `color`, and `order` frontmatter, plus `_organized: true` for Tolaria
   compatibility; the body is the H1 name followed by the description.
5. Selecting an existing type opens the same panel prefilled from its document. A
   type that only exists because notes carry it has no document to prefill from: the
   panel opens with its name filled and the rest defaulted, and saving creates the
   document under criterion 4 rather than editing one.
6. Saving an edit to an existing Type document changes only the lines it owns; any
   other frontmatter key present in the file is preserved verbatim.
7. Changing the name rewrites the Type document's H1, renames its file to the
   kebab-case of the new name **within the directory the document already lives in**,
   and rewrites `type: <old>` to `type: <new>` in every note carrying it — all in a
   single commit. The rename is expressed on the commit path as the removal of the
   old path and the creation of the new one in the same tree; a document the owner
   moved out of the vault root stays where they put it.
8. A name that matches the name of an existing Type **document** is rejected before
   commit, and the panel says why. The test is against declared types only: a name
   that notes already carry with no Type document behind it is accepted, and the
   create gives that in-use type its document — which is the point, not a collision.
   The type stops being counted twice in the list of criterion 1 and simply becomes
   declared. Comparison is case-insensitive and ignores surrounding whitespace, so
   the two paths cannot produce two documents for what the sidebar shows as one type.
9. Delete is available only when no note carries the type; otherwise it is disabled
   and shows the number of notes that use it. Notes are never reassigned.
10. Deleting removes the Type document from the vault via the existing delete path.
11. The icon field offers the whole lucide catalogue, searchable by name, and each
    entry's preview is rendered through the same `Icon` component the sidebar uses.
    A name the local set intercepts therefore previews the glyph the app will
    actually paint, not the lucide one, without the catalogue being narrowed.
12. Type documents remain excluded from All notes, Inbox, Shared, and views, exactly
    as they are today.
13. After a create, rename, or delete is committed, the sidebar reflects the change
    without waiting for the next build. The type list, the per-type metadata, and the
    note lists are derived from the bundled content composed with the app's local
    overlay of created, modified, and deleted notes — not from the bundle alone — and
    the overlay self-heals against each new build as it does today.
14. A rename records the notes it rewrote in that overlay, so their new `type:` is
    what the app reads until a build supersedes it.
15. Type names are matched case-insensitively everywhere the app reads them: the
    list, the counts, the note filter, the icon and colour lookup, and the
    uniqueness check. The label shown is the Type document's name, verbatim,
    including a deliberate capitalisation like `iPhone`; a type no document declares
    is labelled in title case, so `note`, `NOTE` and any mixture read as `Note`
    regardless of which spelling the notes happen to favour. The notes' own files
    are never rewritten to match — this is a rule about reading the vault, not about
    changing it — and saving the displayed label back onto an undeclared type is an
    adoption, not a rename, so it leaves those notes untouched.

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

None. The one question this ADR carried — whether to drop the app's local icon set
so every icon resolved through lucide — is resolved in favour of keeping the set:
part of it has no lucide equivalent, so the precedence would not disappear anyway,
and replacing the rest would restyle the app's chrome everywhere as a side effect of
a type-management feature. The collision it was meant to address is answered by
criterion 11 instead, in the preview rather than in the catalogue. Dropping the local
set remains available as its own decision if the visual argument is ever made on its
own terms.

## References

- src/lib/types.js — the derivation: union, case folding, ordering, uniqueness
- src/lib/typeCommit.js — the commit payloads for create, rename and delete
- src/components/TypePanel.jsx, src/components/IconPicker.jsx — the panel itself
- src/lib/typeMetaContext.jsx — live type metadata for components off the path
- src/content.js, src/components/Sidebar.jsx, src/components/Icon.jsx
- functions/commit.js — the line-level frontmatter, retype and H1 operations
- src/lib/localNotes.js, src/lib/deleted.js — the overlay stores criteria 13–14 build on
- scripts/type-icons.mjs — build-time bundling of the icons Type documents name
- src/lib/noteFile.js, src/lib/drafts.js
- adr/0019-atomic-commit-git-data-api.md
- adr/0021-draft-state-optimistic-ui.md
- adr/0022-frontmatter-preserved-line-ops.md
- adr/0023-note-create-delete.md
- adr/0011-read-only-properties-panel.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-08-06 | r1 | marco | Initial draft. |
| 2026-08-10 | r2 | marco | Resolved the icon-set question in favour of keeping the local set, with the preview rendered through `Icon` (criterion 11). Scoped the rename to the document's own directory (criterion 7). Grounded criterion 13 in a bundle-plus-overlay derivation and added criterion 14 for renamed notes. Accepted `_order` as an alias and recorded the sidebar re-ordering as an intended consequence (criterion 2). Skipped Type documents with no H1 (criterion 1). Narrowed the uniqueness test to declared types, so creating adopts a type the notes already carry (criteria 5, 8). Made type names case-insensitive throughout, so spellings that differ only in case are one type, labelled by the Type document's name or, failing that, in title case (criterion 15). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
