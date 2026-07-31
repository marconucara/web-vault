import { describe, expect, it } from 'vitest';
import { filterNotes, sortNotes } from './views.js';

const notes = [
  { title: 'Bravo', type: 'Task', body: 'beta', mtime: 20, ctime: 5, frontmatter: { status: 'open', tags: ['x'] } },
  { title: 'alpha', type: 'Note', body: 'alpha body', mtime: 10, ctime: 1, frontmatter: { Status: 'done', tags: ['y'] } },
  { title: 'Charlie', type: 'Task', body: 'gamma', mtime: 30, ctime: 3, frontmatter: { status: '', tags: [] } },
];

describe('Tolaria view evaluator (ADR 0007)', () => {
  it('filters with nested all/any nodes', () => {
    const view = {
      filters: {
        all: [
          { field: 'type', op: 'equals', value: 'Task' },
          { any: [
            { field: 'status', op: 'equals', value: 'open' },
            { field: 'title', op: 'contains', value: 'Charlie' },
          ] },
        ],
      },
    };
    expect(filterNotes(notes, view).map((n) => n.title)).toEqual(['Bravo', 'Charlie']);
  });

  it('sorts by known fields and frontmatter properties', () => {
    expect(sortNotes(notes, 'title:asc').map((n) => n.title)).toEqual(['alpha', 'Bravo', 'Charlie']);
    expect(sortNotes(notes, 'modified:desc').map((n) => n.title)).toEqual(['Charlie', 'Bravo', 'alpha']);
    expect(sortNotes(notes, 'property:status:asc').map((n) => n.title)).toEqual(['alpha', 'Charlie', 'Bravo']);
  });
});
