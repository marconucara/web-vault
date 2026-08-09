# Open a link from the editor with a plain click, not Cmd/Ctrl+click

**Owning ADR(s):** `adr/0016-wikilink-and-media-blocks.md`
**Dependencies:** None

## Context

In the block editor a wikilink chip opens its target **only** on Cmd/Ctrl+click
(`src/lib/blocknoteSchema.jsx:31-45`). On a touch device that modifier does not
exist, so the chip is inert: **on mobile a wikilink cannot be followed at all.**
The block editor is on for every note and there is no read-only mode outside the
public share pages (`src/components/NoteView.jsx:29-32`), so there is no second
surface a phone user can fall back to. That is the reported defect.

The modifier is not merely unreachable on mobile — it is also the wrong
behaviour on desktop, for three reasons that only became visible once the code
was read next to what it is supposed to match:

**It is not what the modifier means anywhere else.** The handler calls
`e.preventDefault()` and assigns `window.location.hash`, so Cmd/Ctrl+click
navigates **in the same tab**. The one thing a modifier-click is universally
expected to do — open in a new tab — is the one thing the chip cannot do. The
chip is a `<span>`, not an anchor, so the browser's own affordances are absent
too: no middle-click, no context menu, no long-press "Open in new tab".

**It contradicts the editor's own links.** Verified against the dependency's
source rather than from memory
(`@blocknote/core@0.51.4`,
`src/extensions/tiptap-extensions/Link/helpers/clickHandler.ts`): for an
ordinary `[text](url)` link inside the editor, a left click calls
`window.open(href, target)` with the mark's default `target="_blank"`. **A plain
click follows the link** — which is also why ordinary markdown links already
work on mobile today, and why the chips are the anomaly rather than the rule.

**It contradicts the rest of the product.** In the read rendering used by the
share pages, wikilinks are plain `<a href="#/n/...">` (`src/lib/wikilinks.js`,
`src/components/Markdown.jsx:22-42`), and the relation chips in the note header
are anchors too (`src/components/NoteView.jsx:125`). Click-to-navigate is
already the rule on every surface except this one.

**What the modifier was supposed to buy, and did not.** ADR `0016` AC1 states
that a plain click must not navigate "so the chip can be placed and edited".
There is no edit UI for a wikilink chip — none has ever existed. The chip is
atomic inline content (`content: 'none'`), which BlockNote registers as
`atom: true, selectable: false`
(`@blocknote/react/src/schema/ReactInlineContentSpec.tsx`), so the only thing a
plain click enables is placing the caret near it — obtainable by clicking just
before or after the chip, or with the arrow keys — and Backspace from the
following position still deletes it. The Raw toggle in the note header
(`src/components/NoteView.jsx:86-92`) remains for surgical edits of the source.
ADR `0016` was written as a backfill of existing code (r1, "recorded after the
fact"), so this justification was never a decision taken against the
alternative.

The inline **media chip** (`src/lib/blocknoteSchema.jsx:67-77`) has no click
handler at all: it cannot be opened on any platform, desktop included. Same
defect class, less visible, fixed in the same pass.

## Scope

1. **The wikilink chip becomes a real anchor.** A resolved chip renders as
   `<a href="#/n/<encodeURIComponent(id)>">`; a dead chip stays a `<span>`, as
   today. This is not cosmetic — the `href` is what gives the context menu,
   middle-click, and long-press "Open in new tab" for free, none of which a
   `<span>` can offer.
2. **Plain click or tap navigates in-app**, matching the read view: intercept,
   `preventDefault`, assign the hash.
3. **Cmd/Ctrl/Shift-click and middle-click open a new tab**, handled explicitly
   with `window.open` rather than delegated to the browser. The chip sits in a
   `contenteditable=false` island inside a `contenteditable` root, where native
   anchor activation is not dependable across browsers; doing it ourselves makes
   the outcome the same everywhere. Note that BlockNote's own link handler makes
   the same choice for ordinary links.
4. **The media chip opens its URL in a new tab** under the same handler.
5. **Rewrite the tooltips.** `blocknoteSchema.jsx:40` currently reads
   `"<target> — Cmd/Ctrl+click to open"`; after this change it is false. Name
   the target instead of the gesture.
6. **Revise ADR `0016` to r2** on the implementing commit: the capability
   statement and AC1 both state the Cmd/Ctrl+click rule and both have to change,
   with a Revision History row. Status stays `Implemented` (the behaviour ships
   in the same commit, as for `0015` r5-r7). Regenerate `INDEX.md` only if the
   metadata block changes.

## Tests

`devDependencies` carries no React testing library and the default vitest
environment is `node` (`vitest.config.mjs`), so do not reach for a rendering
test first. Extract the decision as a pure helper — event flags in, intent out
(`'navigate' | 'new-tab' | 'ignore'`) — and test that:

- plain left click on a resolved chip → `navigate`;
- Cmd (meta), Ctrl, and Shift left click → `new-tab`;
- middle click (`button === 1`) → `new-tab`;
- right click (`button === 2`) → `ignore`, so the browser's own context menu is
  never pre-empted;
- an unresolved (dead) target → `ignore` on every gesture.

A jsdom test asserting the resolved chip renders an anchor carrying the
`#/n/<id>` href is worth adding on top, since the href is what the context menu
depends on and no unit test of the handler can observe it.

## Out of scope

- **The map card keeps its current behaviour**
  (`src/components/MapCard.jsx:127-131`): click opens the in-place editor,
  Cmd/Ctrl+click opens Maps. It is not affected by the reported bug — its
  popover carries an explicit **Open** button, so a phone can reach the link —
  and it is a card with a real edit UI, not a link chip. Flipping it would mean
  designing a separate edit affordance, which is more UI risk than the
  consistency is worth. Its tooltip stays accurate and is left alone.
- **A read-only mode on mobile.** Considered and declined by the owner: the
  always-on editor works well as it is.
- Wikilink *resolution* (`adr/0008-wikilink-resolution.md`) — untouched.
- Any change to the markdown round-trip: chips serialise exactly as before.
- An edit UI for the wikilink chip. It does not exist today and this item does
  not add one.

## Exit criteria

1. A tap on a resolved wikilink chip in the block editor opens the target note
   on a touch device — the reported defect, verified on a real phone or an
   emulated touch viewport, not only in a unit test.
2. A plain left click does the same on desktop.
3. Cmd/Ctrl/Shift-click and middle-click open the target in a **new tab**, which
   the current implementation cannot do at all.
4. A long-press (touch) and a right-click (desktop) offer the browser's own
   "Open in new tab" on a resolved chip, and the app does not interfere.
5. A dead chip stays inert on every gesture.
6. An inline media chip opens its URL in a new tab.
7. No tooltip or copy anywhere still tells the user to use Cmd/Ctrl+click for a
   chip.
8. A chip can still be removed with Backspace from the position after it, and
   the caret can still be placed either side of it.
9. Every case under Tests has a test; ADR `0016` is at r2 with its capability
   statement and AC1 rewritten and a Revision History row.
10. `yarn verify` green.

## Notes

- No version bump or tag with this item. `_agent/CURRENT_FOCUS.md` records a
  parallel session holding a fix for the same release; this is a bug fix and
  rides the next patch with it.
