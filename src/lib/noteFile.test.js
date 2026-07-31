import { describe, expect, it } from 'vitest';
import { deriveTitle, draftFileContent, draftPath, slugify, uniquePath } from './noteFile.js';

describe('note file helpers (ADR 0023)', () => {
  it('derives the title from the first H1', () => {
    expect(deriveTitle('intro\n# My Note \n## Subtitle')).toBe('My Note');
    expect(deriveTitle('no heading')).toBe('');
  });

  it('slugifies titles and creates unique vault-root markdown paths', () => {
    expect(slugify('Café: già visto!')).toBe('cafe-gia-visto');
    expect(uniquePath('note', new Set(['note.md', 'note-2.md']))).toBe('note-3.md');
    expect(draftPath({ body: '# Hello World', type: 'Note' }, new Set())).toBe('hello-world.md');
  });

  it('serializes new note drafts with optional type frontmatter', () => {
    expect(draftFileContent({ type: 'Person', body: '\n# Ada' })).toBe('---\ntype: Person\n---\n\n# Ada');
    expect(draftFileContent({ type: null, body: '\n# Plain' })).toBe('# Plain');
  });
});
