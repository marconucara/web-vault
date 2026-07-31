import { describe, expect, it } from 'vitest';
import { transformWikilinks, wikilinkTargets } from './wikilinks.js';

describe('wikilinks (ADR 0008)', () => {
  const titleIndex = { alpha: 'notes/alpha', 'bravo note': 'bravo' };
  const idTitle = { 'notes/alpha': 'Alpha', bravo: 'Bravo Note' };

  it('turns resolved wikilinks into note hash links and keeps unresolved links as text', () => {
    expect(transformWikilinks('See [[alpha]] and [[missing]]', titleIndex, idTitle)).toBe(
      'See [Alpha](#/n/notes%2Falpha) and missing'
    );
  });

  it('uses aliases as display text for resolved and unresolved wikilinks', () => {
    expect(transformWikilinks('See [[bravo note|B]] and [[missing|M]]', titleIndex, idTitle)).toBe(
      'See [B](#/n/bravo) and M'
    );
  });

  it('extracts frontmatter relationship targets from strings and arrays', () => {
    expect(wikilinkTargets(['[[alpha]]', '[[missing|M]]'], titleIndex, idTitle)).toEqual([
      { text: 'Alpha', id: 'notes/alpha' },
      { text: 'M', id: null },
    ]);
  });
});
