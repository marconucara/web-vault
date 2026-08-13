---
adr: 0044
title: What the URL addresses — note, heading anchor, and what stays out
status: Implemented
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
#/n/<encodeURIComponent(note id)>      src/App.jsx:20, 127, 128
#/                                     the empty/cleared state
```

Wikilinks are rewritten to that shape at build time
(`src/lib/wikilinks.js:10`), and the note list, properties panel and editor all
navigate by assigning it. Nothing else is in the URL: the sidebar selection —
which built-in view, saved view, or type is open — lives in React state
(`src/App.jsx:34`) and is lost on reload or on sharing a link.

The gap that forced the question: **a heading link inside a note lands nowhere.**
`[jump](#some-heading)` produces a real anchor pointing at a target that does not
exist, because no `id` is ever placed on a rendered heading. Found while writing
the starter template's welcome note, which wanted to link to one of its own
sections; the link was replaced with prose.

### The two surfaces that must agree

This is the part an earlier reading of the code got wrong, and it changes the
mechanism, so it is recorded explicitly.

There is **no read-only reader in the app.** `src/components/Markdown.jsx`
(`react-markdown` + `remark-gfm`) is imported by `src/components/NoteView.jsx`
but never rendered — it is dead code on that path. Every note body in the app is
rendered by **BlockNote**, always editable (`src/components/NoteView.jsx:140`).
The `react-markdown` renderer survives only in `scripts/shared-render.mjs`, which
builds the isolated public share pages.

So the two surfaces are:

| Surface | Renderer | Editable |
|---|---|---|
| The app | BlockNote (`src/components/BlockEditor.jsx`) | always |
| Share pages (`adr/0025-*.md`) | `react-markdown` (`scripts/shared-render.mjs`) | never |

They render note bodies through completely different pipelines. A link that
works in the app and dies on a share page — or the reverse — would be worse than
one that fails consistently, because sharing is exactly when a link leaves the
author's control. The slug rule, therefore, is the contract between them; the
mechanism that applies it is necessarily different on each side.

### The other two forces

**Anchors and app routes share one namespace.** Both live in the hash. `#/n/x`
is an app route and `#some-heading` is a document anchor, and the app currently
distinguishes them only by the `^#\/n\/` regex — anything else falls through to
"no note open". A bare `#slug` assigned to `window.location.hash` does not merely
fail to scroll: it *closes the note*, because `parseHash` returns `null`. Any
anchor scheme has to keep the note id in the URL and stay disjoint from the route
grammar.

**Slugs are a compatibility surface.** The moment a vault author writes
`[jump](#drop-a-place-on-the-map)` in a note, the slug rule is load-bearing:
changing it later breaks links that live in the user's own content, which this
product does not own and cannot migrate. This is the same class of commitment as
wikilink resolution (`adr/0008-wikilink-resolution.md`). It therefore has to be
written down and match what other tools in this ecosystem do, rather than being
whatever a library happens to emit. The starter notes carry headings like
`### 🗺️ Drop a place on the map`, so emoji, punctuation and non-ASCII are not
hypothetical.

## Capability statement

The URL addresses **a note and, optionally, a position within it**. A note is
addressed as it is today; a heading within a note body is addressable by an
anchor derived from its text with a documented, stable slug rule, and following
such a link scrolls to that heading. The anchor is carried **inside** the note
route (`#/n/<id>#<slug>`), so it survives reload and being shared, and cannot
collide with the route grammar. An anchor an author writes is rewritten into
that form when the link is followed — against the open note for a bare
`#<slug>`, and against the target note for a wikilink carrying one
(`[[folder/note#heading]]`). The slug rule is shared by the always-editable app
surface and the static share pages, so the same link resolves in both. A
heading in the app offers a hover affordance that copies its link, so an address
can be obtained without composing it by hand. Sidebar and saved-view selection
deliberately stay **out** of the URL for now; this ADR records that as a
decision rather than leaving it an accident.

## User stories / scenarios

- As a note author, I write `[jump](#a-heading-of-mine)` in a note and following
  it moves me to that heading, in the app and on a share page alike.
- As a note author, my headings with emoji, punctuation, or accented characters
  produce predictable anchors I can link against.
- As someone sharing a note publicly, a heading link inside it works for the
  recipient exactly as it did for me.
- As someone sent a link to a section, opening it lands me at that section with
  the right note open, and reloading keeps me there.
- As a maintainer, I can tell from this ADR whether a given piece of app state
  belongs in the URL, instead of deciding case by case.

## Acceptance criteria

1. Every heading in a note body carries an `id` derived from its text, on both
   surfaces: the BlockNote-rendered body in the app, and the share-page
   renderer.
2. The slug rule lives in one module imported by both surfaces, and produces
   identical output for the same heading text in each, verified by a shared
   test.
3. The slug rule is the GitHub-style rule already conventional in this
   ecosystem: lowercase; strip characters that are neither alphanumeric, space,
   nor hyphen (emoji included); spaces to hyphens; existing hyphens kept.
   Non-ASCII letters that are alphanumeric are kept, not transliterated.
   `github-slugger` is the implementation.
4. Duplicate headings within one note get a stable disambiguating suffix
   (`-1`, `-2`, …) assigned in document order on the share pages, so an anchor
   does not silently point at the wrong one of two same-named sections.
   In the app this is **not** achievable and is accepted as a divergence: the
   heading's `render` sees one block and has no document-wide counter to
   consult, and a stateful one would renumber differently depending on the
   order ProseMirror happens to re-render in. Two same-named headings therefore
   share an id there, and an anchor resolves to the first — the same outcome
   `getElementById` gives. It is a limitation of addressing headings in a live
   editor, not a difference in the slug rule, which stays identical.
5. The addressable form of a position within a note is `#/n/<id>#<slug>`. An
   anchor written by an author is rewritten to that form at activation time,
   taking the note id from the currently open note for a bare `#<slug>` href,
   and from the link's own target for a wikilink that carries an anchor
   (`[[folder/note#heading]]`, alias form included).
6. No generated anchor can match the app-route grammar `^#/`: the rule strips
   `/`, so a heading cannot produce a slug that begins with it.
7. Following an in-note anchor scrolls to the heading and leaves the open note
   unchanged — it does not clear the note or remount the editor.
8. An anchor that matches no heading is inert: the note stays open, nothing
   scrolls, nothing errors.
9. `#/n/<id>#<slug>` opened cold (reload, or a link received from someone else)
   opens the note and lands on the heading.
10. In the app, ids track edits: renaming a heading updates its id without a
    reload, and the duplicate suffixes renumber in document order.
11. Sidebar/saved-view selection remains absent from the URL; reloading restores
    the default selection, as today.
12. Hovering a heading in the app reveals an affordance that copies the absolute
    URL addressing it, confirming visibly that it was copied. It is offered on
    `h2`–`h6` and not on the note title, which `#/n/<id>` already addresses.
13. The affordance never displaces the caret: a click anywhere on a heading other
    than the affordance itself places the cursor, as on any other text.
14. Nothing the affordance adds is part of the note: the markdown a note
    round-trips to is byte-identical with the affordance present.
15. A wikilink target may carry an anchor. The note half resolves by the rules
    of `adr/0008-wikilink-resolution.md`, unchanged; the anchor is carried
    through to the link **without being resolved or validated**, so nothing has
    to know the target note's contents. An anchor matching no heading there
    falls under criterion 8, and a target whose note does not resolve stays a
    dead chip as before. Because a note id may itself contain a `#` (a file
    named `C# tips.md`, which is why the id is percent-encoded in the route),
    the whole target is looked up first and only split — at the last `#` — when
    that misses.

## Design notes

Not binding in the way the criteria above are, but recorded because the
mechanism was investigated before accepting and the shape is what makes the
criteria cheap to meet.

**In the app.** The id is produced by the heading's own `render`, by wrapping
`defaultBlockSpecs.heading` rather than reimplementing it.

An earlier draft of this ADR proposed stamping the ids onto the rendered DOM
instead, on the reasoning that a custom block spec would mean owning BlockNote's
heading behaviour forever. Both halves of that were wrong, and implementation
proved it:

- **Stamping cannot work here at all.** ProseMirror recreates a block's elements
  on every render, so anything written to its DOM from outside is discarded
  within a frame — measured by tagging the nodes: the `<h_>` had a different
  identity on each repaint, and ids set on one paint were gone by the next. This
  is not a race that retrying wins.
- **A custom spec costs almost nothing.** BlockNote builds the heading as
  `createHeadingBlockSpec(config, implementation, extensions)`, and everything
  that makes a heading behave like one — the `Mod-Alt-N` shortcuts, the `#`
  input rules, the slash menu and toolbar entries — lives in `extensions`,
  keyed off `type: "heading"`, not in `render`. Its `render` is five lines. So
  the real spec is reused whole and only its `render` output is decorated:
  upstream keeps ownership, and this adds one attribute.

`render` does not re-run when text is typed into an existing heading (only on a
structural change such as a level change or paste), so a rename is handled by
refreshing the ids from `editor.onChange` — criterion 10. A `MutationObserver`
on the editor DOM was tried for this and must not be: writing an attribute
inside the observed subtree is itself a mutation ProseMirror answers with a
repaint, and the resulting loop hangs the editor.

**Landing on the heading.** Scrolling waits for the target and keeps adjusting
while the page settles, rather than scrolling once. On a cold load — a link
received from someone else, the case that matters most — the note body is a
lazily-loaded chunk, so the anchor does not exist yet; and when it appears it
still moves, because the editor replaces a skeleton placeholder of a different
height. A single scroll at the moment the id shows up is undone by that reflow.
Any deliberate gesture (wheel, touch, key) cancels it, so it never fights a user
who has taken over.

**The click.** A bare `<a href="#slug">` inside a `contenteditable` root is not
dependably activated across browsers — this is the same problem
`src/lib/chipClick.js` was written for, and the same reason BlockNote overrides
ordinary link clicks. The rewrite in criterion 5 belongs on that existing path
in `src/lib/blocknoteSchema.jsx`, which also inherits modifier/middle-click
handling and makes "copy link address" yield the full compound URL.

**On share pages.** A small local rehype plugin puts the ids on, and a native
anchor in a non-editable document scrolls by itself. `rehype-slug` is the
obvious fit and cannot be used: it owns its slugger, while the share renderer
splits a body into segments around map cards and renders each separately, so a
per-render slugger restarts the duplicate counter and two same-named headings
on opposite sides of a map card both come out `#setup`.

**The copy affordance** is drawn as a CSS `::after` on the heading, not as an
element. This is what makes it safe in an editable surface: a pseudo-element is
not a DOM node, so ProseMirror never sees it — it cannot become editable text,
cannot be serialized back into the note, and needs no JS to survive a repaint.

The cost is that a pseudo-element can never be an event target: a click on it
arrives as the heading. Which clicks count is therefore decided geometrically,
against a circle inscribing the icon — more forgiving at the edges than the
icon's own box, and it keeps the test independent of the exact layout. The end
of the text is measured with a `Range` over the heading's contents rather than
from the element, whose box spans the full column and says nothing about where
the words end; taking the last of the per-line rectangles keeps the affordance
attached to the final word when a heading wraps.

The known limitation of this shape is that it is not keyboard reachable — a
pseudo-element cannot hold focus. Accepted for now: the anchor itself is fully
usable without the affordance, which is a shortcut for composing a URL by hand.
A real focusable control would have to live outside the editor's DOM.

**Known limitation, accepted.** On an always-editable surface a heading's slug
changes when its text changes, so editing `## Setup` into `## Setup and install`
silently breaks `#setup` links written elsewhere in the vault. This is inherent
to addressing headings by their text in an editor, not to this design — Obsidian
has the same property — and the alternative (a stable id persisted into the
markdown) would put machine identifiers into the user's own files, which this
product does not do.

## Out of scope

- **Putting the sidebar or saved-view selection in the URL.** Deliberately
  deferred, not forgotten: it would make view identity a compatibility surface
  too, and saved views are themselves mid-decision
  (`adr/0032-dual-format-views-base-yml.md`). Revisit once that settles.
- ~~**Cross-note heading links** (`[[note#heading]]`). That extends wikilink
  resolution and belongs with `adr/0008-wikilink-resolution.md`, not here.~~
  **Brought into scope at r5 as criterion 15**, and the routing corrected rather
  than deleted, because it sent the work to the wrong document twice. It is not
  an extension of resolution: which note a target names is answered exactly as
  0008 already answers it, on a substring, and the anchor is never resolved at
  all. It is criterion 5's rewrite with the note id taken from the target
  instead of from the open note.
- The routing mechanism itself, decided in `adr/0006-hash-based-routing.md`.

## Open questions

None. The three carried by the draft are resolved above: anchors are honoured in
the app's editable surface as well as on share pages (criteria 1, 7, 10); the
copy-anchor affordance is included after all, on `h2`–`h6` (criteria 12–14);
`github-slugger` is adopted (criterion 3).

Deliberately left for later, once there is evidence it is wanted: a
keyboard-reachable version of the affordance, and the same affordance on the
share pages, where it would be an ordinary focusable element because nothing
there is editable.

## References

- adr/0006-hash-based-routing.md — the routing mechanism this builds on.
- adr/0008-wikilink-resolution.md — links *between* notes; this ADR is
  navigation *within* one.
- adr/0025-public-share-pages.md — the second surface that must agree.
- adr/0032-dual-format-views-base-yml.md — why view identity stays out of the
  URL for now.
- src/App.jsx — the current hash grammar (`#/n/<id>`), `parseHash`, and the
  sidebar selection held in React state.
- src/components/NoteView.jsx — renders every note body through BlockNote; the
  `Markdown.jsx` import here is dead.
- src/components/BlockEditor.jsx — the app's only note-body surface.
- src/lib/blocknoteSchema.jsx, src/lib/chipClick.js — the existing in-editor
  link activation path.
- src/lib/wikilinks.js — where a wikilink target is split and resolved
  (criterion 15).
- scripts/shared-render.mjs — the share-page renderer that must match it.

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-08-05 | r1 | marco | Initial draft. Promoted from `_agent/prompts/routing-adr.md`, filed 2026-08-03 as a handoff after a heading link in the starter welcome note was found to land nowhere. |
| 2026-08-11 | r2 | marco | Corrected the surface story: there is no read-only reader in the app — every note body is BlockNote, always editable, and `Markdown.jsx` is dead on that path. Chose the compound `#/n/<id>#<slug>` grammar so the note id survives an anchor. Closed all three open questions (honour anchors while editing; no copy affordance; adopt `github-slugger`). Added Design notes and the editable-slug limitation. Accepted. |
| 2026-08-11 | r3 | marco | Replaced the mechanism after implementation disproved it: ids come from the heading's own `render` (wrapping the stock spec, whose behaviour lives in `extensions`), because ProseMirror discards anything stamped onto its DOM from outside. Recorded that a MutationObserver on the editor loops and hangs it. Relaxed criterion 4: duplicate suffixes hold on the share pages but cannot in the live editor, where an anchor resolves to the first match. Added the settle-aware scroll for cold loads and `scroll-margin-top` for the landing offset. |
| 2026-08-11 | r4 | marco | Brought the click-to-copy affordance into scope, having found it costs a CSS pseudo-element rather than a component: criteria 12–14, offered on `h2`–`h6` only. Recorded why `::after` is the right shape in an editable surface, the geometric hit test it forces, and that it is not keyboard reachable. Corrected the share-page note: `rehype-slug` is unusable because the body renders in segments. |
| 2026-08-13 | r5 | marco | Widened criterion 5 and added criterion 15: an anchor carried by a **wikilink** target is rewritten the same way a bare `#<slug>` href is, taking the note id from the target instead of from the open note. Corrected this ADR's own Out of scope, which routed the case to `adr/0008-*.md` as an extension of resolution — it is not: the note half resolves by 0008's existing rules on a substring, and the anchor is carried through unresolved. Recorded that the whole target is looked up before any split, because a note id may contain a `#`. **Criterion 15 is not yet implemented**: queued as `plan/todo/0001-a-wikilink-target-can-carry-an-anchor.md`, which is why the status does not move. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Owner | marco | 2026-08-13 | Accepted (r5) |
