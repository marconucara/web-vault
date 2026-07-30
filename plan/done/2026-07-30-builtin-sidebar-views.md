# Built-in vault-independent sidebar views

Owning ADR: `adr/0033-builtin-sidebar-views.md`.

Scope: add a fixed top section to the sidebar with three client-defined,
vault-independent views — All notes, Inbox (`_organized != true`), and Shared
(`share_id` present) — separated from the vault's own saved views. Deduplicate
reserved stems (`all-notes`/`inbox`/`shared`) so a same-named vault view is
superseded by the built-in. Inbox shown unconditionally (provisional; the
show-Inbox toggle is deferred to `adr/0034-client-settings-modal.md`).

Exit criteria (mapped to the ADR's acceptance criteria):

1. Fixed top "Views" section with All notes, Inbox, Shared in order, a separator,
   then the vault's saved views. (AC 1)
2. Inbox = notes where `_organized` is not `true`; Shared = notes with a non-empty
   `share_id`; All notes = no filter. (AC 2)
3. A vault saved view whose stem is a reserved built-in name is not listed among
   the vault views. (AC 3)
4. Each built-in shows a note count; membership/order fixed, no client control. (AC 4, 5)

Implementation: `src/lib/builtins.js` (predicates + `RESERVED_VIEW_IDS`),
`src/App.jsx` (dedup `vaultViews`, inbox/shared counts and lists), and
`src/components/Sidebar.jsx` + `.nav-sep` in `src/styles.css`.

Shipped 2026-07-30 on `main`. Verify gate green: `wv build` from the reference
vault (marconucaravault) succeeded and a manual `wv dev` smoke confirmed the
built-in views, counts (All 82 / Inbox 5 / Shared 8), and the reserved-stem
dedup (the vault's own `shared` view suppressed). 0033 advanced Proposed →
Implemented.
