# Type visibility — hide a type from the sidebar

**Owning ADR(s):** `adr/0046-type-visibility.md`

## Context

`Type` — the meta-type every type document carries — now shows as a sidebar row
that can never be populated. `contentOnly` (`src/lib/types.js:158`) excludes
notes carrying `type: Type` from every list, so selecting the row shows an empty
list by construction, not for want of notes.

It appeared when `adr/0045` made the type list the union of declared and used
types. Before that the list came from usage alone and `usedTypes` skips type
documents, so `Type` never surfaced.

Tolaria hides it with `visible: false` in the type document, which web-vault
does not read: `visible` appears nowhere in `src/`. `marconucaravault/_types/type.md`
already carries the key, so that vault fixes itself the moment we honour it.

The format was established against a live Tolaria, and the method matters —
Tolaria does not re-read a type document's frontmatter without a restart, and an
unindexed note is invisible for that reason alone. Both produced false readings
before the rules below settled. See `adr/0046-*.md` for the full table.

## Scope

**Reading it.** `typeDocMeta` (`src/lib/types.js:30`) gains `visible`, and
`deriveTypes` filters the sidebar list by it. Only the unprefixed key —
`_visible` is deliberately *not* an alias, unlike `icon`/`color`/`order`,
because Tolaria writes only the bare form.

The filter belongs in what the sidebar renders, **not** in `deriveTypes`'
returned set wholesale: the manager needs every type including the hidden ones,
and `typeMeta` must keep carrying a hidden type's icon and colour for the
manager row to render. Expect `deriveTypes` to expose visibility in `meta` and
the sidebar to do the filtering, rather than a second derivation.

**The manager.** A new component opened from a control in the sidebar's Types
group heading, before the `+` (`src/components/Sidebar.jsx:55-62`). One row per
type in sidebar order, icon and name, a toggle at the right. Visibility only —
no rename, colour, order or delete.

**Writing it.** A toggle is one commit. Hiding writes `visible: false` through
the line-level frontmatter path (`adr/0022`), preserving unowned keys; showing
**removes** the key rather than writing `visible: true`, so a file that never
had it ends byte-identical. `filesForEdit` (`src/lib/typeCommit.js:76`) already
expresses key removal as `null`, which is the mechanism to reuse — but note it
currently rewrites `h1` and `body` too, which a visibility toggle must not do.
Either a narrower payload builder or a flag on that one.

`typeDocContent` (`typeCommit.js:28`) needs `visible` for the create path below.

**Adopting an undeclared type.** Toggling a type no document declares creates
the document first, under `adr/0045` criterion 4, then applies the visibility —
same adoption the panel already does when editing an in-use type.

**Optimistic update.** The toggle reflects before the next build through the
existing overlay (`src/lib/localNotes.js`), like the rest of type management.

## Out of scope

- Hiding individual notes. `visible` on an ordinary note is ignored by Tolaria
  and stays ignored here (verified after a restart).
- Hiding a hidden type's notes — they stay in All notes, views, counts, search.
- Making type documents readable as notes; `contentOnly` is untouched.
- A visibility checkbox in the type panel. Deliberately rejected: it would put
  the control that removes a row inside the row's only route. See `adr/0046-*.md`.

## Exit criteria

Mapped to `adr/0046-*.md` acceptance criteria.

1. A type document with `visible: false` does not appear in the sidebar; its
   notes stay in All notes, views, counts and search. *(AC 1)*
2. `_visible: false` has no effect — pinned by a test, since it reads as an
   oversight otherwise. *(AC 2)*
3. Key absent, `true`, or any other value renders the type visible. *(AC 3)*
4. A control in the Types heading, before the create action, opens a manager
   listing every type including hidden ones, in sidebar order, each with icon,
   name and a toggle. *(AC 4, 5)*
5. Toggling commits once and updates the sidebar before the next build. *(AC 6)*
6. Hiding preserves every other frontmatter key; showing removes `visible`
   rather than writing `visible: true`; a toggle does not rewrite the H1 or the
   body. *(AC 7)*
7. Toggling a type with no document creates one, then applies visibility. *(AC 8)*
8. `Type` behaves as an ordinary row in the manager. *(AC 9)*
9. A vault with no `visible` key anywhere renders as it does today and is not
   written to until a toggle is used. *(AC 10)*
10. The manager shows no note counts. *(AC 11)*
11. Hiding the type whose note list is open leaves that list open and unchanged;
    only the sidebar row goes. *(AC 12)*
12. `yarn verify` green.
13. Verified by hand in the running app, against both `../marconucaravault`
    (which already carries the key) and `../Getting Started` (which does not),
    before the change is committed.

## Dependencies

None. `plan/todo/` is otherwise empty.

---

## Outcome

Went in as scoped. Four things are worth recording, three of them found in the
code rather than in the plan.

**The commit endpoint had to learn the key.** `SETTABLE_KEYS` in
`functions/commit.js` is a closed allowlist, so `visible` was rejected until it
was added — the plan had traced the client payload and stopped at the boundary.
`_visible` is deliberately absent from it as well: nothing in the app writes it.

**`filesForVisibility` is its own builder**, as the plan anticipated.
`filesForEdit` rewrites the H1 and the body — legitimate, since the panel owns
both — and a toggle owns one key. A test asserts the payload carries no `h1`,
`body` or `content`, and another asserts hide-then-show returns the file
byte-identical.

**The typedef blocked the boolean.** `CommitFile.frontmatter` was typed
`string | number | null`, so `visible: false` failed the typecheck. Widened to
include booleans. Worth noting because the validator and `setFrontmatterKey`
both handled `false` correctly already; only the annotation was behind.

**Two UI details found by looking, not by reasoning.** The Types heading uses
`justify-content: space-between`, which spreads *all* children: a second action
put the new control in the middle of the row instead of beside the `+`. Both
buttons now sit in one `.group-actions` box. And the icon went through a round
of candidates — an eye at 14px is nearly all fill and reads as a mark rather
than a control, so the manager uses `toggle-left`, the switch its own rows
carry. Four candidates were tried in a scratch comparison page and removed
again; only `toggle-left` and `eye` (the panel header) remain in the local set.

Both open questions in `adr/0046-*.md` were settled before implementation and
are now criteria 11 and 12.

29 new tests across `src/lib/types.test.js`, `src/lib/typeCommit.test.js`,
`functions/commit.test.js` and the new `src/components/typeVisibility.test.jsx`.
396 total, `yarn verify` green.
