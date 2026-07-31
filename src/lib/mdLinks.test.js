import { describe, expect, it } from 'vitest';
import {
  bodyHasUnsafeForBlockNote,
  createColorAssigner,
  createMapGrouper,
  mapUrlInLine,
  markerColor,
  parseMapCardLine,
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
