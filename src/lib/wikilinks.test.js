import { describe, expect, it } from 'vitest';
import { resolveTargetAnchor, wikilinkTargets } from './wikilinks.js';

describe('wikilinks (ADR 0008)', () => {
  const titleIndex = { alpha: 'notes/alpha', 'bravo note': 'bravo' };
  const idTitle = { 'notes/alpha': 'Alpha', bravo: 'Bravo Note' };

  it('extracts frontmatter relationship targets from strings and arrays', () => {
    expect(wikilinkTargets(['[[alpha]]', '[[missing|M]]'], titleIndex, idTitle)).toEqual([
      { text: 'Alpha', id: 'notes/alpha', anchor: null },
      { text: 'M', id: null, anchor: null },
    ]);
  });

  it('carries an anchor on a frontmatter relationship target', () => {
    expect(wikilinkTargets('[[alpha#intro]]', titleIndex, idTitle)).toEqual([
      { text: 'Alpha', id: 'notes/alpha', anchor: 'intro' },
    ]);
  });
});

// The note half is resolved by 0008's rules; the anchor is carried through
// unresolved (adr/0044-what-the-url-addresses.md, criterion 15).
describe('resolveTargetAnchor (ADR 0044 r6)', () => {
  const titleIndex = {
    alpha: 'notes/alpha',
    'notes/alpha': 'notes/alpha',
    'bravo note': 'bravo',
    'c# tips': 'notes/c# tips',
    'c# tips#heading': 'notes/decoy',
  };

  it('resolves a bare target with no anchor', () => {
    expect(resolveTargetAnchor('alpha', titleIndex)).toEqual({ id: 'notes/alpha', anchor: null });
  });

  it('resolves all three target forms with an anchor appended', () => {
    for (const t of ['notes/alpha', 'Alpha'.toLowerCase(), 'alpha']) {
      expect(resolveTargetAnchor(`${t}#some-heading`, titleIndex)).toEqual({
        id: 'notes/alpha',
        anchor: 'some-heading',
      });
    }
  });

  // Obsidian's link picker inserts the heading TEXT, not the slug, so both forms
  // have to land — and the slug form must be untouched by the normalisation.
  it('accepts the heading text as well as the slug', () => {
    expect(resolveTargetAnchor('alpha#My Heading', titleIndex).anchor).toBe('my-heading');
    expect(resolveTargetAnchor('alpha#my-heading', titleIndex).anchor).toBe('my-heading');
  });

  it('leaves an accented heading text as the anchor rule renders it', () => {
    expect(resolveTargetAnchor('alpha#Ciò che è già così', titleIndex).anchor).toBe(
      'ciò-che-è-già-così'
    );
  });

  it('leaves an unresolvable note half unresolved, anchor or no anchor', () => {
    expect(resolveTargetAnchor('missing', titleIndex)).toEqual({ id: null, anchor: null });
    expect(resolveTargetAnchor('missing#heading', titleIndex)).toEqual({ id: null, anchor: 'heading' });
  });

  // A note id may itself contain a `#`, so the whole string is looked up before
  // any split — otherwise `[[C# tips]]` would stop resolving.
  it('prefers the whole target when a note id contains a #', () => {
    expect(resolveTargetAnchor('C# tips', titleIndex)).toEqual({ id: 'notes/c# tips', anchor: null });
    expect(resolveTargetAnchor('C# tips#heading', titleIndex)).toEqual({
      id: 'notes/decoy',
      anchor: null,
    });
    const partial = { 'c# tips': 'notes/c# tips' };
    expect(resolveTargetAnchor('C# tips#heading', partial)).toEqual({
      id: 'notes/c# tips',
      anchor: 'heading',
    });
  });

  // Splitting at the LAST `#` sends a heading path somewhere inert, which is the
  // same outcome as any anchor matching nothing.
  it('splits at the last #', () => {
    expect(resolveTargetAnchor('alpha#a#b', titleIndex)).toEqual({ id: null, anchor: 'b' });
  });

  it('does not split a same-note anchor or an empty anchor', () => {
    expect(resolveTargetAnchor('#heading', titleIndex)).toEqual({ id: null, anchor: null });
    expect(resolveTargetAnchor('alpha#', titleIndex)).toEqual({ id: null, anchor: null });
  });
});
