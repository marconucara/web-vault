# Heading anchors in the URL

**Owning ADR(s):** `adr/0044-what-the-url-addresses.md`

## Context

`[jump](#some-heading)` inside a note lands nowhere. No heading carries an `id`
on either surface, so the anchor points at a target that does not exist. Worse
than inert: assigning a bare `#slug` to `window.location.hash` makes `parseHash`
(`src/App.jsx:20`) return `null`, which **closes the open note**.

`adr/0044-*.md` settles what the URL addresses: a note and, optionally, a
position within it, as `#/n/<id>#<slug>`. This item implements that.

Two surfaces render note bodies, through different pipelines, and both must
produce the same slug for the same heading text:

| Surface | Renderer | Editable |
|---|---|---|
| The app | BlockNote (`src/components/BlockEditor.jsx`) | always |
| Share pages | `react-markdown` (`scripts/shared-render.mjs`) | never |

Note that `src/components/Markdown.jsx` is imported by
`src/components/NoteView.jsx` but never rendered — it is **not** the app's
reader. The app has no read-only body renderer at all.

## Scope

**The shared rule.** A new `src/lib/headingSlug.js` wrapping `github-slugger`,
importable by both the client bundle and the Node build script. It is the single
definition of the slug rule (ADR criteria 3 and 4).

**In the app (BlockNote).** Wrap `defaultBlockSpecs.heading` and put the `id` on
in its `render`. The stock spec is reused whole — `config`, `extensions`,
`parse`, `toExternalHTML` untouched — so the `Mod-Alt-N` shortcuts, `#` input
rules, slash menu and toolbar keep working: they live in `extensions`, not in
`render`.

Stamping ids onto the DOM from outside does **not** work and must not be
retried: ProseMirror recreates a block's elements on every render and discards
them within a frame. Nor can a `MutationObserver` on the editor patch that up —
writing an attribute inside the observed subtree provokes the repaint it then
reacts to, and the loop hangs the editor.

`render` does not re-run when a heading's text is typed into, so ids are
refreshed from `editor.onChange` for the rename case.

**The click.** Extend the existing in-editor link activation path
(`src/lib/blocknoteSchema.jsx`, `src/lib/chipClick.js`): an href starting with
`#` that is not `#/` is rewritten to `#/n/<current note id>#<slug>` before the
hash is assigned. This inherits modifier/middle-click handling and makes "copy
link address" yield the full compound URL.

**Routing.** `parseHash` returns `{ id, anchor }`. A change in `anchor` alone
scrolls without touching `openId`, so the editor is not remounted. No match →
do nothing.

The cold load (`#/n/<id>#<slug>` opened from a link someone sent) needs more
than one scroll: the body is a lazy chunk so the target does not exist yet, and
once it appears it still moves, because the editor replaces a skeleton
placeholder of a different height. So the scroll re-applies until the heading
holds its position, bounded in time, cancelled by any deliberate gesture.

**Landing offset.** `scroll-margin-top` on headings, in the app and on the
share pages, so a jumped-to heading is not flush against the viewport top.

**Copy-link affordance.** Added mid-flight, once it turned out to cost a CSS
pseudo-element rather than a component — see `adr/0044-*.md` criteria 12–14. A
`::after` on `h2`–`h6`, revealed on hover, copying the absolute URL; the click
is placed geometrically against a circle inscribing the icon, because a
pseudo-element is never an event target.

**Share pages.** Put ids on the headings in `scripts/shared-render.mjs`. Native
anchors in a non-editable document scroll by themselves; no click handling
needed there.

`rehype-slug` is the obvious fit but cannot be used: it owns its slugger, and
`renderBody` renders the body in **segments** split by map cards, so a
per-render slugger restarts the duplicate counter and two `## Setup` on opposite
sides of a map card both come out `#setup`. A small local rehype plugin taking
the note's slugger instead.

**Dependencies added:** `github-slugger` only.

**The dead import.** Drop the unused `Markdown.jsx` import from
`src/components/NoteView.jsx` — the work already opens that file, and leaving it
is what made the surface story wrong in the first place. Delete
`src/components/Markdown.jsx` too if nothing else imports it.

## Out of scope

- Sidebar / saved-view selection in the URL (ADR: deferred).
- A keyboard-reachable copy affordance, and the same affordance on the share
  pages (ADR: deferred).
- Cross-note heading links `[[note#heading]]` — belongs with
  `adr/0008-wikilink-resolution.md`.

## Exit criteria

Mapped to `adr/0044-*.md` acceptance criteria.

1. Headings carry a derived `id` on both surfaces — in the app and on a share
   page. *(AC 1)*
2. One module defines the rule; a shared test asserts both surfaces produce
   identical slugs for the same heading text, including a case with emoji,
   punctuation and accented characters (e.g. `### 🗺️ Drop a place on the map`).
   *(AC 2, 3)*
3. Duplicate headings in one note get `-1`, `-2`, … in document order **on the
   share pages**. In the app they share an id and the anchor resolves to the
   first — an accepted divergence, pinned by a test so it stays deliberate.
   *(AC 4)*
4. Clicking a bare `#slug` link in the editor navigates to `#/n/<id>#<slug>`;
   the note stays open and the editor does not remount. *(AC 5, 7)*
5. A heading whose text would slugify with a `/` cannot produce a slug starting
   with `/` — covered by a test, not only by inspection. *(AC 6)*
6. An anchor matching no heading is inert: note stays open, no error. *(AC 8)*
7. `#/n/<id>#<slug>` loaded cold opens the note and scrolls to the heading.
   *(AC 9)*
8. Renaming a heading in the editor updates its id without a reload, and
   duplicate suffixes renumber. *(AC 10)*
9. Sidebar selection is still absent from the URL — no regression. *(AC 11)*
10. Hovering an `h2`–`h6` reveals an affordance that copies the absolute URL to
    it, with visible confirmation; the note title has none. *(AC 12)*
11. A click on a heading outside the affordance still places the caret. *(AC 13)*
12. A note carrying the affordance round-trips byte-identical. *(AC 14)*
13. `yarn verify` green.
14. Verified by hand in the running app — including the share page for a shared
    note — before the change is committed.

## Dependencies

None. Nothing else in the queue touches routing.

---

## Outcome

The slug rule went in as planned. The mechanism for applying it in the app did
not, and the first version shipped to manual testing **broken** — worth
recording, because the reasoning that produced it was plausible and would be
reached again.

**Stamping ids onto the editor DOM cannot work.** The plan called for writing
`id` onto the rendered headings from `editor.document`. It passed its tests and
failed in the app. ProseMirror recreates a block's elements on every render:
tagging the nodes showed a different `<h_>` identity on each repaint, with the
ids from the previous paint gone. The tests passed because they built the DOM by
hand — a fixture that proved nothing about the thing under test. They now mount
a real editor.

**A MutationObserver does not rescue it.** Re-stamping on every DOM change was
the obvious repair and hangs the editor outright: writing an attribute inside
the observed subtree is itself a mutation ProseMirror answers with a repaint,
which fires the observer again. Reproduced, not theorised.

**The answer was the custom block spec the ADR had ruled out** — on the
reasoning, mine, that it would mean owning BlockNote's heading behaviour. Reading
the source settled it: `createHeadingBlockSpec(config, implementation,
extensions)` keeps the shortcuts, `#` input rules, slash menu and toolbar in
`extensions`, and its `render` is five lines. Wrapping `render` alone leaves all
of that with upstream. One gap remains and is handled separately: `render` does
not re-run when text is typed into an existing heading, so a rename is refreshed
from `editor.onChange`.

**The cold load needed more than a scroll.** Opening `#/n/<id>#<slug>` fresh —
a link someone sends you, the case that matters most — the target does not exist
yet (lazy chunk) and then *moves*, because the editor replaces a skeleton
placeholder of a different height. A single scroll when the id appears is undone
by that reflow. It now re-scrolls until the heading holds position, bounded, and
any deliberate gesture cancels it.

**`rehype-slug` could not be used** on the share pages: it owns its slugger, and
`renderBody` renders a body in segments split by map cards, so the duplicate
counter restarted per segment. An eight-line local plugin takes the note's
slugger instead. Verified to bite by restoring the per-render slugger and
watching the test fail.

**The copy affordance was added mid-flight**, out of the ADR's original scope,
after the block-spec work made clear it cost a `::after` rather than a
component. A pseudo-element is invisible to ProseMirror — it cannot become
editable content and cannot reach the markdown — at the price of never being an
event target, so the click is a geometric hit test against a circle inscribing
the icon. It is not keyboard reachable; recorded in the ADR as accepted.

Two divergences are deliberate and pinned by tests: duplicate headings share an
id in the editor (no document-wide counter in `render`) while the share pages
still number them; and `🗺️` slugs to a leading invisible character, because
`github-slugger` keeps the U+FE0F variation selector — GitHub's own behaviour,
matched rather than corrected.

369 tests (35 new). Two dependencies were installed and one, `rehype-slug`,
removed again once it proved unusable; only `github-slugger` remains.
`src/components/Markdown.jsx` was deleted — dead since the editor became the
only body renderer, and the source of the ADR's original wrong premise.

Verified by hand in the running app: cold load, in-app anchor click, landing
offset, and the copy affordance.

---

Shipped at HEAD `ec54fb8`, released as `v0.10.0`.
