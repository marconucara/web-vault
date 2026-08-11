# Client preferences modal — language, formatting, Inbox, commit-disabled notice

**Owning ADR(s):** `adr/0034-client-settings-modal.md`

## Context

0034 is the last unimplemented decision from the settings cluster, and it is now
mostly a composition job: three of its four pieces already have their machinery
in place and are missing only a control and a place to store the answer.

**The i18n layer is built and deliberately incomplete.** `adr/0047` shipped
`src/lib/i18n.js` with `setLocale`, `setFormatLocale` and an `initI18n({ locale,
formatLocale })` boot seam, and it persists **nothing** on purpose — the module
header says so, and `src/main.jsx:12` names this ADR as the thing that will pass
the stored values in. So the work here is the storage and the two selectors, not
the plumbing.

**The capability signal is built and under-consumed.** `src/lib/capabilities.js`
exposes `useCapabilities() → { canWrite, known }` from `GET /api/capabilities`,
but the only consumer is `VersionIndicator`. Nothing in the editor path reads
it: `grep` for `readOnly` across `NoteView.jsx`, `Editor.jsx` and
`BlockEditor.jsx` returns nothing. AC 10 is therefore real work, not a wiring
change.

**Inbox is unconditional.** `src/App.jsx:119` counts it and
`src/components/Sidebar.jsx:31-37` renders it with no condition, exactly as
`adr/0033` specified provisionally, pending this.

The `known` third state in `capabilities.js` matters for both new consumers: the
store starts at `canWrite: null` specifically so a read-only fallback does not
flash before the endpoint answers.

## Scope

### Preference storage

A new `src/lib/prefs.js`, shaped like the existing stores (`drafts.js`,
`upgrade.js`, `capabilities.js`): module state + `useSyncExternalStore`, backed
by `localStorage` under one key.

Three preferences, all optional: `locale`, `formatLocale`, `showInbox`. **`Auto`
is the absence of the key**, not a stored `"auto"` sentinel (AC 5) — that is what
keeps a user who never chose following their browser after they change its
language. Reading a preference the app no longer supports (a catalogue that was
removed) must fall through to Auto rather than pin a dead value; both setters in
`i18n.js` already ignore unsupported input, so the store should not duplicate
that validation, only avoid depending on it.

`main.jsx` reads the store before `initI18n()` and passes both values through
the seam that already exists.

### The two selectors

**Language** (AC 2): entries from `SUPPORTED_LOCALES`, so a new catalogue
appears with no change here. Labels are the endonym from
`Intl.DisplayNames([code], { type: 'language' })`, capitalised — `Intl` yields
lowercase in most languages (`italiano`), which reads as an error in a list.
Fallback to the raw code when `Intl` has no name.

**Format** (AC 3): `Auto` plus a curated list of tags, which lives as a `const`
in `src/lib/locale.js` next to `SUPPORTED_LOCALES` — that file already owns the
distinction between the two resolutions and explains it at length. Start with
`en-US`, `en-GB`, `it-IT`, `de-DE`, one per genuinely distinct format family,
with the selection criterion in a comment so whoever extends it knows what the
list is for. 0034 deliberately keeps this list out of its criteria: extending it
is a one-line change, not an amendment.

Labels are built, not written: the region name from `Intl.DisplayNames` **in the
current interface language**, then a fixed sample instant formatted **by the
entry's own tag** — `United Kingdom — 11 Aug 2026, 14:30`. The two halves are in
different languages by design; the name identifies the entry, the sample shows
the result. Fall back to the tag when the region cannot be named. Reuse
`src/lib/formats.js` for the sample rather than constructing a formatter here,
but note its helpers take an explicit locale argument — the sample must not use
the *current* format locale.

The label depends on the interface language, so the list re-renders on a
language change (AC 4) while the stored format value stays put.

### The modal

New `src/components/Preferences.jsx`, following `TypeVisibility.jsx` — the
closest existing surface: a modal that edits a small set of toggles and is
opened from a single control.

Contents in order: the commit-disabled notice (conditional), language, format,
show Inbox.

**The notice** (AC 8, 9) renders only when `canWrite === false`. Not when
`known` is false — an unanswered endpoint must not accuse a working deployment.
Copy: the deployment has no GitHub secret configured, and it is added at the
deployment, not here. No input, in any state. The wording of the equivalent
instruction in `src/lib/__fixtures__/welcome.md` is the reference for what an
adopter is told to do; do not link an ADR from it (repo rule).

**Entry point** (AC 1): a gear at the right edge of the status bar, after the
sync indicator — `src/components/StatusBar.jsx:215-228`, past the
`statusbar-spacer`. Note that both branches of the `inSync` ternary end the row
today, so the button goes after the whole conditional, not inside a branch.

### Inbox toggle

Default on (AC 7). Consumed at `Sidebar.jsx` for the row and `App.jsx:119` for
the count. Hiding Inbox while it is the *selected* view leaves that list open and
working — only the row goes, exactly as `adr/0046` decided for a hidden type
(`App.jsx:345-347`). Nothing breaks: the list keeps rendering, and it stops being
reachable once the user navigates away, which is what hiding it was for. No
selection reset.

### Write gating

Two surfaces with different rules, and the difference is the design (AC 10-12).

**The commit actions** — new note (`App.jsx:261`), new type and edit type
(`Sidebar.jsx:66-77`), `ShareSheet` (`NoteView.jsx:134`), delete — are present
only when `canWrite === true`. So the condition is a plain positive test, and
both the unanswered and the negative answer fall out of it: no `known` branch
needed for these. They fade in when the answer confirms; the fade exists so a
control arriving 40ms late reads as the interface settling rather than as a pop.
A CSS transition on opacity at mount, not an animation library.

**The editor** takes the opposite rule, because it is *content*, not a control:
it always renders, read-only until `canWrite === true`. Withholding it would
leave the note body blank, which is a worse answer to "we do not know yet" than
showing the text.

Deliberately **not** gated on `known`, and the reason is the anchor scroll rather
than the gating itself. The body is a lazy chunk (`NoteView.jsx:13`) whose load
almost always outlasts the capability fetch, so a `known` gate would be a branch
that never runs in the common case — and in the rare one (chunk cached, endpoint
not yet answered) it would add a second placeholder-to-editor swap inside the
window `App.jsx:159-203` spends chasing a heading into position. That loop exists
precisely because the skeleton and the editor have different heights and the
reflow undoes an early scroll; giving it a second reflow to absorb is the one
thing worth avoiding here.

So read-only is the state the editor is *born* in, and confirmation only ever
relaxes it. **Verify that the relaxation changes no rendered height** — some
editors reveal a toolbar or a placeholder line only when writable. If BlockNote
does, reserve the space rather than reverting to a `known` gate.

Read-only itself: `Editor.jsx` takes CodeMirror's `editable={false}`;
`BlockEditor.jsx` has BlockNote's own read-only prop — check it against the
installed version rather than assuming the name.

The unanswered window is short and always resolves: `capabilities.js` lands a
failed or timed-out fetch on `canWrite: false` rather than leaving it `null`.

Removal needs no CSS work: every one of those actions is already rendered behind
a prop guard — `{onNew && …}` (`NoteList.jsx:119`), `{onNewType && …}`,
`{onEditType && …}`, `{onManageVisibility && …}` — so withholding the prop
removes the control and the existing layout absorbs it. `.group-actions` was
built for exactly this kind of conditional pair. Note that `onManageVisibility`
opens a manager that only *toggles* visibility, which is a commit
(`adr/0046`), so it belongs in the withheld set too.

## Out of scope

- Any override of the read-only editor — 0034 AC 10 is unconditional and the
  out-of-scope list says so explicitly.
- A free-text BCP-47 field for the format.
- Deriving the format list from the shipped catalogues or from the current
  language's regions. Considered and rejected while drafting; the curated list
  is the starting point.
- Synced or server-side preferences.
- Any preference beyond the three above.
- Changing what `/api/capabilities` reports, or how it derives `canWrite`.

## Exit criteria

Mapped to `adr/0034-*.md` acceptance criteria.

1. A gear at the right edge of the status bar, after the sync indicator, opens
   the modal; every preference survives a reload and applies with no reload.
   *(AC 1)*
2. The language selector lists `Auto` plus one entry per shipped catalogue,
   derived from `SUPPORTED_LOCALES`, labelled with the capitalised endonym, with
   the code as fallback. A test adds a fake catalogue and asserts the entry
   appears without touching the component. *(AC 2)*
3. The format selector lists `Auto` plus the curated tags, each labelled with
   the region name in the current interface language followed by a sample
   formatted by that tag, with the tag as fallback when the region cannot be
   named. *(AC 3)*
4. Changing the language leaves the stored format preference untouched, and vice
   versa; changing the language relabels the format entries. *(AC 4)*
5. `Auto` stores no value: with `Auto` selected the resolution matches what the
   browser produces today, and a browser tag outside the curated list is
   recovered by returning to `Auto`. Pinned by a test, since a stored `"auto"`
   sentinel would pass every other criterion here. *(AC 5)*
6. `src/lib/i18n.js` still reads and writes no storage; the modal is the only
   owner. *(AC 6)*
7. The "show Inbox" toggle defaults to shown and controls both the sidebar row
   and its count; hiding it while Inbox is the selected view leaves that list
   open and rendering, and does not reset the selection. *(AC 7)*
8. With `canWrite: false` the modal shows the notice; there is no token input in
   any state. *(AC 8)*
9. With `canWrite: true` the modal says nothing about the token; with the
   endpoint unanswered (`known: false`) it also says nothing. *(AC 9)*
10. The note body renders without waiting for the endpoint, read-only until
    `canWrite === true`; confirmation relaxes it to writable and changes no
    rendered height, so a link to a heading lands in the same place either way.
    *(AC 10)*
11. New note, new type, edit type, manage visibility, share and delete are
    present only with `canWrite: true` — absent both while unanswered and on
    `false` — and appear with a fade rather than instantly. *(AC 11)*
12. Every control withheld under criterion 11 is absent from the DOM, not
    rendered disabled. *(AC 12)*
13. With `canWrite: false` both editors are read-only. *(AC 11)*
14. New UI strings are in `src/locales/en.json` and `it.json`, keys and source
    English; the catalogue parity test stays green.
15. No ADR identifier in any user-visible string.
16. `yarn verify` green.
17. Verified by hand in the running app before commit: all three capability
    states (unanswered, `true`, `false`), a language change, a format change,
    and the Inbox toggle while Inbox is the selected view.

## Dependencies

None. `adr/0047` shipped on 2026-08-11 and provides the seam; `plan/todo/` is
otherwise empty.

---

## Outcome

Went in as scoped, after four rounds of clarification that changed the ADR more
than the code. Worth recording:

**The ADR was rewritten before a line was written** (r3, r4). The token stopped
being a "status" and became a notice shown only when there is something to say;
`read-only by default` lost its "by default", because the override it implied
does not exist; and a second selector appeared for the formatting locale, which
`0047` had already established as a decision separate from the interface
language. Criteria went from 5 to 12.

**Body and commit actions gate on different things, and the split is the
design.** Actions are controls: their absence leaves no hole, so they are
withheld until write access is *confirmed* — one positive test, `canWrite ===
true`, which collapses "not asked yet" and "cannot write" into the same branch
and means no cold load shows an action about to vanish. The body is content:
withholding it would blank the note, so it always renders, read-only until
confirmed, relaxing into writable. Gating it on `known` instead was drafted and
rejected — the editor is a lazy chunk whose load already outlasts the fetch, so
that branch would almost never run, and in the rare case it did it would add a
second placeholder-to-editor swap for the anchor scroll (`adr/0044`) to chase.

**The first read-only test was false and passed.** `renderToStaticMarkup` proves
nothing about CodeMirror, which renders an empty shell under SSR — removing
`editable={!readOnly}` left the suite green. Found by mutating the source rather
than by reading it. `editorReadOnly.test.jsx` now mounts real editors, and every
gate here (Inbox row, share, read-only) was mutation-checked to confirm it bites.

**The date sample was wrong twice.** `Date.UTC` with a local-zone formatter read
`15:30` in CEST, and would have read differently per reader — the 12h/24h
contrast the instant was chosen for landing on a different hour each time, and
the test depending on the machine. It renders in UTC, the only date in the app
that does, because it illustrates a format rather than naming a moment. And
`hour: '2-digit'` produced `03:30 PM` on `en-US`, which nobody writes.

**Two things the plan did not anticipate.** Discarding a draft commits nothing
(it is local), so gating delete wholesale would have trapped a draft made before
a token was removed — only the real delete is behind `canWrite`. And the fade
had to be narrowed twice: `list-btn icon-only` is shared with search, which is
always present and must not flicker, and the preferences gear itself must never
fade, being the one control that has to be there precisely when everything else
is gone.

**Deviation after seeing it run:** "Follow the browser" became "System default"
at the owner's request, as the clearer name for the same idea.

Verified by hand by the owner: the read-only state renders correctly in a built
preview. 29 new tests across `prefs`, `localeLabels`, `preferences`,
`writeGating` and `editorReadOnly`; 485 total, `yarn verify` green.
