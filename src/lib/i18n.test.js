import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18next, { getFormatLocale, initI18n, setFormatLocale, setLocale } from './i18n.js';
import { shortDate } from './formats.js';

// adr/0047-ui-language-i18n-layer.md, criteria 7-11.
//
// The browser is stubbed per case rather than left to the runtime: node exposes
// a `navigator` of its own (`en-IE` on this machine), so "no preference" and
// "prefers Italian" both have to be stated explicitly or the suite passes for
// the wrong reason.
const browser = (...languages) => vi.stubGlobal('navigator', { languages, language: languages[0] });

beforeEach(() => {
  vi.stubGlobal('navigator', { languages: [], language: '' });
  initI18n();
});

afterEach(() => {
  vi.unstubAllGlobals();
  initI18n();
});

describe('the translation layer', () => {
  it('boots to English when there is no browser preference to read (AC 5c)', () => {
    expect(i18next.language).toBe('en');
    expect(i18next.t('views.allNotes')).toBe('All notes');
  });

  it("boots to the browser's language when it states one (AC 5b)", () => {
    browser('it-CH', 'en');
    initI18n();
    expect(i18next.language).toBe('it');
    expect(i18next.t('views.allNotes')).toBe('Tutte le note');
  });

  it('applies a host-supplied locale at boot (AC 5a)', () => {
    initI18n({ locale: 'it' });
    expect(i18next.language).toBe('it');
    expect(i18next.t('views.allNotes')).toBe('Tutte le note');
  });

  it('falls THROUGH an unsupported host locale to the browser, not to English (AC 6)', () => {
    browser('it-IT');
    initI18n({ locale: 'fr' });
    expect(i18next.language).toBe('it');
  });

  it('re-resolves on every boot rather than layering on what is in force', () => {
    // The bug this pins: applying the argument conditionally left the PREVIOUS
    // language standing when the new one was unsupported — neither the injected
    // locale nor the browser's answer.
    initI18n({ locale: 'it' });
    initI18n({ locale: 'fr' });
    expect(i18next.language).toBe('en');
  });

  it('switches language at runtime (AC 7)', () => {
    expect(setLocale('it-CH')).toBe('it');
    expect(i18next.t('views.inbox')).toBe('In arrivo');
    expect(setLocale('en')).toBe('en');
    expect(i18next.t('views.inbox')).toBe('Inbox');
  });

  it('ignores an unsupported runtime locale rather than blanking the interface', () => {
    setLocale('it');
    expect(setLocale('fr')).toBe('it');
    expect(i18next.t('views.inbox')).toBe('In arrivo');
  });

  it('interpolates values', () => {
    expect(i18next.t('sidebar.editType', { name: 'Person' })).toBe('Edit Person');
  });

  it('selects the plural form by count', () => {
    expect(i18next.t('statusBar.notesChanged', { count: 1 })).toBe('1 note changed');
    expect(i18next.t('statusBar.notesChanged', { count: 3 })).toBe('3 notes changed');
    setLocale('it');
    expect(i18next.t('statusBar.notesChanged', { count: 1 })).toBe('1 nota modificata');
    expect(i18next.t('statusBar.notesChanged', { count: 3 })).toBe('3 note modificate');
  });
});

describe('a key with no translation', () => {
  it('renders THE KEY, never the English string (AC 9)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setLocale('it');
    // A key present nowhere: the fallback must not reach for `en`.
    expect(i18next.t('nowhere.at.all')).toBe('nowhere.at.all');
    warn.mockRestore();
  });

  it('does not fall back to English for a key the reference catalogue HAS', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    i18next.addResourceBundle('en', 'translation', { probe: { untranslated: 'English only' } }, true, true);
    setLocale('it');
    expect(i18next.t('probe.untranslated')).toBe('probe.untranslated');
    i18next.removeResourceBundle('en', 'probe');
    warn.mockRestore();
  });
});

describe('storage', () => {
  it('reads and writes none of it (AC 8)', () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      key: vi.fn(() => null),
      clear: vi.fn(),
      length: 0,
    };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);

    initI18n({ locale: 'it', formatLocale: 'it-IT' });
    setLocale('en');
    setFormatLocale('en-GB');

    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});

describe('the formatting locale', () => {
  it('is separate from the interface language (AC 11)', () => {
    initI18n({ locale: 'en', formatLocale: 'it-IT' });
    expect(i18next.language).toBe('en');
    expect(getFormatLocale()).toBe('it-IT');
    // English interface, Italian dates: the combination this separation exists for.
    expect(i18next.t('views.allNotes')).toBe('All notes');
    expect(shortDate(Date.UTC(2026, 7, 11, 12), 'it-IT')).toContain('ago');
  });

  it('accepts a language we ship no catalogue for (AC 11)', () => {
    expect(setFormatLocale('fr-CA')).toBe('fr-CA');
  });

  it('ignores a malformed tag instead of throwing (AC 11)', () => {
    initI18n({ locale: 'en' });
    const before = getFormatLocale();
    expect(setFormatLocale('not a tag')).toBe(before);
  });

  it('falls back to the interface language when the browser states none (AC 10)', () => {
    initI18n({ locale: 'it' });
    expect(getFormatLocale()).toBe('it');
  });

  it("defaults to the browser's FULL tag, region included (AC 10)", () => {
    browser('en-GB');
    initI18n();
    expect(i18next.language).toBe('en');
    expect(getFormatLocale()).toBe('en-GB');
  });
});
