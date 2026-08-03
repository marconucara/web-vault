// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

// `collectPoints` reads the build-time resolution table. Stub it so each case
// states exactly what the resolver did or did not manage to find.
vi.mock('../content.js', () => ({
  maps: {
    'https://maps.app.goo.gl/resolved': {
      title: 'Colosseo',
      address: 'P.za del Colosseo, 1, Roma',
      image: 'https://lh3.googleusercontent.com/p/photo',
      lat: 41.8902,
      lng: 12.4922,
    },
    // Coordinates but nothing else: a link the resolver placed without naming.
    'https://maps.app.goo.gl/coords-only': { lat: 45.4642, lng: 9.19 },
  },
}));

const { collectPoints } = await import('./MapView.jsx');

// ADR 0028 AC 7: every Maps link is supported. Resolution only ever adds to a
// link — it never removes one. What the resolver could not find degrades the
// card or drops the marker; the author's link and text always survive.
describe('map links degrade rather than disappear (ADR 0028 AC 7)', () => {
  it('plots a fully resolved link with the place data', () => {
    const { points, missing } = collectPoints('1. https://maps.app.goo.gl/resolved\n');
    expect(missing).toEqual([]);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ title: 'Colosseo', num: 1 });
    expect(points[0].image).toBeTruthy();
  });

  it('plots a link that resolved to coordinates but no name or photo', () => {
    const { points, missing } = collectPoints(
      '1. [Somewhere worth remembering](https://maps.app.goo.gl/coords-only)\n'
    );
    expect(missing).toEqual([]);
    expect(points).toHaveLength(1);
    // No title came back, so the card falls back to the author's own link text
    // rather than showing nothing — and the marker is still placed.
    expect(points[0].title).toBe('Somewhere worth remembering');
    expect(points[0].image).toBeNull();
  });

  it('keeps an entirely unresolved link, counting it as missing coordinates', () => {
    const { points, missing } = collectPoints(
      '1. [Pantheon — go early](https://www.google.com/maps/search/?api=1&query=Pantheon+Rome)\n'
    );
    // Nothing was resolved, so there is no marker to place — but the link is
    // reported, not silently dropped, and the note itself is untouched.
    expect(points).toEqual([]);
    expect(missing).toEqual(['Pantheon — go early']);
  });

  it('groups resolved and unresolved links from the same note independently', () => {
    const { points, missing } = collectPoints(
      [
        '## Day 1',
        '1. https://maps.app.goo.gl/resolved',
        '2. [Not found](https://www.google.com/maps/search/?api=1&query=Nowhere)',
        '',
      ].join('\n')
    );
    expect(points).toHaveLength(1);
    expect(points[0].heading).toBe('Day 1');
    expect(missing).toEqual(['Not found']);
  });
});
