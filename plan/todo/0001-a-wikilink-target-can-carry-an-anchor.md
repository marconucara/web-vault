# A wikilink target can carry a heading anchor

**Owning ADR(s):** `adr/0044-what-the-url-addresses.md` (revision r5 — one
acceptance criterion widened, no new ADR; see *The ADR* below).

## Context

`adr/0044-*.md` shipped heading anchors: every heading carries a derived `id` on
both surfaces, and an anchor in the URL lands on it. That half works, on both
surfaces, and this item touches none of it:

- `/shared/<uuid>#convenzioni` — a share page, a native anchor in a static
  document.
- `#/n/<id>#<slug>` — the app, via `parseNoteHash` and the re-scroll effect
  (`src/App.jsx:178`).
- `[Trasferimento in Spagna](/n/draft-…#test)` — a markdown link an author wrote
  as an absolute path. It renders as a link and opens in a new tab **because it
  is written as an external link**. That is the author's choice at the moment of
  writing it, and it is fine as it is. **Nothing to fix, nothing in scope here.**

One case is left, and it is the only one: a wikilink whose target carries an
anchor, `[[folder/nota#heading]]`, **is not even shown as a link**.
`resolveWikilink` (`src/lib/blocknoteSchema.jsx:13`) looks the whole string up in
`titleIndex` — `#heading` included — and `titleIndex` is keyed by lower-cased id,
H1 title and basename (`scripts/build-content.mjs:139-141`). The lookup misses,
so the chip renders as a dead grey span.

## The fix

Resolve the target's **note half** as today, and re-append the anchor half to the
href that comes out. That is the entire change.

The anchor is **not** validated, **not** checked against the target note's
headings, and nothing here has to know what is inside the target note — which is
what keeps this a few lines rather than a feature. If the anchor matches a
heading, the machinery from 0044 lands on it. If it does not, the note opens at
the top, which is already the settled behaviour for an anchor matching nothing
(0044 AC 8).

**Splitting the target: try the whole string first.** A note id can legitimately
contain a `#` — `src/lib/headingSlug.js` names exactly this case (`C# tips.md`,
which is why the note id is percent-encoded in the route). So splitting eagerly
would break links that resolve today, which is a regression on a live vault, not
a missed feature. The rule is therefore: look the full target up first, and only
on a miss split at the **last** `#` and look up the left half. `[[C# tips]]`
resolves on the first attempt; `[[C# tips#heading]]` on the second.

**The round trip is unaffected by construction.** The target is parsed where the
href is built and never written back, and the wikilink token already carries `#`
safely — `preProcessWikilinks` percent-encodes the payload (`#` → `%23`) and
`decodeWikilink` restores it — so the markdown that goes back to the vault is the
markdown that came out of it.

**One judgement call left open**, one line either way. The anchor is re-appended
verbatim, as instructed, so `[[nota#my-heading]]` lands and
`[[nota#My Heading]]` — the heading *text*, which is what Obsidian's own link
picker inserts — does not. Passing it through `headingSlug` would accept both,
and cannot regress the first form because the function is idempotent over its own
output. Left out; say the word and it goes in.

## Scope

The same split, wherever a wikilink target is resolved. Four call sites, all
performing the identical lookup today:

1. `src/lib/blocknoteSchema.jsx` — `resolveWikilink`, the editor chip. The href
   becomes `noteHash(id, anchor)`; the click path is untouched
   (`src/lib/chipClick.js` already handles plain, modifier, middle and right).
2. `scripts/shared-render.mjs` — `transformSharedWikilinks`, the note body on a
   share page: `/shared/<uuid>/#<anchor>` when the target note is itself shared,
   plain text when it is not. The isolation rule of `adr/0025-*.md` is unchanged.
3. `src/lib/wikilinks.js` — `wikilinkTargets`, frontmatter relationships
   (`src/components/PropertiesPanel.jsx`, `src/components/NoteView.jsx`).
4. `scripts/shared-render.mjs` — `sharedRelTargets`, the same on a share page.

The split goes in **one exported helper** in `src/lib/wikilinks.js`, imported by
both the client bundle and the Node build script — as `src/lib/headingSlug.js`
already is — rather than the same regex written out four times.

**Chip label: unchanged.** Alias, else the note title, else the target as
written. A chip pointing into a heading therefore reads the same as one pointing
at the note. Minimal, as asked; showing the heading alongside the title is one
line and is flagged here rather than decided.

**Dead code in the path.** `transformWikilinks` (`src/lib/wikilinks.js:6`) has
had no caller since `src/components/Markdown.jsx` was deleted with 0044 — it is
the read-view transform of a read view that no longer exists. Delete it and its
tests instead of teaching it the split. Confirm no importers first.

## Out of scope

- **Markdown links, in every form.** They already render as links, and where they
  go is what the author wrote.
- Checking that the anchor exists, or reporting when it does not.
- `[[#heading]]` (same-note wikilink), block references `[[nota#^id]]`, heading
  paths `[[nota#a#b]]` — the last `#` split sends these somewhere inert, which is
  the same outcome as any anchor matching nothing.
- Link autocompletion, and any rewriting of links in the vault (0008's own out of
  scope, unchanged).

## The ADR

**No new ADR — `adr/0044-*.md`, revision r5.**

0044 already owns this criterion. AC 5 reads: *"A bare `#<slug>` href written by
an author is rewritten to that form at activation time, using the currently open
note id."* That is exactly the mechanism this item extends — an anchor an author
wrote, turned into `#/n/<id>#<slug>` when the link is followed. The only thing
that widens is where the note id comes from: the open note for a bare anchor, the
wikilink's own target for this one. Same criterion, one form wider.

The note half is resolved by `adr/0008-*.md`'s existing rules, applied to a
substring, and **0008's decision does not move**: which note a target names is
answered exactly as before, and the anchor is carried through without ever being
resolved, validated, or looked at. Nothing in 0008's capability statement or its
criteria becomes untrue, so it gets no revision row — only a one-line pointer in
its References, which is editorial and flagged as such in the commit.

What r5 has to do in 0044:

- widen AC 5 to name the wikilink form alongside the bare anchor;
- **amend the Out of scope bullet**, which currently reads "Cross-note heading
  links (`[[note#heading]]`). That extends wikilink resolution and belongs with
  `adr/0008-wikilink-resolution.md`, not here." That routing was written when the
  case looked like an extension of resolution; it turned out to be an extension
  of the rewrite AC 5 already describes, so the bullet records the correction
  rather than being quietly deleted;
- note the whole-target-first split rule and why (a note id may contain a `#`);
- one Revision History row, Approvals updated.

0044 stays Implemented, so `INDEX.md` is not regenerated.

(Two earlier sizings of this item are dropped: a new ADR 0048, and 0008 r2. The
first was sized against a much wider reading of the defect; the second followed
0044's own Out of scope pointer without checking it against AC 5.)

## Exit criteria

1. `[[folder/nota#heading]]` renders as a **live** chip, not a dead span, and a
   plain click opens the note and lands on the heading.
2. The href carries the anchor verbatim: `#/n/<encoded id>#heading`.
3. All three target forms of `adr/0008-*.md` AC 4 still resolve with an anchor
   appended: path, H1 title, bare basename.
4. `[[folder/nota#heading|alias]]` shows the alias.
5. A target whose note does not resolve stays a dead chip, anchor or no anchor.
6. An anchor matching no heading opens the note at the top: no error, no scroll
   left spinning.
7. **A target containing a `#` in the note id still resolves.** `[[C# tips]]`
   reaches the note it reaches today; `[[C# tips#heading]]` reaches it with the
   anchor. This is the regression the whole-string-first rule exists to prevent,
   so it is pinned by a test, not by inspection.
8. A note carrying such wikilinks round-trips byte-identical.
9. Share page: a wikilink with an anchor into a **shared** note links to
   `/shared/<uuid>/#<anchor>` and lands on the heading; into an unshared note it
   stays plain text.
10. A frontmatter relationship value carrying an anchor resolves, and the
    rendered link carries the anchor.
11. `yarn verify` green.
12. Verified by hand in the running app **and** on a real share page.

## Dependencies

None. The queue is otherwise empty and nothing else touches link resolution.
