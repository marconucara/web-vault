---
adr: 0044
title: What the URL addresses — note, heading anchor, and what stays out
status: Proposed
date: 2026-08-05
owner: marco
supersedes:
superseded-by:
depends-on: [0006, 0008, 0025]
tags: [routing, ux, compatibility, content]
---

# ADR 0044 — What the URL addresses — note, heading anchor, and what stays out

## Context

`adr/0006-hash-based-routing.md` decided the routing **mechanism** — hash-based,
so the server never needs an SPA catch-all rewrite and the real paths
(`/shared/<id>/`, `/attachments/*`, `/api/*`) are always served directly. It did
not decide what the hash **contains**. That was never recorded anywhere, and the
answer accumulated instead of being chosen.

What the URL addresses today, read off the implementation: exactly one thing, a
note id.

```
#/n/<encodeURIComponent(note id)>      src/App.jsx:18, 99, 109
#/                                     the empty/cleared state
```

Wikilinks are rewritten to that shape at build time
(`src/lib/wikilinks.js:10`), and the note list, properties panel and editor all
navigate by assigning it. Nothing else is in the URL: the sidebar selection —
which built-in view, saved view, or type is open — lives in React state
(`src/App.jsx:34`) and is lost on reload or on sharing a link.

The gap that forced the question: **a heading link inside a note lands nowhere.**
`src/components/Markdown.jsx` runs `react-markdown` with `remark-gfm` and nothing
else, so no `id` is ever placed on a rendered heading. The link is generated
correctly — `MdLink` deliberately passes any `href` starting with `#` through
untouched — so `[jump](#some-heading)` produces a real anchor pointing at a
target that does not exist. Found while writing the starter template's welcome
note, which wanted to link to one of its own sections; the link was replaced with
prose.

Three forces shape the answer.

**Anchors and app routes share one namespace.** Both live in the hash. `#/n/x`
is an app route and `#some-heading` is a document anchor, and the app currently
distinguishes them only by the `^#\/n\/` regex — anything else falls through to
"no note open". Any anchor scheme has to stay disjoint from the route grammar,
or a note whose heading happens to slugify into `/n/...` would hijack navigation.

**Slugs are a compatibility surface.** The moment a vault author writes
`[jump](#drop-a-place-on-the-map)` in a note, the slug rule is load-bearing:
changing it later breaks links that live in the user's own content, which this
product does not own and cannot migrate. This is the same class of commitment as
wikilink resolution (`adr/0008-wikilink-resolution.md`). It therefore has to be
written down and match what other tools in this ecosystem do, rather than being
whatever a library happens to emit. The starter notes carry headings like
`### 🗺️ Drop a place on the map`, so emoji, punctuation and non-ASCII are not
hypothetical.

**There are two renderers, and they must agree.** The in-app reader
(`src/components/Markdown.jsx`) and the isolated public share pages
(`scripts/shared-render.mjs:92`) both render note bodies through `react-markdown`
+ `remark-gfm`, independently. A link that works in the app and dies on a share
page — or the reverse — would be worse than one that fails consistently, because
sharing is exactly when a link leaves the author's control.

## Capability statement

The URL addresses **a note and, optionally, a position within it**. A note is
addressed as it is today; a heading within the rendered note body is addressable
by an anchor derived from its text with a documented, stable slug rule, and
following such a link scrolls to that heading in the reader. The rule is shared
by the in-app reader and the public share pages, so the same link resolves in
both. Anchors are disjoint from the app-route grammar by construction. Sidebar
and saved-view selection deliberately stay **out** of the URL for now; this ADR
records that as a decision rather than leaving it an accident.

## User stories / scenarios

- As a note author, I write `[jump](#a-heading-of-mine)` in a note and following
  it moves the reader to that heading, in the app and on a share page alike.
- As a note author, my headings with emoji, punctuation, or accented characters
  produce predictable anchors I can link against.
- As someone sharing a note publicly, a heading link inside it works for the
  recipient exactly as it did for me.
- As a maintainer, I can tell from this ADR whether a given piece of app state
  belongs in the URL, instead of deciding case by case.

## Acceptance criteria

1. Every heading rendered from a note body carries an `id` derived from its text,
   in both the in-app reader and the share-page renderer.
2. The slug rule is documented in this ADR and produces identical output for the
   same heading text in both renderers, verified by a shared test.
3. The slug rule is the GitHub-style rule already conventional in this ecosystem:
   lowercase; strip characters that are neither alphanumeric, space, nor hyphen
   (emoji included); spaces to hyphens; existing hyphens kept. Non-ASCII letters
   that are alphanumeric are kept, not transliterated.
4. Duplicate headings within one note get a stable disambiguating suffix
   (`-1`, `-2`, …) assigned in document order, so an anchor does not silently
   point at the wrong one of two same-named sections.
5. No generated anchor can match the app-route grammar `^#/`: the rule strips
   `/`, so a heading cannot produce a slug that begins with it.
6. Following an in-note anchor scrolls to the heading without changing which
   note is open and without clearing the current note.
7. An anchor that matches no heading is inert — it does not navigate away, clear
   the open note, or error.
8. Sidebar/saved-view selection remains absent from the URL; reloading restores
   the default selection, as today.

## Out of scope

- **Putting the sidebar or saved-view selection in the URL.** Deliberately
  deferred, not forgotten: it would make view identity a compatibility surface
  too, and saved views are themselves mid-decision
  (`adr/0032-dual-format-views-base-yml.md`). Revisit once that settles.
- **Anchors inside the editor.** The editor is a separate path (BlockNote) with
  its own heading model; this ADR covers the reader only. Whether an anchor
  should be honoured while editing is left open below.
- **Cross-note heading links** (`[[note#heading]]`). That extends wikilink
  resolution and belongs with `adr/0008-wikilink-resolution.md`, not here.
- The routing mechanism itself, decided in `adr/0006-hash-based-routing.md`.

## Open questions

- Should an anchor be honoured when the note is open in the editor, or only in
  the reader? Reader-only is the assumption here.
- Should the reader render a click-to-copy anchor affordance on hover, as many
  documentation sites do, or is link-by-hand enough?
- `github-slugger` implements criteria 3 and 4 exactly and is the same
  implementation the surrounding ecosystem uses; adopting it rather than
  hand-rolling the rule is the expected route, but it is a new dependency on
  both the app and the build path.

## References

- adr/0006-hash-based-routing.md — the routing mechanism this builds on.
- adr/0008-wikilink-resolution.md — links *between* notes; this ADR is
  navigation *within* one.
- adr/0025-public-share-pages.md — the second renderer that must agree.
- adr/0032-dual-format-views-base-yml.md — why view identity stays out of the
  URL for now.
- src/App.jsx — the current hash grammar (`#/n/<id>`) and the sidebar selection
  held in React state.
- src/components/Markdown.jsx — the in-app reader; emits no heading ids today.
- scripts/shared-render.mjs — the share-page renderer that must match it.

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-08-05 | r1 | marco | Initial draft. Promoted from `_agent/prompts/routing-adr.md`, filed 2026-08-03 as a handoff after a heading link in the starter welcome note was found to land nowhere. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
