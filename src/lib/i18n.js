// The UI translation layer (adr/0047-ui-language-i18n-layer.md).
//
// Catalogues are imported statically, so they are part of the bundle and there
// is nothing to fetch at runtime (criterion 2). Adding a locale is one JSON
// file plus two lines here.
//
// This module PERSISTS NOTHING (criterion 8). It reads no storage and writes
// none: the settings modal (adr/0034-client-settings-modal.md) owns both
// preferences and hands them in through `initI18n` at boot and the setters at
// runtime. Keeping storage on the other side of this seam is what stops the two
// from growing competing sources of truth.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import it from '../locales/it.json';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  browserLanguages,
  isSupportedLocale,
  languageOf,
  resolveFormatLocale,
  resolveInterfaceLocale,
} from './locale.js';

export const catalogues = /** @type {Record<string, Record<string, unknown>>} */ ({ en, it });

const isDev = () => {
  try {
    return !!import.meta.env?.DEV;
  } catch {
    return false;
  }
};

// A key with no translation renders as THE KEY, never as the English string
// (criterion 9). A silent English fallback would make a half-translated
// catalogue look finished, which is the one thing an incremental translation
// must not do — and `yarn verify` fails on a gap anyway (criterion 12), so a
// visible key is a signal to whoever is authoring, not something a reader meets.
const warned = new Set();
/**
 * i18next calls this as `(key, value)` — not with the locale or namespace.
 * Getting the arity wrong returns `undefined`, which i18next renders as an
 * empty object rather than as the key, so the gap becomes invisible: exactly
 * the failure this handler exists to prevent.
 * @param {string} key
 */
function onMissingKey(key) {
  if (isDev() && !warned.has(key)) {
    warned.add(key);
    console.warn(`[i18n] missing translation for "${key}" in ${i18next.language}`);
  }
  return key;
}

i18next.use(initReactI18next).init({
  resources: Object.fromEntries(
    Object.entries(catalogues).map(([code, messages]) => [code, { translation: messages }])
  ),
  lng: resolveInterfaceLocale({ preferred: browserLanguages() }),
  supportedLngs: [...SUPPORTED_LOCALES],
  // Deliberately off: see onMissingKey.
  fallbackLng: false,
  parseMissingKeyHandler: onMissingKey,
  // React escapes on render, and `t()` output also lands in attributes
  // (`title`, `aria-label`) where entity-escaping would be visible.
  interpolation: { escapeValue: false },
  returnNull: false,
});

// The formatting locale is separate state because it is a separate decision
// (criterion 10): it keeps its region, and it may name a language we ship no
// catalogue for. i18next's own `language` cannot carry it.
let formatLocale = resolveFormatLocale({
  browser: browserLanguages()[0] ?? null,
  interfaceLocale: i18next.language || DEFAULT_LOCALE,
});

/** @type {Set<() => void>} */
const formatListeners = new Set();

export function getFormatLocale() {
  return formatLocale;
}

/**
 * Subscribe to formatting-locale changes. Shaped for `useSyncExternalStore`.
 * @param {() => void} fn
 */
export function subscribeFormatLocale(fn) {
  formatListeners.add(fn);
  return () => formatListeners.delete(fn);
}

/**
 * Set the interface language at runtime (criterion 7). A language we ship no
 * catalogue for is ignored, so a bad value cannot blank the interface.
 * @param {unknown} tag
 * @returns {string} the language in force after the call
 */
export function setLocale(tag) {
  if (isSupportedLocale(tag)) i18next.changeLanguage(/** @type {string} */ (languageOf(tag)));
  return i18next.language;
}

/**
 * Set the formatting locale at runtime, independently of the interface
 * language. A malformed tag is ignored rather than thrown (criterion 11).
 * @param {unknown} tag
 * @returns {string} the formatting locale in force after the call
 */
export function setFormatLocale(tag) {
  const next = resolveFormatLocale({
    injected: tag,
    browser: browserLanguages()[0] ?? null,
    interfaceLocale: i18next.language || DEFAULT_LOCALE,
  });
  if (next !== formatLocale) {
    formatLocale = next;
    for (const fn of formatListeners) fn();
  }
  return formatLocale;
}

/**
 * Apply the host's boot-time locales. Both are optional and both fall through
 * when unsupported or malformed, so the browser's own answer stands
 * (criteria 5, 6). Call before rendering.
 *
 * This is the seam adr/0034-*.md writes through: it reads its stored
 * preferences and passes them here. Nothing in this module knows where they are
 * kept.
 *
 * @param {{ locale?: unknown, formatLocale?: unknown }} [opts]
 */
export function initI18n({ locale = null, formatLocale: fmt = null } = {}) {
  // Re-resolves from scratch rather than applying the argument on top of
  // whatever is in force. Booting is a full answer to "what language is this",
  // so an unsupported injected value has to fall through to the browser
  // (criterion 6) — applying it conditionally would instead leave the previous
  // language standing, which is neither the injected one nor the browser's.
  const preferred = browserLanguages();
  const next = resolveInterfaceLocale({ injected: locale, preferred });
  if (next !== i18next.language) i18next.changeLanguage(next);
  // Resolved after the interface language, which is its last fallback.
  formatLocale = resolveFormatLocale({
    injected: fmt,
    browser: preferred[0] ?? null,
    interfaceLocale: next,
  });
  for (const fn of formatListeners) fn();
  return { locale: next, formatLocale };
}

export { i18next };
export default i18next;
