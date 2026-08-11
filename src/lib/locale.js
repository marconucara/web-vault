// Locale resolution for the UI language layer (adr/0047-ui-language-i18n-layer.md).
//
// Two resolutions live here and they deliberately disagree about region
// subtags:
//
//   - The INTERFACE language picks a message catalogue, and we ship one per
//     LANGUAGE. `it-CH` has to find the Italian catalogue, so the region is
//     dropped before matching (criterion 4).
//   - The FORMATTING locale drives `Intl`, where the region is exactly where
//     the information lives. A bare `en` formats US-style, so a reader on an
//     `en-GB` browser would start seeing `Aug 11, 2026` where the app shows
//     `11 Aug 2026`. It therefore keeps the full tag (criterion 10).
//
// Everything here is a pure function over plain values — no `navigator`, no
// storage — so the precedence rules are testable without a browser. Reading the
// browser is the one impure step and it is isolated in `browserLanguages`.

/** The languages we ship a catalogue for. `en` is the reference. */
export const SUPPORTED_LOCALES = /** @type {const} */ (['en', 'it']);

export const DEFAULT_LOCALE = 'en';

/**
 * The language subtag of a BCP-47 tag, lowercased: `it-CH` → `it`.
 * Accepts the underscore form (`it_CH`) some platforms still emit.
 * @param {unknown} tag
 * @returns {string | null}
 */
export function languageOf(tag) {
  if (typeof tag !== 'string') return null;
  const lang = tag.trim().toLowerCase().split(/[-_]/)[0];
  return lang || null;
}

/**
 * Whether we ship a catalogue for this tag's language.
 * @param {unknown} tag
 */
export function isSupportedLocale(tag) {
  const lang = languageOf(tag);
  return lang != null && /** @type {readonly string[]} */ (SUPPORTED_LOCALES).includes(lang);
}

/**
 * The interface language, first match wins (criteria 5, 6):
 *   1. the injected locale, if we ship it;
 *   2. the first language we ship among the browser's preferences, in the
 *      browser's own order;
 *   3. English.
 *
 * An injected value we do not ship is IGNORED rather than fatal, and resolution
 * continues at (2) — an unknown preference must never yield an untranslated
 * interface.
 *
 * @param {{ injected?: unknown, preferred?: readonly unknown[] }} [opts]
 * @returns {string}
 */
export function resolveInterfaceLocale({ injected = null, preferred = [] } = {}) {
  if (isSupportedLocale(injected)) return /** @type {string} */ (languageOf(injected));
  for (const tag of preferred) {
    if (isSupportedLocale(tag)) return /** @type {string} */ (languageOf(tag));
  }
  return DEFAULT_LOCALE;
}

/**
 * Whether the platform will accept this tag for `Intl`. `Intl` throws
 * `RangeError` on a structurally malformed tag, which is the one failure a
 * caller-supplied value can cause here, so it is checked rather than caught at
 * every format site (criterion 11). A well-formed tag the platform has no data
 * for is fine: `Intl` falls back on its own.
 * @param {unknown} tag
 */
export function isWellFormedTag(tag) {
  if (typeof tag !== 'string' || !tag.trim()) return false;
  try {
    Intl.DateTimeFormat.supportedLocalesOf([tag.trim()]);
    return true;
  } catch {
    return false;
  }
}

/**
 * The formatting locale, region intact (criteria 10, 11):
 *   1. the injected tag, if well formed — not restricted to the languages we
 *      ship, since formatting needs no catalogue;
 *   2. the browser's own tag, region included;
 *   3. the resolved interface language.
 *
 * @param {{ injected?: unknown, browser?: unknown, interfaceLocale?: string }} [opts]
 * @returns {string}
 */
export function resolveFormatLocale({ injected = null, browser = null, interfaceLocale = DEFAULT_LOCALE } = {}) {
  if (isWellFormedTag(injected)) return /** @type {string} */ (injected).trim();
  if (isWellFormedTag(browser)) return /** @type {string} */ (browser).trim();
  return interfaceLocale;
}

/**
 * The browser's preferred languages, most wanted first, with empty entries
 * dropped. `navigator.languages` is the ordered list; `navigator.language` is
 * the single-value fallback for platforms that omit it.
 * @param {{ languages?: readonly string[], language?: string } | null} [nav]
 * @returns {string[]}
 */
export function browserLanguages(nav = typeof navigator === 'undefined' ? null : navigator) {
  if (!nav) return [];
  const list = Array.isArray(nav.languages) && nav.languages.length
    ? nav.languages
    : nav.language
      ? [nav.language]
      : [];
  return list.filter((tag) => typeof tag === 'string' && tag.trim() !== '');
}
