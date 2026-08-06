# Checkbox lists on a share page show both a bullet and a checkbox

**Owning ADR(s):** `adr/0025-public-share-pages.md`
**Dependencies:** None

## Problem

A note with a task list renders differently on its public share page than in the
app, and worse: each item shows a list bullet *and* a checkbox.

The share page is built by the standalone renderer, which passes the body
through `react-markdown` + `remark-gfm`. GFM emits task lists as a normal `ul`
carrying marker classes:

    <ul class="contains-task-list">
    <li class="task-list-item"><input type="checkbox" disabled=""/> todo one</li>
    <li class="task-list-item"><input type="checkbox" disabled="" checked=""/> done two</li>
    <li>plain bullet</li>
    </ul>

The renderer carries its own inline copy of the stylesheet, and that copy styles
`.markdown ul` / `.markdown li` generically but has no rule for
`.contains-task-list` or `.task-list-item`. Nothing suppresses the `ul` marker,
so the browser paints the disc *and* the checkbox, with the label text
misaligned against the plain bullets in the same list.

In the app the same list is drawn by the block editor as a check-list item with
no bullet at all, so the two surfaces disagree on a note the owner has published.

## Decision on the target rendering

The share page matches what the owner sees in the editor, minus the ability to
change it. A task item renders as a checkbox reflecting the stored state, with
no list bullet, and a checked item strikes its label through exactly as the
editor does. The reader can therefore tell done from not-done at a glance — that
state is the content of the note.

What differs is only interactivity: the checkbox is not clickable, because a
share page is read-only and there is nowhere to write a toggle back to.
`remark-gfm` already emits the input as `disabled`, which is both
non-interactive and non-focusable, so the rules below keep that rather than
re-assert it.

## Scope

- Add task-list rules to the inline CSS in `scripts/shared-render.mjs`:
  - `.markdown .contains-task-list` drops the marker and keeps the text aligned
    with the surrounding plain bullets;
  - `.markdown .task-list-item` aligns the checkbox with the first line of the
    label;
  - a checked item's label is struck through, matching the editor;
  - the checkbox keeps a default (non-pointer) cursor, so it does not invite a
    click it will not honour.
- Add `scripts/shared-render.test.mjs` — the renderer has no test file today.

## Exit criteria

1. Rendering a note whose body contains `- [ ]` / `- [x]` items through
   `renderSharedPage` produces the GFM task-list markup, and the same page
   carries a rule targeting `.contains-task-list` that removes the list marker.
   The assertion is on the emitted page, so it fails if either the markup shape
   changes upstream or the rule is dropped.
2. A checked item is emitted with `checked` and an unchecked one without, so the
   reader can see which items are done; every task checkbox carries `disabled`,
   the read-only guarantee asserted rather than assumed.
3. A plain bullet in the same list keeps its marker: the fix must not turn every
   list into a markerless one.
4. `yarn verify` green.

## Out of scope

- Making the checkbox interactive on a share page, or writing a toggle back to
  the vault. A share page is read-only by decision.
- The identical gap in `src/styles.css`, whose `.markdown` block carries the
  same generic list rules and no task-list rules. It is latent today: nothing in
  `src/` renders with `className="markdown"` — the note view uses the block
  editor, not `src/components/Markdown.jsx`. Worth fixing when that component
  gains a caller.
- Extracting the duplicated stylesheet into one shared source. Real, and worth
  its own item — but it is a build-pipeline change touching every share page,
  not a bug fix, and doing it here would hide the fix inside a refactor.

## Outcome

Four CSS rules, no change to the renderer's logic. The markup was already right:
`remark-gfm` emits `checked` and `disabled` correctly, so the read-only
guarantee and the done/not-done state were never the defect — only the missing
rules were. The tests assert both anyway, since nothing else pins them.

Two cases the plan item did not anticipate, both found by reading the renderer's
real output rather than from the tests:

1. **An item with a sub-list.** `remark-gfm` nests the child `ul` *inside* the
   parent `li`, so a plain `line-through` on a checked parent struck every
   child with it, including unchecked ones — excluded with
   `:not(:has(ul,ol))`. The same nesting ruled out `display:flex` on the item,
   which would have laid the checkbox, the label and the sub-list out as
   siblings in a row; the item stays in flow layout and the checkbox is aligned
   with `vertical-align:middle`.
2. **A loose list.** A blank line between items makes remark wrap each label in
   a `<p>`, moving the checkbox from `li > input` to `li > p > input`. The first
   selector matched only the tight shape, so a checked item in a loose list was
   not struck through at all. Both shapes are now matched, and the checkbox
   itself is held at `text-decoration:none` because in the loose shape the
   strike lands on the `<p>` that also contains it.

`scripts/shared-render.test.mjs` is new — the renderer had no test file. It
asserts against the returned page, which carries markup and stylesheet in one
string, so a rule can be checked end to end without a browser: the GFM class
names are pinned (an upgrade that renames them fails here rather than silently
regressing the page), and each rule is asserted against the `<style>` block in
isolation so body text cannot satisfy it. 121 → 130 tests. Two of the first six
assertions were confirmed failing against the unmodified tree; the nested and
loose cases were written against selectors known to be missing.

**Shipped:** 2026-08-06 · HEAD 94df53d · ADR 0025 (already `Implemented`, no
status change; no version bump — rides along with a later release)
