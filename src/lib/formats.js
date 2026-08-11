// Locale-dependent formatting, driven by the formatting locale rather than by
// the interface language (adr/0047-ui-language-i18n-layer.md, criteria 10-11).
//
// Every date in the app used to name its own locale — two call sites hardcoded
// `en-GB`, one took the system default — so a single reader could see three
// different answers. These helpers are the one place that decides.
import { useSyncExternalStore } from 'react';
import { getFormatLocale, subscribeFormatLocale } from './i18n.js';

// `Intl.DateTimeFormat` construction is the expensive part, and these run per
// row of the note list. Keyed by locale + style, so a locale change simply
// misses the cache rather than needing invalidation.
/** @type {Map<string, Intl.DateTimeFormat>} */
const cache = new Map();

/**
 * @param {string} locale
 * @param {string} style
 * @param {Intl.DateTimeFormatOptions} options
 */
function formatter(locale, style, options) {
  const key = `${locale}\u0000${style}`;
  let fmt = cache.get(key);
  if (!fmt) {
    // A well-formed tag the platform has no data for falls back on its own; a
    // malformed one cannot reach here, because the resolution rejects it.
    fmt = new Intl.DateTimeFormat(locale, options);
    cache.set(key, fmt);
  }
  return fmt;
}

/** React hook: the formatting locale, re-rendering when it changes. */
export function useFormatLocale() {
  return useSyncExternalStore(subscribeFormatLocale, getFormatLocale, () => getFormatLocale());
}

/**
 * Compact date for dense lists: `11 Aug 2026` on `en-GB`, `11 ago 2026` on `it`.
 * @param {number | null | undefined} ms
 * @param {string} [locale]
 */
export function shortDate(ms, locale = getFormatLocale()) {
  if (!ms) return '—';
  return formatter(locale, 'short', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms));
}

/**
 * Spelled-out date for the properties panel: `11 August 2026`.
 * @param {number | null | undefined} ms
 * @param {string} [locale]
 */
export function longDate(ms, locale = getFormatLocale()) {
  if (!ms) return '—';
  return formatter(locale, 'long', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));
}

/**
 * Numeric date, the locale's own short form.
 * @param {number | null | undefined} ms
 * @param {string} [locale]
 */
export function numericDate(ms, locale = getFormatLocale()) {
  if (!ms) return '—';
  return formatter(locale, 'numeric', { dateStyle: 'short' }).format(new Date(ms));
}

/**
 * Clock time, hours and minutes.
 * @param {number | null | undefined} ms
 * @param {string} [locale]
 */
export function clockTime(ms, locale = getFormatLocale()) {
  if (!ms) return '—';
  return formatter(locale, 'time', { hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
}

// A fixed instant for the format samples in preferences (adr/0034 criterion 3).
// Fixed rather than `Date.now()` so the list does not depend on when it is
// opened, and so tests can assert exact strings. Chosen to disambiguate: day 11
// with an August month name separates day-first from month-first at a glance,
// and 14:30 separates a 24-hour clock from a 12-hour one.
export const SAMPLE_INSTANT = Date.UTC(2026, 7, 11, 14, 30);

// The sample is rendered in UTC, unlike every other date in the app, which is
// shown in the reader's own zone because it refers to a real moment. This one
// refers to nothing: it is an illustration of a FORMAT, so 14:30 has to stay
// 14:30 for a reader in Tokyo — otherwise the "12-hour vs 24-hour" contrast the
// instant was picked for lands on a different hour per reader, and the tests
// depend on the machine's zone.
//
// Hour is `numeric`, not `2-digit`: forcing two digits yields `03:30 PM` on
// `en-US`, which is not how anyone writes it.
/** @type {Intl.DateTimeFormatOptions} */
const SAMPLE_DATE_OPTS = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' };
/** @type {Intl.DateTimeFormatOptions} */
const SAMPLE_TIME_OPTS = { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' };

/**
 * What a date and a time look like under one locale — the label of a choice in
 * the format selector, where the sample IS the information the user is picking.
 * Formatted by the entry's own tag, not by the locale in force, so the list
 * shows one answer per entry rather than several copies of the current one.
 * @param {string} locale
 * @returns {string}
 */
export function formatSample(locale) {
  const d = new Date(SAMPLE_INSTANT);
  const date = formatter(locale, 'sample-date', SAMPLE_DATE_OPTS).format(d);
  const time = formatter(locale, 'sample-time', SAMPLE_TIME_OPTS).format(d);
  return `${date}, ${time}`;
}
