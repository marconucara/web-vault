// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The panel's rendered states (adr/0045). What it COMMITS is covered by
// lib/typeCommit.test.js; this file asserts the guards the user actually sees:
// delete blocked while notes carry the type, and the name check that lets a
// create adopt a type the notes already use.
vi.mock('../content.js', () => ({ build: null, notes: [], titleIndex: {}, idTitle: {}, maps: {} }));

const { default: TypePanel } = await import('./TypePanel.jsx');

const note = (title, type) => ({
  id: title.toLowerCase(),
  path: `${title.toLowerCase()}.md`,
  title,
  type,
  frontmatter: { type },
});
const doc = {
  id: 'person',
  path: 'person.md',
  title: 'Person',
  type: 'Type',
  frontmatter: { type: 'Type', icon: 'user' },
  body: '\n# Person\n\nPeople I know.\n',
};

const render = (props) =>
  renderToStaticMarkup(
    <TypePanel
      mode="edit"
      typeName="Person"
      meta={{ icon: 'user', color: null, order: null, path: 'person.md' }}
      doc={doc}
      declared={new Set(['Person'])}
      notes={[doc]}
      onClose={() => {}}
      {...props}
    />
  );

describe('TypePanel (ADR 0045)', () => {
  it('blocks delete and states how many notes stand in the way', () => {
    const html = render({ notes: [doc, note('Ada', 'Person'), note('Grace', 'Person')] });
    // Criterion 9: the count is shown, and no delete button is offered.
    expect(html).toContain('2 notes use this type');
    expect(html).not.toContain('Delete type');
  });

  it('uses the singular for a single note in the way', () => {
    const html = render({ notes: [doc, note('Ada', 'Person')] });
    expect(html).toContain('1 note uses this type');
  });

  it('offers delete when nothing carries the type', () => {
    const html = render({ notes: [doc] });
    expect(html).toContain('Delete');
    expect(html).not.toContain('uses this type');
  });

  it('prefills the form from the document, description included', () => {
    const html = render({});
    // Criterion 5: the panel opens prefilled from the Type document.
    expect(html).toContain('value="Person"');
    expect(html).toContain('People I know.');
  });

  it('opens for creation with empty fields', () => {
    const html = render({ mode: 'create', typeName: null, meta: null, doc: null });
    // Criterion 3: everything empty or defaulted, and no delete affordance.
    expect(html).toContain('Create type');
    expect(html).toContain('value=""');
    expect(html).not.toContain('uses this type');
  });

  it('prefills the name for a type only the notes carry, and creates rather than edits', () => {
    // Criteria 5 and 8: 'Idea' is in use but undeclared — no document to edit.
    const html = render({
      mode: 'edit',
      typeName: 'Idea',
      meta: null,
      doc: null,
      declared: new Set(['Person']),
      notes: [doc, note('Spark', 'Idea')],
    });
    expect(html).toContain('value="Idea"');
    // The name is not reported as taken, so saving is allowed.
    expect(html).not.toContain('already exists');
  });
});
