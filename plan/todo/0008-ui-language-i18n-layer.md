# UI language — i18n layer, locale detection, and the override seam

**Owning ADR(s):** `adr/0047-ui-language-i18n-layer.md`

## Context

Every user-visible string the shell renders is an English literal at the point of
render — 33 in `title` / `aria-label` / `placeholder` attributes alone, plus the
JSX text nodes across `src/App.jsx` and the 15 non-test components. There is no
seam where a translation could enter, so the work is one sweep plus the machinery
behind it.

Two neighbours constrain the shape:

- `adr/0034-client-settings-modal.md` owns the settings surface, both selectors,
  and the `localStorage` behind them. This item must **not** touch storage
  (`adr/0047` criterion 8). What it delivers is the seam 0034 writes through:
  an injectable boot locale and a runtime setter.
- `adr/0041-automated-quality-gate-typecheck-and-tests.md` owns `yarn verify`
  (`yarn typecheck && yarn test`). The catalogue parity check rides in as a
  Vitest test, which keeps the gate self-contained — it reads only
  `src/locales/*.json`.

Three places already format dates, each with its own hardcoded answer:
`NoteList.jsx:6` (`Intl.DateTimeFormat('en-GB', …)`), `PropertiesPanel.jsx:30`
(`toLocaleDateString('en-GB', …)`), and `VersionIndicator.jsx:41-43`
(`toLocaleTimeString(undefined, …)`, i.e. the system locale). Criteria 10–11 make
these follow one resolved formatting locale. **See the open decision below: with
language-only codes, `en` formats US-style and the two `en-GB` call sites would
visibly regress (`11 Aug 2026` → `Aug 11, 2026`).**

## Scope

**The layer.** `i18next` + `react-i18next`, initialised once in a new
`src/lib/i18n.js`, wired at the root in `src/main.jsx`. Catalogues are
`src/locales/en.json` and `src/locales/it.json`, statically imported so Vite
bundles them — no runtime fetch, no HTTP backend plugin, no language-detector
plugin (detection is ~10 lines against `navigator.languages` and we own the
precedence rules, so the plugin is more surface than help).

**Resolution** (`adr/0047` criteria 4–6), a pure function so it is testable
without a browser: an injected locale wins if supported; else the first supported
language among `navigator.languages` in the browser's order; else `en`. Region
subtags are stripped before matching. An injected but unsupported value is
ignored and falls through — it does not short-circuit to `en`.

**The seam** (criterion 8, and what 0034 consumes): `initI18n({ locale,
formatLocale })` for the boot values and `setLocale()` / `setFormatLocale()` for
runtime changes. Nothing reads or writes `localStorage`; a runtime change does
not survive a reload until 0034 supplies it at boot.

**Missing keys** (criterion 9): `parseMissingKeyHandler` returns the key itself,
so the gap is visible, plus a `console.warn` gated on `import.meta.env.DEV`.
Explicitly **not** `fallbackLng` to `en` — a silent English fallback makes a
partial catalogue look finished, which is the whole point of the choice.

**The sweep.** Replace literals with `t()` calls across `src/App.jsx` and the
non-test components — including the `title`, `aria-label` and `placeholder`
attributes, which are the easy ones to miss because they carry no JSX text node.
The built-in view names in `Sidebar.jsx:25,33,41` (All notes, Inbox, Shared) are
shell strings and **are** translated; `Sidebar.jsx:52,87` render vault-derived
view and type names and are **not**.

**Formatting** (criteria 10–11): the three call sites above read the resolved
formatting locale instead of their own hardcoded one.

**The gate check** (criterion 12): a Vitest test comparing the flattened key set
of each locale against `en`, failing with the missing/extra keys named.

## Out of scope

- The selectors and their persistence — `adr/0034-*.md`.
- Separate date/time format settings; two locales, formats derived by `Intl`.
- Share pages (`adr/0025-*.md`) and the 404 page (`adr/0027-*.md`) — they render
  at build time and stay English.
- Vault-derived text: note bodies, titles, type names, view names, folder names.
- Server-side strings in `functions/`.
- RTL layout and locale-specific typography.

## Exit criteria

Mapped to `adr/0047-*.md` acceptance criteria.

1. No user-visible string in the shell is an inlined literal at the point of
   render, attributes included. *(AC 1)*
2. `src/locales/en.json` and `src/locales/it.json` are statically imported and
   present in the built bundle; no catalogue is fetched at runtime. *(AC 2, 3)*
3. `it-CH` resolves to `it`, `en-GB` to `en` — pinned by tests. *(AC 4)*
4. Resolution order injected → browser → `en`, and an unsupported injected value
   falls through to the browser rather than to `en` — both pinned by tests.
   *(AC 5, 6)*
5. `setLocale()` re-renders the interface without a reload. *(AC 7)*
6. A test asserts the layer reads and writes no `localStorage` key. *(AC 8)*
7. A key absent from `it.json` renders as the key, not the English string; the
   warning fires only in dev. *(AC 9)*
8. The three date/time call sites follow the resolved formatting locale, and
   `setFormatLocale()` changes them independently of the interface language.
   *(AC 10, 11)*
9. A locale missing a key that `en` has fails `yarn verify` with that key named.
   *(AC 12)*
10. `yarn verify` green.
11. Verified by hand in the running app with the browser set to Italian, then to
    an unsupported language, before the change is committed.

## Open decisions — resolve before implementing

1. **What drives `Intl`.** Language-only matching (AC 4) is right for choosing a
   catalogue but lossy for formatting: `en` formats US-style, so the two `en-GB`
   call sites regress. Candidate: the *interface* locale is matched
   language-only, while the *default formatting* locale is the browser's full
   tag (`navigator.language`, region intact), with the explicit
   `setFormatLocale()` override on top. This keeps today's output for a UK
   browser and needs AC 10 reworded.
2. **Key naming.** A convention is needed before the sweep, since renaming keys
   afterwards touches every call site. Candidate: flat dotted keys namespaced by
   component/feature (`sidebar.allNotes`, `noteList.searchPlaceholder`,
   `statusBar.commitMessage`).
3. **Non-English content in the repo.** `src/locales/it.json` is a new class of
   file: `CONVENTIONS.md`'s language mandate carves out only vault notes, though
   it does name i18n message files as a separate layer that the mandate does not
   govern. Worth an explicit carve-out sentence so the audit does not read
   `it.json` as a violation.

## Dependencies

None blocking. `plan/todo/` is otherwise empty. Ordering note: this should land
**before** `adr/0034-*.md`'s settings modal, so the selectors find the seam
already in place.
