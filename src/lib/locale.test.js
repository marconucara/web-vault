import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  browserLanguages,
  isSupportedLocale,
  isWellFormedTag,
  languageOf,
  resolveFormatLocale,
  resolveInterfaceLocale,
} from './locale.js';

// adr/0047-ui-language-i18n-layer.md, criteria 3-6 and 10-11. The rules are pure
// functions precisely so they can be stated here without a browser.

describe('language matching', () => {
  it('ships English and Italian, with English as the reference', () => {
    expect([...SUPPORTED_LOCALES]).toEqual(['en', 'it']);
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('strips the region subtag (AC 4)', () => {
    expect(languageOf('it-CH')).toBe('it');
    expect(languageOf('en-GB')).toBe('en');
    expect(languageOf('IT')).toBe('it');
    // Some platforms still emit the underscore form.
    expect(languageOf('pt_BR')).toBe('pt');
  });

  it('has no language for a non-string or empty tag', () => {
    expect(languageOf(null)).toBe(null);
    expect(languageOf('   ')).toBe(null);
    expect(languageOf(42)).toBe(null);
  });

  it('supports a tag when its LANGUAGE is one we ship', () => {
    expect(isSupportedLocale('it-CH')).toBe(true);
    expect(isSupportedLocale('fr-FR')).toBe(false);
  });
});

describe('interface locale resolution', () => {
  it('takes an injected locale over the browser (AC 5a)', () => {
    expect(resolveInterfaceLocale({ injected: 'it', preferred: ['en-GB'] })).toBe('it');
  });

  it('accepts an injected locale carrying a region (AC 4)', () => {
    expect(resolveInterfaceLocale({ injected: 'it-CH' })).toBe('it');
  });

  it("falls THROUGH an unsupported injected locale to the browser, not to English (AC 6)", () => {
    expect(resolveInterfaceLocale({ injected: 'fr', preferred: ['it-IT'] })).toBe('it');
    expect(resolveInterfaceLocale({ injected: 'not a tag', preferred: ['it'] })).toBe('it');
  });

  it("honours the browser's own order (AC 5b)", () => {
    expect(resolveInterfaceLocale({ preferred: ['it-IT', 'en-GB'] })).toBe('it');
    expect(resolveInterfaceLocale({ preferred: ['en-GB', 'it-IT'] })).toBe('en');
  });

  it('skips preferences we ship no catalogue for', () => {
    expect(resolveInterfaceLocale({ preferred: ['fr-FR', 'de', 'it'] })).toBe('it');
  });

  it('falls back to English when nothing matches (AC 5c)', () => {
    expect(resolveInterfaceLocale({ preferred: ['fr', 'de'] })).toBe('en');
    expect(resolveInterfaceLocale({})).toBe('en');
    expect(resolveInterfaceLocale()).toBe('en');
  });
});

describe('formatting locale resolution', () => {
  it("KEEPS the region, unlike the interface match (AC 10)", () => {
    // The regression this separation exists to prevent: a bare `en` formats
    // US-style, so a UK reader would lose `11 Aug 2026`.
    expect(resolveFormatLocale({ browser: 'en-GB', interfaceLocale: 'en' })).toBe('en-GB');
  });

  it('takes an injected tag over the browser', () => {
    expect(resolveFormatLocale({ injected: 'it-IT', browser: 'en-GB' })).toBe('it-IT');
  });

  it('is not restricted to the languages we ship a catalogue for (AC 11)', () => {
    expect(resolveFormatLocale({ injected: 'fr-CA', browser: 'en-GB' })).toBe('fr-CA');
  });

  it('ignores a malformed tag rather than throwing (AC 11)', () => {
    expect(resolveFormatLocale({ injected: 'not a tag', browser: 'en-GB' })).toBe('en-GB');
    expect(resolveFormatLocale({ injected: '', browser: 'en-GB' })).toBe('en-GB');
    expect(resolveFormatLocale({ injected: 42, browser: 'en-GB' })).toBe('en-GB');
  });

  it('falls back to the interface language when the browser states none (AC 10)', () => {
    expect(resolveFormatLocale({ browser: null, interfaceLocale: 'it' })).toBe('it');
    expect(resolveFormatLocale()).toBe('en');
  });

  it('recognises a malformed tag', () => {
    expect(isWellFormedTag('en-GB')).toBe(true);
    // Well formed, no data: `Intl` falls back on its own, which is fine.
    expect(isWellFormedTag('zz-ZZ')).toBe(true);
    expect(isWellFormedTag('not a tag')).toBe(false);
    expect(isWellFormedTag(null)).toBe(false);
  });
});

describe('reading the browser', () => {
  it('prefers the ordered list', () => {
    expect(browserLanguages({ languages: ['it-IT', 'en'], language: 'en' })).toEqual(['it-IT', 'en']);
  });

  it('falls back to the single value when the list is absent or empty', () => {
    expect(browserLanguages({ language: 'it-IT' })).toEqual(['it-IT']);
    expect(browserLanguages({ languages: [], language: 'it-IT' })).toEqual(['it-IT']);
  });

  it('is empty when there is no navigator to read', () => {
    expect(browserLanguages(null)).toEqual([]);
    expect(browserLanguages({})).toEqual([]);
  });

  it('drops blank entries', () => {
    expect(browserLanguages({ languages: ['', '  ', 'it'] })).toEqual(['it']);
  });
});
