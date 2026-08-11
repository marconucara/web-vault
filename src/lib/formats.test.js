import { afterEach, describe, expect, it } from 'vitest';
import { initI18n, setFormatLocale } from './i18n.js';
import { clockTime, longDate, numericDate, shortDate } from './formats.js';

// adr/0047-ui-language-i18n-layer.md, criterion 10.
//
// The first test is the reason the formatting locale is resolved separately at
// all: it pins the output that a language-only `en` would have silently changed.

const AUG_11 = Date.UTC(2026, 7, 11, 12, 30);

afterEach(() => initI18n());

describe('date formatting follows the formatting locale', () => {
  it('keeps the UK reader on `11 Aug 2026` (the regression this prevents)', () => {
    expect(shortDate(AUG_11, 'en-GB')).toBe('11 Aug 2026');
    // What a bare `en` would have produced instead, had formatting been derived
    // from the interface language.
    expect(shortDate(AUG_11, 'en')).toBe('Aug 11, 2026');
  });

  it('formats in Italian when the formatting locale is Italian', () => {
    expect(shortDate(AUG_11, 'it-IT')).toBe('11 ago 2026');
    expect(longDate(AUG_11, 'it-IT')).toBe('11 agosto 2026');
  });

  it('spells the month out in the long form', () => {
    expect(longDate(AUG_11, 'en-GB')).toBe('11 August 2026');
  });

  it('uses the locale’s own numeric order', () => {
    expect(numericDate(AUG_11, 'en-GB')).toBe('11/08/2026');
    expect(numericDate(AUG_11, 'en-US')).toBe('8/11/26');
  });

  it('renders an em dash for a missing timestamp rather than an epoch date', () => {
    expect(shortDate(null, 'en-GB')).toBe('—');
    expect(longDate(undefined, 'en-GB')).toBe('—');
    expect(numericDate(0, 'en-GB')).toBe('—');
    expect(clockTime(null, 'en-GB')).toBe('—');
  });

  it('defaults to the locale in force, so a change reaches every call site', () => {
    initI18n({ formatLocale: 'en-GB' });
    expect(shortDate(AUG_11)).toBe('11 Aug 2026');
    setFormatLocale('it-IT');
    expect(shortDate(AUG_11)).toBe('11 ago 2026');
  });
});
