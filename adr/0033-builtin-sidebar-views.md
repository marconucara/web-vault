---
adr: 0033
title: Built-in vault-independent sidebar views — All notes, Inbox, Shared
status: Proposed
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0009]
tags: [views, ui, sidebar, navigation]
---

# ADR 0033 — Built-in vault-independent sidebar views — All notes, Inbox, Shared

## Context

The sidebar (`adr/0009-three-panel-ui-note-list.md`) currently shows a built-in
"All notes" entry mixed into the same group as the vault's own saved views
(`adr/0007-tolaria-views-evaluator.md`, `adr/0032-dual-format-views-base-yml.md`),
followed by type filters. Some views are useful on **every** vault and should not
require the vault to ship a view file: an inbox of not-yet-organized notes, and
the set of shared notes.

Tolaria marks a note organized with `_organized: true`; absence or `false` means
not organized. Verified against the reference vault: of 556 notes, 82 carry
`_organized: true`, **none** carry `false`, and the rest omit the key — so
"organized" is exactly `_organized == true` and everything else is the inbox.
Notes created by web-vault write no `_organized`
(`adr/0023-note-create-delete.md`), so a new note starts in the inbox. Sharing
(`adr/0024-share-unshare-from-app.md`, `adr/0025-public-share-pages.md`) marks a
note with a `share_id`.

## Capability statement

The sidebar presents a fixed, client-defined section at the top — independent of
vault contents — holding three built-in views: **All notes** (no filter), **Inbox**
(notes not organized, i.e. `_organized` is not `true`), and **Shared** (notes with
a non-empty `share_id`). A separator divides this section from the vault's own
saved views below. The built-in views own reserved stems: a vault saved view whose
stem matches a built-in name (`all-notes`, `inbox`, `shared`) is suppressed so the
view is not duplicated. All three are shown unconditionally and in a fixed order.

## User stories / scenarios

- As a user of any vault, I always have an Inbox and a Shared view without my vault
  having to define them.
- As a user whose vault ships its own `shared` view, it appears once (the built-in),
  not duplicated.
- As a user, a note I just created shows in Inbox until I organize it (set
  `_organized: true`).

## Acceptance criteria

1. The sidebar renders a fixed top section, visually separated from the vault's
   saved views, containing exactly three built-in views in this order: All notes,
   Inbox, Shared — regardless of vault contents.
2. All notes applies no filter; Inbox selects notes where `_organized` is not
   `true` (absent or `false`); Shared selects notes with a non-empty `share_id`.
3. A vault-defined saved view whose stem is a reserved built-in name (`all-notes`,
   `inbox`, `shared`) is not listed among the vault's saved views — the built-in
   supersedes it.
4. Each built-in view shows a note count consistent with the other sidebar entries.
5. Built-in membership and order are fixed in this version; there is no client
   control to hide or reorder them.

## Out of scope

- Hiding, reordering, or otherwise configuring built-in views — deferred to the
  client-side settings capability (`adr/0034-client-settings-modal.md`). In
  particular, the "show Inbox" toggle lives there.
- Changing note creation to write `_organized`; created notes stay unorganized by
  design (`adr/0023-note-create-delete.md`).
- Authoring or editing views from the client.
- Detecting whether a vault "uses" the `_organized` convention in order to hide
  Inbox conditionally — no reliable signal exists (zero organized notes cannot be
  distinguished from "nothing organized yet", e.g. a freshly started vault).

## Open questions

- Inbox is shown **unconditionally** for now. On a vault that does not use
  `_organized`, Inbox duplicates All notes, and its always-on presence risks a new
  user not discovering the organize convention. This is accepted as **provisional**:
  the client-side settings capability (`adr/0034-client-settings-modal.md`) adds a
  "show Inbox" toggle and is the intended home for such preferences. Revisit this
  ADR's unconditional rule when that capability lands.

## References

- src/components/Sidebar.jsx, src/lib/views.js
- adr/0009-three-panel-ui-note-list.md
- adr/0034-client-settings-modal.md
- adr/0007-tolaria-views-evaluator.md
- adr/0032-dual-format-views-base-yml.md
- adr/0023-note-create-delete.md
- adr/0024-share-unshare-from-app.md
- adr/0025-public-share-pages.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
