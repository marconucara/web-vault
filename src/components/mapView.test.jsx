// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

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

// The headings sidebar is docked to the map's top-right corner by `position:
// absolute` + `top/right`. `.tt` — the tooltip class the button also carries —
// declares `position: relative` for its own `::after`, later in the file and at
// the same specificity, so it WINS: the offsets stop anchoring and the control
// falls back into the flow at the top-left, over Leaflet's zoom control.
//
// The cascade is what is under test, so this reads the stylesheet rather than
// the DOM: jsdom resolves no layout, and the bug is invisible to it. The rule
// is general — `.scope-toggle` needed the same correction — so every absolutely
// positioned control that also carries `.tt` is checked, not just this one.
describe('an absolutely positioned .tt control keeps its corner (ADR 0028 AC 4)', () => {
  const css = readFileSync('src/styles.css', 'utf8');

  // Class selectors declaring `position: absolute` in their own block.
  const absolute = new Set();
  for (const m of css.matchAll(/^\.([\w-]+)\s*\{([^}]*)\}/gms)) {
    if (/position:\s*absolute/.test(m[2])) absolute.add(m[1]);
  }

  // `.tt` must come later than the blocks above for this to bite at all — if it
  // ever moves earlier the re-assertions become redundant rather than wrong.
  it('declares .tt { position: relative } after the controls it can override', () => {
    expect(css.indexOf('.tt { position: relative; }')).toBeGreaterThan(0);
  });

  it.each(['mapview-panel-toggle', 'scope-toggle'])(
    '.%s re-asserts absolute against .tt',
    (cls) => {
      expect(absolute.has(cls)).toBe(true);
      expect(css).toMatch(
        new RegExp(`\\.${cls}\\.tt\\s*\\{[^}]*position:\\s*absolute`)
      );
    }
  );

  // Catches the next control that walks into this: any class that is positioned
  // absolutely and is used together with `.tt` in a component must re-assert it.
  it('no absolutely positioned class carries .tt without re-asserting it', () => {
    const sources = [
      'src/components/MapView.jsx',
      'src/components/NoteList.jsx',
    ].filter((f) => {
      try {
        readFileSync(f);
        return true;
      } catch {
        return false;
      }
    });
    const offenders = [];
    for (const file of sources) {
      const src = readFileSync(file, 'utf8');
      // Every className string, split into its class tokens — matching on the
      // raw string would let `mapview-panel` borrow the `tt` that belongs to
      // `mapview-panel-toggle`.
      const classLists = [...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
        .map((m) => (m[1] ?? m[2]).split(/[\s${}]+/).filter(Boolean));
      for (const cls of absolute) {
        const used = classLists.some((l) => l.includes(cls) && l.includes('tt'));
        if (!used) continue;
        if (!new RegExp(`\\.${cls}\\.tt\\s*\\{[^}]*position:\\s*absolute`).test(css)) {
          offenders.push(`${cls} (${file})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
