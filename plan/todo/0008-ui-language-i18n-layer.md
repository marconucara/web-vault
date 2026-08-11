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
these follow one resolved formatting locale — which is **not** the interface
locale, for the reason recorded in `adr/0047` r3: a bare `en` formats US-style,
so driving them from the language-only code would have regressed a UK reader from
`11 Aug 2026` to `Aug 11, 2026`.

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

**Formatting** (criteria 10–11): a second resolution, region intact — override if
supplied, else `navigator.language` **with its region**, else the interface
locale. The three call sites above read it instead of their own hardcoded tag. It
is not restricted to the two shipped languages, and a tag the platform rejects
falls back rather than throwing (`Intl` throws `RangeError` on a malformed tag,
so the resolution validates before handing it over).

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
8. The three date/time call sites follow the resolved formatting locale;
   `setFormatLocale()` changes them independently of the interface language; and
   a test pins that an `en-GB` browser still formats `11 Aug 2026` — the
   regression this decision exists to prevent. A malformed tag falls back
   instead of throwing. *(AC 10, 11)*
9. A locale missing a key that `en` has fails `yarn verify` with that key named.
   *(AC 12)*
10. `yarn verify` green.
11. Verified by hand in the running app with the browser set to Italian, then to
    an unsupported language, before the change is committed.

## Decisions taken before implementing

All three were open when this item was queued; settled 2026-08-11.

1. **What drives `Intl`: a separate resolution that keeps the region.** The
   interface locale is matched language-only; the formatting locale defaults to
   the browser's full tag (`navigator.language`), with `setFormatLocale()` on
   top. Chosen over deriving formatting from the interface language, which is
   the lossy direction and would have shipped a regression inside a
   localisation feature. Recorded in `adr/0047` criteria 10–11 (r3).
2. **Key naming: flat dotted keys namespaced by component/feature** —
   `sidebar.allNotes`, `noteList.searchPlaceholder`, `statusBar.commitMessage`.
   Settled before the sweep because renaming afterwards touches every call site.
3. **Non-English catalogues are an explicit carve-out** in the language mandate
   (`CONVENTIONS.md`, mirrored in `AGENTS.md`), so `src/locales/it.json` does not
   read as a violation. Landed with this item.

## Dependencies

None blocking. `plan/todo/` is otherwise empty. Ordering note: this should land
**before** `adr/0034-*.md`'s settings modal, so the selectors find the seam
already in place.

---

## Outcome

Implemented as scoped. Six things are worth recording; four were found in the
code or by a failing test rather than by reasoning ahead.

**Two real bugs, both caught by the tests before they could ship.**
`initI18n` applied its argument *conditionally* — `setLocale(locale)`, which
ignores an unsupported value. That left the **previous** language standing
instead of falling through to the browser: neither the injected locale nor the
browser's answer, and a direct violation of criterion 6. Booting is a full
answer to "what language is this", so it now re-resolves from scratch every
time. Separately, `parseMissingKeyHandler` had the wrong arity: i18next calls it
as `(key, value)`, not `(locales, ns, key)`, so it returned `undefined` and
i18next rendered `{}` — the gap became *invisible*, which is precisely the
failure the handler exists to prevent.

**The suite needed pinning, not just initialising.** Component tests rendered
raw keys because nothing imported the layer. The fix is `src/testSetup.js`, but
the important half is that it pins `en` / `en-GB` rather than letting resolution
run: node has its own `navigator`, so on an Italian machine the suite would
render Italian and the gate would fail for a reason unrelated to the change
under test.

**`t` shadowing, twice.** `Sidebar` and `TypeVisibility` both mapped over types
with `t` as the loop variable, which silently shadows the translation function.
Both renamed to `name`, with a comment, because the failure mode is a label that
quietly becomes a type name.

**The block editor came into scope** (`adr/0047` r4, criterion 13). BlockNote
ships its own dictionaries and the editor is the largest surface in the app;
leaving its menus English while the frame around them translated would read as a
half-done job. Imported by name rather than `import * as` — a namespace import
puts all 23 dictionaries into the editor's lazily-loaded chunk.

**Commit messages stay English**, recorded in the ADR's Out of scope and in a
comment on `messageFor`. They are git history read by other tools and other
people, not UI copy, and must not depend on the language of the browser that
happened to produce them.

**Catalogue parity got two checks beyond the key sets**: no blank values, and
matching interpolation placeholders. A translation that drops `{{name}}` still
renders a sentence — just without the thing it was about — so key parity alone
would pass it.

47 new tests (`src/lib/locale.test.js`, `src/lib/i18n.test.js`,
`src/lib/formats.test.js`, `src/locales/catalogues.test.js`). 444 total,
`yarn verify` green.

**Still open before this can ship:** exit criterion 11, the by-hand check in a
running app with the browser set to Italian and then to an unsupported language.
It needs a consumer `.web` project, which is outside this repo.
