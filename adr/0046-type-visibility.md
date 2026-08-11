---
adr: 0046
title: Hide a type from the sidebar — visibility as its own surface
status: Implemented
date: 2026-08-11
owner: marco
supersedes:
superseded-by:
depends-on: [0045, 0019, 0022]
tags: [types, ui, sidebar, vault, compatibility]
---

# ADR 0046 — Hide a type from the sidebar — visibility as its own surface

## Context

A vault accumulates types that earn a place in the file but not in the sidebar.
The clearest case is `Type` itself: the meta-type that gives type documents a
type of their own. Every type document carries `type: Type`, so the name exists
and is declared, but it names a category the reader never navigates to.

Deriving the type list from declaration as well as usage
(`adr/0045-manage-types-from-the-ui.md`, criterion 1) made this visible. Before
that change the list came from usage alone, and `Type` never appeared because
`usedTypes` skips type documents. After it, a vault whose `type.md` carries an
H1 declares `Type`, and a row appears for it.

That row cannot lead anywhere. Every list in the app is built on `contentOnly`,
which excludes notes carrying `type: Type`, so the type's own notes — the type
documents — are filtered out upstream of any view. Selecting the row shows an
empty list, and always will. It is not a type with no notes yet; it is a type
whose notes are structurally unreachable.

Tolaria has the same meta-type and does not have this problem, because it
supports hiding a type. The vaults show both halves of the answer:
`marconucaravault/_types/type.md` carries `visible: false` and its row is
absent from Tolaria's sidebar, while `Getting Started` has no such key anywhere
and shows `Type` as an ordinary, populated row. web-vault reads no such key —
`visible` appears nowhere in `src/`.

### What the format actually is

The rules were established against a live Tolaria, and two early readings were
wrong in ways worth recording, because both would have produced a wrong ADR:

- **Tolaria does not re-read a type document's frontmatter while running.** A
  change on disk takes effect at the next restart. Three tests run against a
  refresh alone therefore proved nothing, and were discarded.
- **A note that has never been indexed is invisible for that reason alone.** A
  probe note created from outside a running Tolaria did not appear, which reads
  identically to being hidden. Every subsequent test started from something
  already visible, so that "it disappeared" could only mean one thing.

What survived that method:

| Question | Answer | How it was established |
|---|---|---|
| Does `visible: false` hide a **type**? | Yes | `Type` absent with the key, present without it, across restarts |
| Does it hide an ordinary **note**? | No | `walkthroughs.md` stayed visible with the key, after a restart |
| Is the key `visible` or `_visible`? | `visible` | Tolaria writes it itself; `_visible` had no effect |
| Does a hidden type hide its notes? | No | A hidden `Project` keeps its notes in All Notes |
| Default when the key is absent | Visible | Every type in `Getting Started` |

So `visible` is type metadata and nothing more. It governs one row in one list.
It is not a general privacy or exclusion mechanism: it hides neither notes nor
the notes of the type it hides, and this ADR does not make it one.

### Why the edit panel is the wrong home for it

The obvious placement — a checkbox in the type panel, beside icon, colour and
order — is a trap, and Tolaria's own UI shows the way out.

Those three describe what a type *is*. Visibility describes what the reader sees
of the sidebar. Putting the switch inside the panel makes the sidebar row the
only route to the control that removes that row: hide a type and it becomes
uneditable from the app, recoverable only by opening the file by hand. For
`Type` this never bites, since nobody edits it twice. For any real type it does.

There is a second, quieter cost. When hiding is the only affordance, a hidden
type is absent *and* the fact that it exists is absent. The reader cannot tell
what they are not seeing.

A dedicated surface dissolves both. Tolaria puts it next to the Types heading,
before the create action: a menu listing **every** type, hidden ones included,
each with a toggle. It is reachable no matter what is hidden, because it does
not live in the list it filters. And it makes hidden a state you read rather
than an absence you must remember.

## Capability statement

A reader can hide a type from the sidebar and bring it back, from a dedicated
visibility surface that lists every type in the vault regardless of its current
state. Visibility is stored in the type document as `visible: false`, the key
Tolaria reads and writes, so a vault hidden in one app is hidden in the other.
Hiding a type removes only its sidebar row: its notes stay in every list, view,
count and search where they already appear.

## User stories / scenarios

- As a vault owner, I never want to see `Type` in my sidebar, because it names a
  category I never browse — and in this app it cannot show anything at all.
- As a vault owner with a type I have stopped using, I want it out of the
  sidebar without deleting the document or retyping its notes.
- As someone who hid a type last month, I want to find it again and bring it
  back, without knowing which file to open.
- As someone using both apps on one vault, I want a type I hid in Tolaria to be
  hidden here too, with no migration and no second source of truth.

## Acceptance criteria

1. A type document whose frontmatter carries `visible: false` is omitted from
   the sidebar's type list. Its notes are unaffected: they continue to appear in
   All Notes, in views, in search, and in every count, exactly as before.
2. The key is `visible`, unprefixed. `_visible` is **not** an alias and is
   ignored — unlike `icon`, `color` and `order`, which accept the underscore
   form (`adr/0045`, criterion 2), because Tolaria writes and reads only the
   unprefixed spelling here and honouring a second one would produce a file that
   behaves differently in the two apps.
3. Any value other than `false` — the key absent, `true`, or anything else —
   means visible. Absence is the default and is never written to express it.
4. A visibility manager opens from a control in the sidebar's Types group
   heading, placed before the create action. It lists every type in the vault,
   hidden ones included, in the sidebar's own order (`adr/0045`, criterion 2),
   each row showing the type's icon and name with a toggle for its visibility.
5. The manager governs visibility only. Renaming, icon, colour, order,
   description and delete stay in the type panel (`adr/0045`, criteria 3–9).
6. Toggling takes effect immediately: one commit per toggle, and the sidebar
   reflects it before the next build, through the same overlay as the rest of
   type management (`adr/0045`, criteria 13–14).
7. Hiding writes `visible: false` into the type document, preserving every other
   key (`adr/0022`). Showing **removes** the key rather than writing
   `visible: true`, so a file that never carried it is left byte-identical to
   how it started.
8. Toggling a type that no document declares — one that exists only because
   notes carry it — creates its type document first, under the rules of
   `adr/0045` criterion 4, and applies the visibility to it. This matches how the
   panel adopts an in-use type when edited.
9. `Type` is an ordinary row in the manager, with no special case. It is hidden
   when its document says so and visible when it does not, exactly like any
   other type.
10. A vault whose type documents carry no `visible` key renders exactly as it
    does today, and nothing is written to it until a toggle is used.
11. The manager shows no note counts. Its rows answer one question — shown or
    hidden — and a count invites the different question of whether hiding is
    wise, which belongs to the type panel where the notes are already accounted
    for (`adr/0045`, criterion 9).
12. Hiding the type whose list is currently open leaves that list open and
    unchanged; the sidebar simply loses the row. The reader's position is not a
    consequence of tidying the sidebar, and the next navigation resolves it. The
    type panel cannot be open at the same time — it holds a modal backdrop, so
    the manager is unreachable while it is up — so the only selection at stake is
    the one behind the note list.

## Out of scope

- **Hiding individual notes.** `visible` on an ordinary note is ignored by
  Tolaria and stays ignored here. A mechanism for hiding notes would be a
  separate decision with a separate key.
- **Hiding a type's notes along with it.** Verified against Tolaria: a hidden
  type keeps its notes in All Notes. Visibility is one sidebar row, not a filter.
- **Making type documents readable as notes.** They remain excluded from every
  list by `contentOnly`. This is why the `Type` row could never be populated
  here, and it is what makes hiding it the right answer rather than a workaround.
  Should type documents ever become navigable content, that is its own ADR and
  it would change what a visible `Type` row means — not what this one decides.
- **Per-reader visibility.** The state lives in the vault file and is therefore
  shared by everyone who opens it, in either app. A per-device preference is a
  different decision.
- **Hiding built-in sidebar sections** (Inbox, All notes, Shared) or views.

## Open questions

None outstanding. Two were settled while drafting and are recorded as criteria
11 and 12: the manager carries no note counts, and hiding the selected type
leaves the open list alone.

## References

- adr/0045-manage-types-from-the-ui.md — the type panel, the derivation this
  filters, and the overlay that makes a toggle visible before the next build
- adr/0022-frontmatter-preserved-line-ops.md — preserving unowned keys on write
- adr/0019-atomic-commit-git-data-api.md — the commit path a toggle rides
- src/lib/types.js — `deriveTypes`, `typeDocMeta`, `contentOnly`
- src/components/Sidebar.jsx — the Types group heading and its actions
- src/components/TypePanel.jsx, src/lib/typeCommit.js — where visibility is
  deliberately *not* placed, and the commit payloads a toggle reuses

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-08-11 | r1 | marco | Initial draft. |
| 2026-08-11 | r2 | marco | Settled the two open questions as criteria 11 (no note counts) and 12 (hiding the selected type leaves its list open). Implemented. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
