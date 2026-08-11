// Client-side preferences: interface language, date/time format, Inbox
// visibility (adr/0034-client-settings-modal.md).
//
// This module is the ONLY owner of preference storage. lib/i18n.js deliberately
// persists nothing (adr/0047-*.md) and receives its values through `initI18n`
// at boot and its setters at runtime; keeping storage on this side of that seam
// is what stops the two from growing competing sources of truth.
//
// "Auto" is the ABSENCE of a key, never a stored sentinel. That distinction is
// the whole point: a stored `"auto"` would satisfy every other requirement and
// still break the one case the option exists for — a user who never chose, then
// changes their browser or system language, must follow it. An absent key
// re-resolves against the browser on every boot; a sentinel would have to be
// interpreted, and the first place that forgot to interpret it would pin the
// wrong language.
import { useSyncExternalStore } from 'react';

const KEY = 'vault-web:prefs:v1';
const hasLS = typeof localStorage !== 'undefined';

/**
 * @typedef {object} Prefs
 * @property {string} [locale] interface language; absent means follow the browser
 * @property {string} [formatLocale] formatting locale; absent means follow the browser
 * @property {boolean} [showInbox] absent means shown (the default)
 */

/** @returns {Prefs} */
function load() {
  if (!hasLS) return {};
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    // A non-object (an array, a string, `null`) is discarded rather than spread:
    // every reader below treats this as a plain record.
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/** @type {Prefs} */
let state = load();
/** @type {Set<() => void>} */
const listeners = new Set();

function persist() {
  if (!hasLS) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // quota/permissions: ignore, stays in memory for the session.
  }
}

function emit() {
  persist();
  for (const l of listeners) l();
}

// Cross-tab sync, like the other stores. Two tabs of the same vault showing
// different languages would be a puzzle, not a feature.
if (hasLS && typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      for (const l of listeners) l();
    }
  });
}

/** @param {() => void} l */
function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}

/** The stored preferences. An absent key means the "System default" choice. */
export function getPrefs() {
  return state;
}

/**
 * Write one preference. `null` or `undefined` REMOVES the key, which is how the
 * "System default" choice is expressed — see the note at the top of this file.
 * @param {keyof Prefs} key
 * @param {string | boolean | null | undefined} value
 */
export function setPref(key, value) {
  const next = { ...state };
  if (value == null) delete next[key];
  else next[key] = /** @type {never} */ (value);
  state = next;
  emit();
}

/** React hook over the whole record. */
export function usePrefs() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Whether the built-in Inbox view is shown. Absent means shown: the default has
 * to survive a browser with no stored preferences at all, which is every first
 * visit (adr/0034 criterion 7).
 */
export function useShowInbox() {
  return usePrefs().showInbox !== false;
}

export const __test = {
  KEY,
  subscribe,
  reset: () => {
    state = {};
    if (hasLS) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        // ignore
      }
    }
    for (const l of listeners) l();
  },
  /** @param {Prefs} next */
  seed: (next) => {
    state = next;
    emit();
  },
};
