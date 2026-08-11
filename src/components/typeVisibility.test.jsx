// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// What the visibility manager RENDERS (adr/0046). What a toggle commits is
// covered by lib/typeCommit.test.js and functions/commit.test.js; this file
// asserts the property that makes the surface worth having — a hidden type is
// still listed, so it can be found and switched back on.
vi.mock('../content.js', () => ({ build: null, notes: [], titleIndex: {}, idTitle: {}, maps: {} }));

const { default: TypeVisibility } = await import('./TypeVisibility.jsx');

const typeDoc = (title, frontmatter = {}) => ({
  id: title.toLowerCase(),
  path: `${title.toLowerCase()}.md`,
  title,
  type: 'Type',
  frontmatter: { type: 'Type', ...frontmatter },
});

const meta = {
  Type: { icon: null, color: null, order: 0, visible: false, path: 'type.md' },
  Person: { icon: 'user', color: null, order: 1, visible: true, path: 'person.md' },
  Idea: { icon: null, color: null, order: null, visible: true, path: null },
};

const render = (props) =>
  renderToStaticMarkup(
    <TypeVisibility
      types={['Type', 'Person', 'Idea']}
      typeMeta={meta}
      notes={[typeDoc('Type', { visible: false }), typeDoc('Person', { icon: 'user' })]}
      onClose={() => {}}
      {...props}
    />
  );

describe('TypeVisibility (ADR 0046)', () => {
  it('lists hidden types alongside visible ones (criterion 4)', () => {
    // The whole point of a separate surface: hiding a type must not remove the
    // way back to it. `Type` is hidden and still has a row.
    const html = render();
    expect(html).toContain('Type');
    expect(html).toContain('Person');
    expect(html).toContain('Idea');
  });

  it('shows each row switched to match its visibility', () => {
    const html = render();
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-checked="true"');
    // The action offered names the direction it goes.
    expect(html).toContain('Show Type');
    expect(html).toContain('Hide Person');
  });

  it('treats Type as an ordinary row, with no special case (criterion 9)', () => {
    const html = render();
    const rows = html.match(/class="tv-row/g) || [];
    expect(rows).toHaveLength(3);
  });

  it('carries no note counts (criterion 11)', () => {
    // A row answers "shown or hidden". A count invites the different question of
    // whether hiding is wise, which belongs to the type panel.
    expect(render()).not.toContain('class="count"');
  });

  it('lists a type no document declares, so it can be hidden too (criterion 8)', () => {
    // `Idea` has no path: toggling it adopts the type by creating its document.
    expect(render()).toContain('Idea');
  });

  it('says so when the vault has no types at all', () => {
    expect(render({ types: [] })).toContain('no types yet');
  });
});
