# Cross-note heading links

**Owning ADR(s):** `adr/0048-cross-note-heading-links.md` — **to be authored as
the first step of this item** (see *Step 0* below). It depends on
`adr/0008-wikilink-resolution.md`, `adr/0016-wikilink-and-media-blocks.md` and
`adr/0044-what-the-url-addresses.md`, all Implemented; none of them is expanded
in place, per `CONVENTIONS.md` §"one decision per ADR".

## Context

`adr/0044-*.md` shipped in `v0.10.0`
(`plan/done/2026-08-11-heading-anchors-in-the-url.md`): every heading carries a
derived `id` on both surfaces, `#/n/<id>#<slug>` addresses a position inside a
note, and a bare `[jump](#some-heading)` written in a note is rewritten against
the open note and followed. That covers navigation **within** one note. What it
deliberately left out — recorded in 0044's Out of scope — is the link **into**
another note's heading, the one an author actually writes when connecting two
notes: `folder/nota#heading`.

That target does not resolve today. `titleIndex` is keyed by lower-cased id,
H1 title and basename (`scripts/build-content.mjs:139-141`); `folder/nota#heading`
matches none of the three, because the `#heading` is part of the string being
looked up. So the failure is the same in all three places that resolve a
wikilink, and it is silent:

| Surface | Code | What the author sees |
|---|---|---|
| Editor chip | `src/lib/blocknoteSchema.jsx:13` | a dead grey chip, no navigation |
| Share page | `scripts/shared-render.mjs:25` | the link dropped, plain text |
| Frontmatter relationship | `src/lib/wikilinks.js:15` | no link rendered |

The markdown form fails differently, and worse. `[text](folder/nota#heading)` is
neither a wikilink nor media, so nothing in the pipeline touches it: BlockNote
renders an ordinary anchor, and its own click handler calls
`window.open('folder/nota#heading')`, which resolves against the deployment
origin and leaves the app on a 404. It looks like a working link and is not one.

The addressing half of the problem is already solved and needs no change:
`noteHash(id, slug)` produces the target, and App's re-scroll effect
(`src/App.jsx:178`) already covers "open a different note *and* land on a
heading" — that is the cold-load case it was written for, reached here from a
click instead of from the address bar.

## The rule this adds

A link target becomes `<note-target>[#<heading>]`, where `<note-target>` is
exactly what `adr/0008-*.md` already resolves (path, title, or basename) plus an
optional `.md` suffix, which Obsidian writes and Tolaria does not.

The heading half is passed through `headingSlug` before it is used. That is the
whole compatibility decision, and it is the one worth stating in the ADR: an
author may write the heading **text** (`[[nota#Drop a place on the map]]`, which
is what Obsidian's own picker inserts) or the **slug**
(`[[nota#drop-a-place-on-the-map]]`, which is what someone who copied the anchor
link has). `headingSlug` is idempotent over its own output, so slugifying always
accepts both without a second rule and without guessing which one was meant.

**Nothing is rewritten in the vault.** Targets are parsed at render and click
time; the wikilink token payload still carries the target verbatim, so the
byte-identical round trip of `adr/0015-*.md` holds by construction rather than by
a new test having to defend it.

## Step 0 — the ADR

Author `adr/0048-cross-note-heading-links.md` as a capability ADR (metadata →
Context → Capability statement → User stories → Acceptance criteria → Out of
scope → Open questions → References → Revision History → Approvals), advance it
to Accepted, regenerate `INDEX.md`. The acceptance criteria are the exit criteria
below. A new ADR rather than a revision of 0008: 0044 named 0008 as the *topic*
this belongs to, but 0008 is Implemented and adding a link form to it is scope
expansion inside a closed decision, which `CONVENTIONS.md` forbids.

## Scope

**One parser, shared.** A single place that splits a raw target into
`{ target, anchor }` and resolves it to `{ id, anchor }` against `titleIndex`,
slugifying the anchor via `src/lib/headingSlug.js`. It lives beside the existing
link helpers (`src/lib/wikilinks.js`) and must be importable both from the client
bundle and from the Node build script, as `headingSlug.js` already is — the two
surfaces resolving a target differently is the failure mode this item exists to
close, so they share the function rather than the rule.

**1. The editor chip** (`src/lib/blocknoteSchema.jsx`). `resolveWikilink` goes
through the parser; `href` becomes `noteHash(id, slug)`. Label when there is no
alias: the note title **and** the heading, so a chip pointing into a note is
distinguishable from one pointing at it. The `title` attribute keeps the raw
target as written, as today. The click path is untouched — it already handles
plain/modifier/middle/right (`src/lib/chipClick.js`), and an anchor in the href
changes nothing about it.

**2. Markdown links in the editor** (`src/components/BlockEditor.jsx`). Extend
the existing capture-phase handler that today only answers for bare anchors. An
href with no scheme, not starting with `#` or `/`, that resolves through the
parser, is followed as `noteHash(id, slug)`. It must run through
`chipClickIntent` rather than only the plain-click case the bare-anchor branch
handles, because the gesture that is broken today includes modifier and middle
click: those reach BlockNote's handler, which opens a relative path in a new tab.
An href that does not resolve is left to BlockNote exactly as now — this handler
gets more selective about what it claims, not greedier.

**3. Share pages** (`scripts/shared-render.mjs`). `transformSharedWikilinks`
resolves the note half through the same parser and emits
`/shared/<uuid>/#<slug>` when the target note is itself shared; unshared or
unresolved stays plain text, which is the existing isolation rule
(`adr/0025-*.md`) and is not relaxed. The markdown form is broken here for the
same reason it is broken in the app — a relative href on a share page points at
nothing — so it gets the same treatment: resolved and shared → the share URL,
otherwise the link text, left as prose. Images, absolute URLs, media links and
anything inside a fence or a code span are not touched; the existing
`outsideCode` discipline of `src/lib/richMarkdown.js` is the model.

Heading ids already exist on share pages, so the landing needs no JavaScript
there: a native anchor in a static document scrolls by itself.

**4. Frontmatter relationships** (`src/lib/wikilinks.js` `wikilinkTargets`,
`scripts/shared-render.mjs` `sharedRelTargets`, and their consumers
`src/components/PropertiesPanel.jsx` and `src/components/NoteView.jsx`). A
relation value written as `[[folder/nota#heading]]` resolves through the same
parser and the rendered link carries the anchor.

**5. Bare anchors, unified.** `anchorOf` (`src/lib/headingSlug.js`) currently
returns the author's text verbatim, so `[jump](#My Heading)` misses a heading
whose id is `my-heading`. Slugifying it too costs one call and cannot regress
anything: heading ids are produced by `headingSlug`, so slugifying an anchor that
already matches leaves it unchanged. Anchors read back **out** of the URL
(`parseNoteHash`) stay verbatim — those are ours, not an author's.

**6. Dead code found in the path.** `transformWikilinks`
(`src/lib/wikilinks.js:6`) has had no caller since `src/components/Markdown.jsx`
was deleted with `adr/0044`; it is the read-view transform of a read view that no
longer exists. Delete it with its tests rather than teaching it a rule nothing
will exercise. Confirm no importers first.

## Out of scope

- **`[[#heading]]`** — the same-note wikilink form. The chip renders from the
  content index and does not know which note is open, so this needs the open note
  id in a context; the markdown form `[jump](#heading)` already covers the same
  intent and shipped with 0044. Deferred, not refused.
- **Obsidian block references** (`[[nota#^blockid]]`) and heading paths
  (`[[nota#a#b]]`). Only the first `#` splits; the remainder is treated as one
  anchor, matches no heading, and the link opens the note at the top — inert,
  which is the behaviour 0044 already settled for an anchor that matches nothing.
- **Link autocompletion** while typing in the editor.
- **Rewriting or canonicalising links in the vault** — 0008's out of scope,
  unchanged here.
- **Any change to the slug rule.** It is a compatibility surface
  (`src/lib/headingSlug.js`); this item consumes it and does not touch it.

## Exit criteria

Numbered so they can be lifted into `adr/0048` as its acceptance criteria.

1. `[[folder/nota#heading]]` renders as a live chip; a plain click opens the
   target note and lands on the heading, including the case where the editor for
   the target note has to mount first.
2. `[[folder/nota#heading|alias]]` shows the alias, unchanged.
3. Without an alias the chip shows the note title and the heading — not the raw
   path, and distinguishable from a chip pointing at the note itself.
4. `[[Nota Title#heading]]`, `[[nota#heading]]` and `[[nota.md#heading]]` all
   resolve, matching the three forms of `adr/0008-*.md` plus the `.md` suffix.
5. Heading **text** and **slug** reach the same place, asserted on a heading with
   punctuation, an accent and an emoji — the same fixture the existing shared
   slug test uses, so the two rules cannot drift apart unnoticed.
6. A target whose note does not resolve stays a dead chip (no regression). A
   target that resolves but whose anchor matches no heading opens the note, at
   the top, with no error and no spinning scroll.
7. `[text](folder/nota#heading)` in the editor navigates in-app on a plain
   click, and opens the **app** URL in a new tab on modifier or middle click. No
   gesture reaches `window.open` with a relative path.
8. A note containing both forms round-trips byte-identical.
9. On a share page, a wikilink with an anchor into a **shared** note links to
   `/shared/<uuid>/#<slug>` and lands on the heading; into an unshared note it is
   plain text.
10. On a share page, the markdown form follows the same rule as criterion 9.
11. A frontmatter relationship value carrying an anchor resolves, and the
    rendered link carries the anchor.
12. Targets inside a fenced block or a code span are not linkified, on either
    surface.
13. `[jump](#My Heading)` lands on the heading `## My Heading` (criterion 5's
    rule applied to the bare form).
14. `yarn verify` green.
15. Verified by hand in the running app **and** on a real share page before the
    change is committed — the share half is not observable from the test suite
    alone.

## Dependencies

None. The queue is empty and nothing else touches link resolution.

## Risks

- **The editor click handler must not become greedy.** It now claims a class of
  href it previously ignored; an external link, a mailto, an attachment or an
  absolute path reaching it would be a regression in a path that currently works.
  Gate on "no scheme, not `#`, not `/`, resolves through the index", and pin each
  exclusion with a test.
- **Basename collisions.** `nota#heading` where two notes share a basename
  resolves to whichever the build indexed last. That is 0008's existing
  behaviour, inherited rather than introduced; record it in the ADR, do not fix
  it here.
- **Share-page markdown links are the one place this item grows.** Rewriting
  hrefs inside rendered markdown is a wider surface than resolving a wikilink
  token. If it turns out to need more than the wikilink pass does, split it into
  its own item rather than letting it enlarge this one — criteria 10 is the seam
  to cut at.
