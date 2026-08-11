import { describe, expect, it } from 'vitest';
import {
  slugsForHeadings,
  headingSlug,
  parseNoteHash,
  noteHash,
  isBareAnchor,
  anchorOf,
} from './headingSlug.js';

// adr/0044-what-the-url-addresses.md — the slug rule is a compatibility surface:
// once an author writes [jump](#a-heading) in a note, these outputs cannot
// change without breaking links in content this product cannot migrate.
describe('the slug rule', () => {
  it('lowercases, hyphenates spaces, and drops punctuation', () => {
    expect(headingSlug('Getting Started')).toBe('getting-started');
    expect(headingSlug('What is it, really?')).toBe('what-is-it-really');
    expect(headingSlug('Already-hyphenated words')).toBe('already-hyphenated-words');
  });

  it('drops emoji but keeps the words around them', () => {
    expect(headingSlug('🚀 Launch day')).toBe('-launch-day');
  });

  it('keeps a variation selector, exactly as GitHub does', () => {
    // `🗺️` (a real starter-template heading) is U+1F5FA + U+FE0F. The pictograph
    // is stripped but the variation selector is not — it is not punctuation, so
    // the rule keeps it, and the slug therefore opens with an invisible
    // character. Surprising enough to pin: this is the ecosystem's output, and
    // matching it is the whole point of adopting the rule rather than inventing
    // one. An author copying the anchor from a rendered page gets it right; one
    // typing `#-drop-a-place-on-the-map` by hand does not, which is a reason to
    // avoid emoji in headings you intend to link to, not to diverge here.
    const slug = headingSlug('🗺️ Drop a place on the map');
    expect(slug).toBe('️-drop-a-place-on-the-map');
    expect(slug.normalize('NFKD').replace(/[︀-️]/g, '')).toBe('-drop-a-place-on-the-map');
  });

  it('keeps non-ASCII letters rather than transliterating them', () => {
    expect(headingSlug('Città e paesi')).toBe('città-e-paesi');
    expect(headingSlug('Übersicht')).toBe('übersicht');
  });

  it('cannot produce a slug that collides with the app route grammar', () => {
    // AC 6: `/` is stripped, so no heading can slugify into something starting
    // with `/` and hijack `#/n/...` navigation.
    for (const text of ['/n/notes/alpha', '/', '// comment', 'a/b/c']) {
      expect(headingSlug(text).startsWith('/')).toBe(false);
      expect(headingSlug(text)).not.toContain('/');
    }
  });
});

describe('duplicate headings', () => {
  it('get stable suffixes in document order', () => {
    expect(slugsForHeadings(['Setup', 'Usage', 'Setup', 'Setup'])).toEqual([
      'setup',
      'usage',
      'setup-1',
      'setup-2',
    ]);
  });

  it('numbers per document, so a second note starts over', () => {
    expect(slugsForHeadings(['Setup', 'Setup'])).toEqual(['setup', 'setup-1']);
    expect(slugsForHeadings(['Setup'])).toEqual(['setup']);
  });
});

describe('the note hash grammar', () => {
  it('round-trips a note id with no anchor', () => {
    expect(parseNoteHash(noteHash('notes/alpha'))).toEqual({ id: 'notes/alpha', anchor: null });
  });

  it('round-trips a note id with an anchor', () => {
    expect(parseNoteHash(noteHash('notes/alpha', 'setup-1'))).toEqual({
      id: 'notes/alpha',
      anchor: 'setup-1',
    });
  });

  it('does not mistake a # inside a note id for the anchor separator', () => {
    // A note id is its vault path minus `.md`, so `C# tips.md` is a real file.
    // The id is percent-encoded in the URL, which is what keeps the split
    // unambiguous — this pins that it stays that way.
    const hash = noteHash('notes/C# tips', 'syntax');
    expect(hash).not.toContain('C# ');
    expect(parseNoteHash(hash)).toEqual({ id: 'notes/C# tips', anchor: 'syntax' });
  });

  it('reads anything that is not a note route as no note open', () => {
    for (const h of ['#/', '', '#', '#some-heading', '#/views/x']) {
      expect(parseNoteHash(h)).toEqual({ id: null, anchor: null });
    }
  });
});

describe('bare anchors', () => {
  it('recognises what an author writes', () => {
    expect(isBareAnchor('#setup')).toBe(true);
    expect(anchorOf('#setup')).toBe('setup');
  });

  it('is not fooled by app routes or external links', () => {
    for (const href of ['#/n/notes%2Falpha', '#/', '#', '', 'https://example.com', '/x']) {
      expect(isBareAnchor(href)).toBe(false);
      expect(anchorOf(href)).toBe(null);
    }
  });

  it('decodes an escaped anchor, and survives a malformed one', () => {
    expect(anchorOf('#a%20b')).toBe('a b');
    expect(anchorOf('#100%')).toBe('100%');
  });
});
