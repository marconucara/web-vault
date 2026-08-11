---
adr: 0047
title: UI language — i18n layer and locale selection
status: Accepted
date: 2026-08-11
owner: marco
supersedes:
superseded-by:
depends-on: [0003, 0034, 0041]
tags: [i18n, ui, locale, preferences]
---

# ADR 0047 — UI language — i18n layer and locale selection

## Context

Every string the app shell renders is currently an English literal inlined in a
component. There is no way to translate the interface, and no seam where a
translation could be introduced without touching each component again.

`CONVENTIONS.md` already anticipates this: the repository's language mandate is
English for *source* strings and documentation, and it explicitly names a future
user-facing internationalisation as **a separate layer on top** rather than an
exception to the mandate. This ADR is that layer.

Two forces shape the answer:

- **The interface should arrive in the reader's language without being asked.**
  A vault viewer is opened and read; making the first interaction "go find the
  language setting" is a poor trade when the browser already states a
  preference. So detection is the default path, not the fallback.
- **The choice must remain overridable, but this ADR is not the place to build
  the control.** `adr/0034-client-settings-modal.md` owns the settings surface
  and the `localStorage` preferences that live behind it, and it already lists a
  UI language selector among them. Building a second, competing persistence
  path here would collide with it.

The split is therefore: this ADR owns the translation machinery, the locale
resolution rules, and a documented seam for an externally supplied locale; 0034
owns the UI that writes through that seam and the storage behind it. The seam is
specified now precisely so 0034 becomes an additive change rather than a rework.

A second, related preference falls out of the same resolution: **formatting**.
Dates, numbers and relative times are locale-dependent, and the locale that
should drive them is not always the locale of the interface — reading an English
UI while expecting `11/08/2026` rather than `08/11/2026` is an ordinary
combination, not an edge case. So formatting is resolved as its own locale, with
its own seam.

The two resolutions also disagree about **region subtags**, and this is the
reason formatting is not simply read off the interface language. Choosing a
catalogue must ignore the region — there is one Italian catalogue, and `it-CH`
has to find it. Formatting must *not* ignore it: region is exactly where the
information lives. `en` alone formats US-style, so a reader on an `en-GB`
browser would start seeing `Aug 11, 2026` where the app shows `11 Aug 2026`
today. The interface language is therefore matched language-only against what we
ship, while formatting defaults to the browser's full tag, region intact.

## Capability statement

The app shell renders its own strings through a translation layer backed by
message catalogues committed to the repository, one file per supported locale.
At start-up the interface language is resolved as: an externally supplied locale
if the host passes one and it is supported, otherwise the best supported match
for the browser's preferred languages, otherwise **English**. Matching is at
language level — region subtags are ignored, because they select nothing among
the catalogues we ship. Locale-dependent formatting of dates, numbers and
relative times follows a **second, separately resolved locale** that keeps
region information: absent an override it is the browser's own full language
tag, and it may be supplied independently of the interface language. Both
locales can be changed at runtime without a reload, and neither is persisted by
this layer: persistence belongs to the settings surface that will drive it.

## User stories / scenarios

- As a reader whose browser asks for Italian, I open the app and the interface is
  already in Italian, without having configured anything.
- As a reader whose browser asks for a language we do not ship, I get the English
  interface rather than an empty or broken one.
- As a reader whose browser asks for `it-CH`, I get the Italian interface,
  because the region subtag does not have to match.
- As a reader who wants an English interface with Italian date and number
  formats, I can have both, because interface language and formatting locale are
  resolved separately.
- As a reader on an `en-GB` browser, dates keep reading `11 Aug 2026` after this
  layer arrives, because formatting keeps the region the interface match drops.
- As the settings surface (`adr/0034-client-settings-modal.md`), I can supply a
  stored locale at boot and change it at runtime, without this layer knowing
  where I keep it.
- As a translator, I add a locale by committing one catalogue file and see
  immediately which strings I have not covered yet, because an untranslated key
  renders as the key.
- As a contributor, I cannot merge a partially translated catalogue, because the
  quality gate compares key sets across locales.

## Acceptance criteria

1. The app shell renders user-visible strings through the translation layer;
   no user-visible string in the shell is an inlined literal at the point of
   render.
2. Message catalogues are committed to the repository as one JSON file per
   locale at `src/locales/<code>.json`, statically imported so the bundler
   includes them in the build; no catalogue is fetched at runtime.
3. Two locales ship: `en` and `it`. `en` is the reference catalogue.
4. Locale codes are language-only. A browser preference carrying a region
   subtag (`it-CH`, `en-GB`) resolves to its language (`it`, `en`).
5. Interface language resolution order is, first match wins: (a) a locale
   supplied by the host at boot, if supported; (b) the first supported language
   among the browser's preferred languages, in the browser's own order; (c)
   `en`.
6. A locale supplied at boot that is **not** supported is ignored, and
   resolution continues at (b) — an unknown value never yields an untranslated
   interface.
7. The layer exposes a runtime call that switches the interface language; the
   rendered interface updates without a page reload.
8. The layer persists nothing. It reads no storage and writes no storage; a
   locale set at runtime does not survive a reload unless the host supplies it
   again at boot.
9. A key missing from the active catalogue renders **the key itself**, not the
   English string, and emits a console warning in development builds only.
10. Locale-dependent formatting of dates, numbers and relative times is driven
    by a formatting locale resolved separately from the interface language, and
    that locale **keeps its region subtag**. Absent an override it is the
    browser's own full language tag (`en-GB`, `it-CH`) — not the language-only
    code used to pick the catalogue — so a reader's existing date format does
    not change when this layer arrives. When the browser states no language, it
    falls back to the resolved interface language.
11. A formatting locale can be supplied at boot and switched at runtime,
    independently of the interface language, and is not restricted to the
    languages we ship catalogues for: any tag the platform accepts is honoured,
    and one it rejects falls back to the default above rather than throwing.
12. The quality gate (`adr/0041-automated-quality-gate-typecheck-and-tests.md`)
    fails when any shipped locale's catalogue does not have exactly the same set
    of keys as `en`. The check reads only files in this repository.
13. The block editor's own chrome (menus, toolbars, placeholders) follows the
    resolved interface language, using the dictionary its library ships. Where
    the library ships none for that language, its English one is used — that
    catalogue is not ours to complete, so criterion 9 does not apply to it.

## Implementation notes

Non-binding; the criteria above are what must hold.

The layer is `i18next` with the `react-i18next` binding. Alternatives considered:

- **A hand-written lookup over plain catalogues.** Rejected: it starts as a
  dozen lines and then grows the same features anyway — interpolation, plurals,
  a missing-key hook, a re-render on locale change — each of them a place to be
  subtly wrong, with none of them a differentiator for this product.
- **`i18next` core with an in-repo hook instead of `react-i18next`.** Rejected:
  the binding's value is exactly the part that is fiddly to get right, the
  subscription that re-renders the tree when the locale changes (criterion 7).
  Writing that ourselves buys nothing.
- **Per-namespace catalogue files** (`common.json`, `editor.json`, …). Rejected
  for now: it multiplies files and the parity check's surface at a catalogue
  size that does not need splitting. Splitting later is mechanical.
- **Region-aware locale codes** (`en-GB`, `pt-BR`) **for the catalogues.**
  Rejected: with two languages it adds a matching hierarchy that carries no
  content, since no two regions would differ in a single string. Note this is a
  rejection about *catalogues only* — formatting keeps the region (criterion 10),
  where it does carry content.
- **A language-detector plugin** (`i18next-browser-languagedetector`). Rejected:
  we own the precedence rules in criteria 5–6, including that an unsupported
  injected value falls *through* to the browser rather than short-circuiting to
  English. Expressing that as plugin configuration is more indirection than the
  handful of lines it replaces, and it is harder to test than a pure function
  over a list of tags.
- **Deriving the formatting locale from the interface language.** Rejected: it
  is the lossy direction. `en` formats US-style, so every reader on an `en-GB`
  browser would silently lose the format the app shows today — a regression
  introduced by a feature meant to improve localisation.

Missing-key behaviour (criterion 9) deliberately does **not** fall back to
English. A silent English fallback makes an untranslated catalogue look
finished, which is the one thing an incremental translation must not do. With
the gate enforcing parity (criterion 12), a rendered key cannot reach a
published build — it is a signal for whoever is authoring the catalogue.

## Out of scope

- **The language selector UI and its persistence.** The settings modal owns both
  (`adr/0034-client-settings-modal.md`); it will expose two controls — interface
  language and formatting locale — and supply their stored values through the
  seam defined here.
- **Separate date and time format settings.** Two locales are chosen; the
  formats are derived from them by `Intl`. Owning the patterns themselves
  (field order, 12/24-hour, separators) is a different and much larger decision,
  and the need behind it is usually a single narrow preference that can be added
  on its own when it is real.
- **Build-time rendered surfaces**: public share pages
  (`adr/0025-public-share-pages.md`) and the real 404 page
  (`adr/0027-real-404-and-share-marker.md`) stay English. They render outside the
  app shell, and their locale cannot be read from the visitor's browser at build
  time — choosing it per build or per share is a separate decision.
- **Vault-derived text**: note content, titles, type names, view names and folder
  names are the user's own and are never translated. This is the same carve-out
  the language mandate already makes in `CONVENTIONS.md`.
- **Translating error strings produced server-side** by the deploy functions.
- **Right-to-left layout**, locale-specific typography, and pluralisation rules
  beyond what the chosen library provides out of the box.
- **Commit messages written by the app** ("Publish <title>", "Hide type: <name>").
  They are git history, read in the vault's log by other tools and other people
  long after the browser that produced them is gone; they must not depend on the
  language that browser preferred. They stay English.
- **Machine translation or any translation tooling/pipeline.** Catalogues are
  authored and reviewed by hand.

## Open questions

- None.

## References

- adr/0003-stack-react-vite.md
- adr/0034-client-settings-modal.md (owns the selectors and their persistence)
- adr/0041-automated-quality-gate-typecheck-and-tests.md (hosts the parity check)
- adr/0025-public-share-pages.md
- adr/0027-real-404-and-share-marker.md
- CONVENTIONS.md (Language — English source strings, i18n as a separate layer)
- https://www.i18next.com/
- https://react.i18next.com/
- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/languages
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-08-11 | r1 | marco | Initial draft. |
| 2026-08-11 | r2 | marco | Accepted. No open questions: the split with `adr/0034-*.md` (this layer owns resolution and the seam, the settings modal owns both selectors and their persistence), the missing-key behaviour (render the key, never the English string) and the gate-enforced catalogue parity were all settled during authoring. |
| 2026-08-11 | r3 | marco | Split the two resolutions apart after reading the code: the interface language is matched language-only, but formatting now resolves separately and **keeps its region subtag**, defaulting to the browser's full tag. Found while planning — three call sites hardcode `en-GB`/system locale, and driving them from a bare `en` would have regressed a UK reader's dates from `11 Aug 2026` to `Aug 11, 2026`. Criteria 10–11 reworded; added the rejections of a language-detector plugin and of deriving formatting from the interface language. |
| 2026-08-11 | r4 | marco | Added criterion 13 during implementation: the block editor's own chrome follows the interface language via the dictionary BlockNote ships. Not in the original scope, but leaving the app's largest surface in English while everything around it translates is a visible hole, and it costs one prop. Recorded that app-written commit messages stay English — they are git history, not UI copy. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Owner | marco | 2026-08-11 | Accepted (r4) |
