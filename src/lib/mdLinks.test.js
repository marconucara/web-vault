import { describe, expect, it } from 'vitest';
import {
  bodyHasUnsafeForBlockNote,
  buildMapCardLine,
  createColorAssigner,
  createMapGrouper,
  mapUrlInLine,
  markerColor,
  parseMapCardLine,
  placeText,
} from './mdLinks.js';

describe('markdown link helpers (ADR 0013, ADR 0028)', () => {
  it('detects map card lines only when a Google Maps link starts the line', () => {
    expect(parseMapCardLine('- [Cafe](https://maps.google.com/place/foo) great coffee')).toMatchObject({
      marker: 'unordered',
      url: 'https://maps.google.com/place/foo',
      label: 'Cafe',
      desc: 'great coffee',
    });
    expect(mapUrlInLine('<https://maps.app.goo.gl/abc>')).toBe('https://maps.app.goo.gl/abc');
    expect(parseMapCardLine('Meet at https://maps.google.com/place/foo')).toBeNull();
  });

  it('groups contiguous map-link lists and assigns colors in first-seen order', () => {
    const group = createMapGrouper();
    expect(group('- https://maps.google.com/maps?q=1')).toBe(1);
    expect(group('- https://maps.google.com/maps?q=2')).toBe(1);
    expect(group('plain text')).toBe(0);
    expect(group('1. https://maps.google.com/maps?q=3')).toBe(2);

    const colorOf = createColorAssigner();
    expect(colorOf(2)).toBe(0);
    expect(colorOf(2)).toBe(0);
    expect(colorOf(0)).toBe(1);
    expect(markerColor(-1)).toBe(markerColor(7));
  });

  it('flags non-image media and attachment links as unsafe for BlockNote round-tripping', () => {
    expect(bodyHasUnsafeForBlockNote('[clip](attachments/a.mov)')).toBe(true);
    expect(bodyHasUnsafeForBlockNote('[pdf](file.pdf)')).toBe(true);
    expect(bodyHasUnsafeForBlockNote('![image](attachments/a.png)')).toBe(false);
    expect(bodyHasUnsafeForBlockNote('[note](other-note.md)')).toBe(false);
  });
});

// adr/0049-*.md: the link text is the card's TITLE and the text after the link
// is its DESCRIPTION, independently, whatever the build resolved.
describe("a place card's title and description (ADR 0049)", () => {
  const url = 'https://www.google.com/maps/search/Il+Ciolo+Gagliano+del+Capo';
  const resolved = { title: 'Il Ciolo', address: 'Gagliano del Capo' };
  const at = (line) => parseMapCardLine(line);

  // AC 1-3, over both axes: {link text present} × {Maps name resolved}. The
  // second row is the reported bug — the author's short name was dropped.
  it.each([
    ['neither', `- ${url}`, {}, url, null],
    ['link text and a resolved name', `- [Ciolo](${url}) ~30 min. Fiordo`, resolved, 'Ciolo', '~30 min. Fiordo'],
    ['link text, nothing resolved', `- [Ciolo](${url}) ~30 min. Fiordo`, {}, 'Ciolo', '~30 min. Fiordo'],
    ['no link text, a resolved name', `- ${url} ~30 min. Fiordo`, resolved, 'Il Ciolo', '~30 min. Fiordo'],
    ['link text only', `- [Ciolo](${url})`, resolved, 'Ciolo', null],
    ['description only', `- ${url} ~30 min.`, {}, url, '~30 min.'],
  ])('titles a card with %s', (_case, line, info, title, note) => {
    expect(placeText(at(line), info)).toEqual({ title, note });
  });

  it('never shows the link text as a description (AC 3)', () => {
    // The old rule demoted the label to a description whenever Maps resolved a
    // name, which is how one slot had to serve two purposes.
    expect(placeText(at(`- [Ciolo](${url})`), resolved).note).toBeNull();
  });

  it('resolves the title independently of what the build found (AC 2)', () => {
    const line = at(`- [Ciolo](${url}) ~30 min.`);
    expect(placeText(line, resolved)).toEqual(placeText(line, {}));
  });

  // AC 5-6: the editor writes all three fields and preserves the marker.
  it.each([
    ['both', { marker: 'unordered', url, title: 'Ciolo', desc: '~30 min.' }, `- [Ciolo](${url}) ~30 min.`],
    ['title only', { marker: 'unordered', url, title: 'Ciolo', desc: '' }, `- [Ciolo](${url})`],
    ['description only', { marker: 'unordered', url, title: '', desc: '~30 min.' }, `- ${url} ~30 min.`],
    ['neither', { marker: 'unordered', url, title: '', desc: '' }, `- ${url}`],
    ['an ordered marker', { marker: 'ordered', num: 3, url, title: 'Ciolo', desc: '' }, `3. [Ciolo](${url})`],
    ['no marker', { marker: null, url, title: 'Ciolo', desc: 'x' }, `[Ciolo](${url}) x`],
  ])('writes a line carrying %s', (_case, parts, expected) => {
    expect(buildMapCardLine(parts)).toBe(expected);
  });

  it('round-trips every combination through parse and rebuild (AC 6, AC 8)', () => {
    for (const line of [
      `- [Ciolo](${url}) ~30 min. Fiordo con ciottoli, **spettacolare**`,
      `- [Ciolo](${url})`,
      `- ${url} ~30 min.`,
      `- ${url}`,
      `3. [Ciolo](${url}) nota`,
    ]) {
      const p = parseMapCardLine(line);
      expect(buildMapCardLine({ ...p, title: p.label, desc: p.desc })).toBe(line);
    }
  });

  it('clearing the title drops the override rather than writing empty brackets', () => {
    const p = parseMapCardLine(`- [Ciolo](${url}) ~30 min.`);
    const line = buildMapCardLine({ ...p, title: '', desc: p.desc });
    expect(line).toBe(`- ${url} ~30 min.`);
    // And the card then falls back to the resolved name, per AC 2.
    expect(placeText(parseMapCardLine(line), resolved).title).toBe('Il Ciolo');
  });
});
