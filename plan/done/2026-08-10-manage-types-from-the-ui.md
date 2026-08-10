# Manage note types from the UI

**Owning ADR(s):** `adr/0045-manage-types-from-the-ui.md`
**Dependencies:** `adr/0019-atomic-commit-git-data-api.md`,
`adr/0022-frontmatter-preserved-line-ops.md`, `adr/0023-note-create-delete.md`

## Context

`0045` is Proposed with no open questions left: the icon set keeps its local
layer and the picker previews through `Icon` (criterion 11), a rename keeps the
document in its own directory (criterion 7), the type list derives from a
bundle-plus-overlay composition (criteria 13–14), and creating adopts a type the
notes already carry rather than rejecting it (criteria 5, 8).

Four things in the current code decide the shape of the work:

- **`types` and `typeMeta` are module-level constants** in `src/content.js`,
  computed once from the bundled `content.json`. `App.jsx` already composes
  `liveNotes` as *bundle − deleted + created*, so the composition exists; the
  type derivation just does not use it.
- **The overlay stores are per-note and keyed differently**: `created.js` holds
  whole note objects by id, `deleted.js` holds paths. A rename produces neither —
  it modifies existing notes — so criterion 14 needs the created store to accept
  modified notes too.
- **Line-level frontmatter edits live server-side**, in `functions/commit.js`,
  behind a closed vocabulary (`body`, `shareId`, `unshare`, `delete`, `isNew`)
  applied by `applyOps`. Criteria 6 and 7 need new operations there; the client
  cannot express them today.
- **A rename is not a commit primitive.** `0019` has create/update/delete only,
  so renaming is delete-old + create-new in the same tree, which the endpoint
  already composes atomically.

## Scope

1. **Derivation.** Move `types`/`typeMeta` off the static module onto a
   derivation over the live note set, including Type documents from the overlay.
   Union of declared and in-use types, `order`/`_order` sorting, Type documents
   with no H1 skipped (criteria 1, 2).
2. **Overlay.** Let the optimistic store carry modified notes, not only created
   ones, so a rename is visible before the next build (criteria 13, 14).
   Renaming the store is optional; the semantics are not.
3. **Commit operations.** Add the frontmatter operations criteria 6–7 need to
   `functions/commit.js`, in the same line-level style as `ensureShareId` —
   setting/removing a scalar key, and rewriting a `type:` value — with unit
   tests alongside the existing ones.
4. **Panel.** The create/edit form: name, description, icon, colour, order
   (criteria 3, 4, 5, 6). Icon picker over the full lucide catalogue, previewed
   through `Icon` (criterion 11).
5. **Rename.** H1 + filename within the document's directory + `type:` fan-out
   across carrying notes, one commit (criterion 7).
6. **Delete.** Blocked while notes carry the type, with the count shown
   (criteria 9, 10).
7. **Sidebar.** Create affordance in the Types group, ordering, counts including
   declared-but-unused types at zero (criteria 1, 2, 3).

## Out of scope

- Everything `0045` lists under Out of scope (reassigning notes on delete,
  single-note type changes, non-root placement on create, unknown frontmatter
  keys, view changes).
- The chunk-per-icon problem. `plan/todo/0006-prune-the-dynamic-icon-chunk-map.md`
  owns it and was waiting on this decision: the picker offers the whole lucide
  catalogue, so `DynamicIcon` stays and that item takes its `manualChunks`
  branch. Note the resolution there; do not fix it here.

## Exit criteria

1. Every acceptance criterion of `0045` (1–14) holds, verified by tests where the
   behaviour is testable without a live vault.
2. The type derivation, the ordering, and the new frontmatter operations have
   unit tests; the gate stays runnable from a bare clone with no external vault.
3. A declared type with no notes appears in the sidebar at zero; a type only the
   notes carry can be created and gains a document without touching the notes.
4. `yarn verify` green.
5. Manually exercised against a real vault before the commit lands.

## Notes

Marco tests manually before anything is committed; the verify gate is necessary
but not sufficient here, since most of this is UI over a real vault.

---

Shipped at HEAD `4317d66`. Not tagged: `v0.9.0` remains the current release.

Landed beyond the plan as written: type names are now matched case-insensitively
everywhere (ADR criterion 15). The exact-match derivation predated this work but
contradicted the new uniqueness check, and left a vault showing `note`, `Note`
and `NOTE` as three sidebar rows splitting one type's notes between them.

`plan/todo/0006` is unblocked by this item rather than done by it: the picker
offers the whole lucide catalogue, so `DynamicIcon` stays and the remaining fix
is `manualChunks`. A build still emits ~1,750 single-icon chunks.
