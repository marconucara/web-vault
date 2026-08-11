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
