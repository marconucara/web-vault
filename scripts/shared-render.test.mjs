import { describe, it, expect } from 'vitest';
import { renderSharedPage } from './shared-render.mjs';

// A share page is one self-contained HTML string: markup and stylesheet travel
// together, so a rendering rule can be asserted end to end without a browser —
// the markup shape and the rule that styles it are both in the returned page.
function pageWithBody(body) {
  const note = {
    id: 'tasks',
    path: 'tasks.md',
    title: 'Tasks',
    body,
    frontmatter: { share_id: 'abc123' },
  };
  return renderSharedPage(
    { notes: [note], titleIndex: {}, idTitle: {}, maps: {} },
    'abc123',
  );
}

// The style block, isolated: asserting a rule exists must not be satisfied by
// the same text appearing in the body.
function cssOf(page) {
  return page.match(/<style>([\s\S]*?)<\/style>/)[1];
}

describe('share page task lists', () => {
  const BODY = '- [ ] todo one\n- [x] done two\n- plain bullet\n';

  it('renders the GFM task-list markup the stylesheet targets', () => {
    const page = pageWithBody(BODY);
    // Pins the shape remark-gfm emits. If an upgrade changes these class names
    // the rules below stop applying, and this fails instead of the page
    // silently regressing to bullet-plus-checkbox.
    expect(page).toContain('<ul class="contains-task-list">');
    expect(page).toContain('<li class="task-list-item">');
  });

  it('suppresses the list marker on a task list', () => {
    const css = cssOf(pageWithBody(BODY));
    expect(css).toMatch(/\.contains-task-list\b[^{]*\{[^}]*list-style\s*:\s*none/);
  });

  it('leaves a plain bullet in the same list with its marker', () => {
    const page = pageWithBody(BODY);
    // The plain item carries no task-list class, so the marker-removal rule
    // cannot reach it: the fix is scoped to task items, not to every list.
    expect(page).toContain('<li>plain bullet</li>');
    const css = cssOf(page);
    expect(css).not.toMatch(/\.markdown ul\b[^{]*\{[^}]*list-style\s*:\s*none/);
  });

  it('shows which items are done', () => {
    const page = pageWithBody(BODY);
    const boxes = page.match(/<input type="checkbox"[^>]*\/>/g);
    expect(boxes).toHaveLength(2);
    // Order follows the body: first item open, second checked.
    expect(boxes[0]).not.toContain('checked');
    expect(boxes[1]).toContain('checked=""');
  });

  it('keeps every checkbox read-only', () => {
    // A share page has nowhere to write a toggle back to, so no task checkbox
    // may be interactive.
    for (const box of pageWithBody(BODY).match(/<input type="checkbox"[^>]*\/>/g)) {
      expect(box).toContain('disabled=""');
    }
  });

  it('strikes through a checked item, matching the editor', () => {
    const css = cssOf(pageWithBody(BODY));
    expect(css).toMatch(/:checked[^{]*\{[^}]*line-through/);
  });

  it('does not strike a checked item that nests a sub-list', () => {
    // remark-gfm nests the child `ul` *inside* the parent `li`, so a bare
    // line-through on the parent would strike every child too — including the
    // unchecked ones. The rule excludes items carrying a nested list.
    const page = pageWithBody('- [x] done parent\n  - [ ] nested child\n');
    expect(page).toMatch(/<li class="task-list-item">[\s\S]*<ul class="contains-task-list">/);
    expect(cssOf(page)).toMatch(/:has\(> input:checked\):not\(:has\(ul,ol\)\)/);
  });

  it('strikes a checked item in a loose list, where the label is wrapped in a <p>', () => {
    // A blank line between items makes the list loose and remark wraps each
    // label: the checkbox moves from `li > input` to `li > p > input`, which a
    // single child-combinator rule would miss.
    const page = pageWithBody('- [x] done two\n\n- [ ] todo one\n');
    expect(page).toMatch(/<li class="task-list-item">\s*<p><input type="checkbox"/);
    expect(cssOf(page)).toMatch(/:has\(> p > input:checked\)/);
  });

  it('keeps a task item in flow layout so a nested list stays below it', () => {
    // Flex on the item would lay the checkbox, the label and the nested list
    // out as siblings in a row.
    expect(cssOf(pageWithBody(BODY))).not.toMatch(/\.task-list-item\s*\{[^}]*display\s*:\s*flex/);
  });
});
