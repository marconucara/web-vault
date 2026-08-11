# One tooltip across the interface

**Owning ADR(s):** `adr/0034-client-settings-modal.md` (criteria 11-12, for the
share and delete actions carried over from item `0001`)

## Context

web-vault has two tooltips. The in-app one — `.tt` + `data-tip`, a CSS bubble
(`src/styles.css:931-969`) — and the browser's native `title`. The in-app one
was introduced for the status bar and the version indicator and never went
further: it is used at eight sites, against roughly twenty-six `title`
attributes elsewhere. `src/styles.css:960` already records the intent that the
rest move onto it.

The split is visible. The native tooltip appears after the browser's own delay,
in the browser's own styling, positioned by the browser — next to a `.tt` bubble
that appears after 300ms in the app's colours. Two controls side by side in the
same header can behave differently, which is the case in `NoteList`, where the
sort and search buttons use `title` and the search-scope toggle uses `data-tip`
(`src/components/NoteList.jsx:80, 115, 151`).

Item `0001` adds a reason beyond consistency: it establishes `.tt` on an
`aria-disabled` control as the way a withheld action explains itself, because a
natively `disabled` button suppresses the events `title` and `.tt` both need.
Criteria 11-12 cover share and delete too, and both still use `title` — so they
cannot be tipped without this migration. `0001` scoped them out deliberately;
this item finishes them.

Not every `title` is a tooltip. Some are the native affordance for text that has
been truncated, one is an `<iframe>` accessibility attribute, and several sit on
non-focusable `<span>`s that `.tt`'s `:focus-visible` rule cannot reach. The
inventory below separates them, because a blanket replacement would break at
least one thing.

## Scope

**Convert to `.tt` — interactive controls (18):**

| Component | Lines |
|---|---|
| `NoteList.jsx` | 80 sort, 101 direction, 115 search, 126 new note |
| `Sidebar.jsx` | 77 visibility, 84 new type, 107 edit type |
| `StatusBar.jsx` | 147 include in commit, 160 discard, 223 view changes, 235 preferences |
| `ShareSheet.jsx` | 191 share / manage link |
| `TypeVisibility.jsx` | 69 close, 92 toggle |
| `TypePanel.jsx` | 155 close, 200 colour |
| `IconPicker.jsx` | 57 clear icon |
| `Preferences.jsx` | 59 close |
| `PropertiesPanel.jsx` | 117 close |
| `MapCard.jsx` | 153 open in Maps |
| `MapView.jsx` | 204 sections |

The four sidebar and note-list rows are already converted by item `0001`; they
appear here for completeness of the inventory, not as work.

**Leave as native `title` — with a comment saying why (8):**

- `IconPicker.jsx:75` — the icon name on every cell of the picker grid.
  Hundreds of elements; a `::after` on each is weight for a surface that is
  already the heaviest in the app.
- `PropertiesPanel.jsx:191` (commit subject) and `StatusBar.jsx:152` (file
  path) — the native reveal of text truncated by CSS, not an explanatory tip.
  Replacing it with a `nowrap` bubble reproduces the truncation it exists to
  undo.
- `MapCard.jsx:39` — the `title` of an `<iframe>`. An accessibility attribute
  that names the frame to a screen reader, not a tooltip. **Changing it is a
  bug**, and its resemblance to the others is the trap this list exists to
  document.
- `NoteView.jsx:90`, `StatusBar.jsx:216`, `TypePanel.jsx:229`,
  `ShareSheet.jsx:193` — non-focusable `<span>`s.

**The `<span>` group needs a decision, not a conversion.** `.tt` reveals on
`:hover` and `:focus-visible`; a `<span>` never takes focus, so converting it
gives a tooltip reachable by mouse only — a regression in keyboard reach dressed
as consistency. Either they stay native, or they gain `tabindex="0"` and become
focusable, which is a change to the tab order and wants to be intentional. The
recommendation is to leave them and record the reason; the alternative is
available if any of them turns out to matter.

**Share and delete gain the read-only tooltip**, closing what `0001` scoped out:
`ShareSheet.jsx:191` and the delete button in `PropertiesPanel.jsx:202-207`,
which today are absent under `!canWrite` and become `aria-disabled` with the
same *Editing is off* tip. Delete keeps its draft exemption — a draft is
discarded locally and commits nothing, so it stays live and untipped.

**Write down the rule.** The reason this migration stalled halfway is that
nothing says which tooltip to use. A short section in `CONVENTIONS.md`: `.tt` +
`data-tip` for interactive controls; native `title` for truncation reveals, for
`<iframe>` titles, and for high-cardinality lists; `aria-label` remains the
accessible name in both cases and is not replaced by either.

**Positioning is per-site, not mechanical.** `.tt::after` hangs below and
right-aligned; `.tt-up` opens upward for the status bar. Each converted control
needs the right variant, and `src/styles.css:728` records a case where a tooltip
rendered under a map — z-index and overflow are checked at each site, in the
running app.

## Out of scope

- Changing any `aria-label`. Several controls carry both; the label is the
  accessible name and is untouched.
- A JS tooltip component, or a positioning library. `.tt` is CSS and stays CSS.
- Changing `.tt`'s timing, styling or placement rules.
- Tooltips on controls that have none today.
- The commit popover's own items (`src/styles.css:961` notes they still use
  native `title`) — inside a popover, where placement needs its own thought.
  Left for when the popover is next touched.

## Exit criteria

1. Each of the 18 controls listed above shows the in-app bubble on hover and on
   keyboard focus, and no longer sets a native `title`.
2. The 8 sites listed as retained still use native `title`, each with a comment
   naming the reason. `MapCard.jsx:39` is unchanged.
3. `CONVENTIONS.md` states which tooltip applies to which case.
4. No control shows both tooltips at once — the native one is removed at the
   same site it is converted, in the same change.
5. `aria-label` is unchanged everywhere; every converted control keeps the
   accessible name it has today.
6. Share and delete are present and `aria-disabled` with the *Editing is off*
   tooltip when `known && !canWrite`, completing `adr/0034-*.md` criteria 11-12
   across the app. A draft's delete stays live. *(AC 11, 12)*
7. Every converted bubble is fully visible in the running app — not clipped by a
   panel edge, not under another layer — at a narrow window as well as a wide
   one, in both themes.
8. `yarn verify` green.
9. Verified by hand before the change is committed.

## Dependencies

Item `0001`. It converts four of these sites and establishes `.tt` on an
`aria-disabled` control, which criterion 6 here relies on.

---

## Outcome

Went in as scoped. The split the plan drew — 18 controls to convert, 8 sites to
leave — held, with two moves across the line, both because a bubble had nowhere
to go: the sort menu's direction arrows (rows 4px apart, so the tip covers the
option being compared against) and the colour swatches (22px circles wrapping at
a 7px gap, so a colour name is wider than its swatch). Both were named in the
plan as per-site judgements rather than mechanical replacements, which is what
made them decisions rather than surprises.

**The `overflow` case was real, not cautious.** The plan excluded the commit
popover's items on the grounds that placement inside a popover needs its own
thought. `.sp-list` carries `overflow-y: auto`, so a bubble is clipped by the
scroll container outright — the exclusion was right for a firmer reason than the
one written down.

**Two placement gaps in `.tt` surfaced only at the sites that needed them:**

`tt-end` is new. `tt-up` is left-aligned, correct for the status bar's left
edge, but `statusbar-spacer` pushes the changes indicator and preferences to the
other end, where a left-aligned bubble runs off the screen. Alignment was the
only difference, so it is a modifier on the modifier.

The map's panel toggle sits at `z-index: 1000` over the tiles while `.tt::after`
is at 60, so its own tooltip rendered behind the map — the same layering
`styles.css:728` already records for the note header. Raised locally to 1001.

**Share and delete close criteria 11-12.** Share reads the capability itself
rather than taking it threaded through `NoteView`; the button is the only part
that needs it. Delete keeps its draft exemption, which now has to be expressed
per-state rather than as one guard: a draft commits nothing, so it stays live
and untipped even when the deployment cannot write. The fade `0001` gave share
was removed with the same commit — it existed because share still arrived, and
it no longer does.

**`writeActionProps` gained class normalisation.** Call sites compose class
strings from templates with conditional segments, so an unselected modifier left
`class="badge share-btn   tt"` in the DOM. Cosmetic, caught in a test's rendered
output rather than by an assertion, and fixed at the helper since that is where
the join happens.

`TypeVisibility`'s toggle is genuinely `disabled` while its commit is in flight,
which suppresses its tooltip for that moment. Accepted and commented: there the
attribute is refusing a second click, not explaining a state — the opposite of
the write gating, where `disabled` was the wrong tool for exactly that reason.

The rule now lives in `CONVENTIONS.md`, which is what the plan identified as the
reason the migration had stalled halfway. Every retained native `title` carries
a comment naming which clause it falls under.

One test inverted: `offers sharing only when the deployment can write` asserted
the absence this item removes.

502 tests, `yarn verify` green.

---

Shipped at HEAD `40a9fac`. Not released — accumulating on `main` for a later
version.
