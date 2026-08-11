import { describe, expect, it } from 'vitest';
import { catalogues } from '../lib/i18n.js';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../lib/locale.js';

// The parity gate (adr/0047-ui-language-i18n-layer.md, criterion 12).
//
// This is the check that makes the missing-key behaviour safe to ship. A key
// with no translation renders as the key, which is the right signal while a
// catalogue is being written and the wrong thing for a reader to meet — so a
// gap fails `yarn verify` and never reaches a published build.
//
// It reads only files in this repository, which is what keeps the gate runnable
// from a bare clone (AGENTS.md).

/**
 * Dotted paths of every leaf string, so nesting in the file does not change
 * what is compared: `sidebar.allNotes` is the key either way.
 * @param {unknown} node
 * @param {string} [prefix]
 * @returns {string[]}
 */
function leafKeys(node, prefix = '') {
  if (node == null || typeof node !== 'object') return [prefix];
  return Object.entries(node).flatMap(([k, v]) => leafKeys(v, prefix ? `${prefix}.${k}` : k));
}

const reference = leafKeys(catalogues[DEFAULT_LOCALE]).sort();

describe('message catalogues', () => {
  it('ships one catalogue per supported locale', () => {
    expect(Object.keys(catalogues).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it('has a non-empty reference catalogue', () => {
    expect(reference.length).toBeGreaterThan(0);
  });

  for (const locale of SUPPORTED_LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;

    it(`\`${locale}\` covers every key in \`${DEFAULT_LOCALE}\``, () => {
      const keys = leafKeys(catalogues[locale]).sort();
      const missing = reference.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !reference.includes(k));
      // Named rather than counted: the point of the failure is to say which.
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });

    it(`\`${locale}\` has no empty or placeholder values`, () => {
      const blanks = Object.entries(flatten(catalogues[locale]))
        .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
        .map(([k]) => k);
      expect(blanks).toEqual([]);
    });

    it(`\`${locale}\` keeps every interpolation placeholder`, () => {
      // A translation that drops `{{name}}` loses the value silently — the
      // sentence still renders, just without the thing it was about.
      const src = flatten(catalogues[DEFAULT_LOCALE]);
      const dst = flatten(catalogues[locale]);
      const mismatched = Object.keys(src).filter(
        (k) => placeholders(src[k]).join() !== placeholders(dst[k]).join()
      );
      expect(mismatched).toEqual([]);
    });
  }
});

/**
 * @param {unknown} node
 * @param {string} [prefix]
 * @returns {Record<string, string>}
 */
function flatten(node, prefix = '') {
  if (node == null || typeof node !== 'object') return { [prefix]: /** @type {string} */ (node) };
  return Object.assign(
    {},
    ...Object.entries(node).map(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
  );
}

/** @param {string} s */
function placeholders(s) {
  return typeof s === 'string' ? (s.match(/\{\{\s*\w+\s*\}\}/g) || []).sort() : [];
}
