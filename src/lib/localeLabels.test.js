import { describe, expect, it } from 'vitest';
import { FORMAT_LOCALES, SUPPORTED_LOCALES, languageLabel, regionLabel } from './locale.js';
import { formatSample } from './formats.js';
import { formatOptionLabel } from '../components/Preferences.jsx';

// Labels for the two selectors in preferences (adr/0034, criteria 2-3).
// Both are built from `Intl` rather than written by hand, so a locale added
// later names itself; these tests pin the shape of what it produces.

describe('language labels', () => {
  it('names each language in its own language, capitalised', () => {
    expect(languageLabel('en')).toBe('English');
    // `Intl` returns `italiano`: correct prose, wrong in a list of choices.
    expect(languageLabel('it')).toBe('Italiano');
  });

  it('falls back to the code for a language Intl cannot name', () => {
    expect(languageLabel('zz')).toBe('zz');
  });

  it('labels every shipped catalogue with something other than its code', () => {
    // The guard against shipping a locale whose picker entry reads `de`.
    for (const code of SUPPORTED_LOCALES) {
      expect(languageLabel(code)).not.toBe(code);
    }
  });
});

describe('region labels', () => {
  it('names the region in the language being read', () => {
    expect(regionLabel('en-GB', 'en')).toBe('United Kingdom');
    expect(regionLabel('en-GB', 'it')).toBe('Regno Unito');
  });

  it('is null for a tag carrying no region', () => {
    expect(regionLabel('en', 'en')).toBe(null);
  });
});

describe('format samples', () => {
  // The sample IS the choice being made, so these strings are the feature.
  it('shows each locale its own way', () => {
    expect(formatSample('en-US')).toBe('Aug 11, 2026, 2:30 PM');
    expect(formatSample('en-GB')).toBe('11 Aug 2026, 14:30');
  });

  // Rendered in UTC, unlike every other date in the app: this one illustrates a
  // format rather than naming a moment, so 14:30 has to stay 14:30 wherever it
  // is read — otherwise the 12h/24h contrast lands on a different hour per
  // reader, and this test would depend on the machine's zone.
  it('does not shift with the reader’s time zone', () => {
    expect(formatSample('en-GB')).toContain('14:30');
  });

  it('gives every curated entry a distinguishable label', () => {
    const labels = FORMAT_LOCALES.map((tag) => formatOptionLabel(tag, 'en'));
    expect(new Set(labels).size).toBe(FORMAT_LOCALES.length);
  });

  it('pairs the region with the sample', () => {
    expect(formatOptionLabel('en-GB', 'en')).toBe('United Kingdom — 11 Aug 2026, 14:30');
  });

  it('falls back to the tag when the region cannot be named', () => {
    expect(formatOptionLabel('en', 'en')).toBe(`en — ${formatSample('en')}`);
  });
});
