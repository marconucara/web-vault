// Store for not-yet-committed changes (editor drafts), persisted in localStorage
// so it survives closing/reopening the browser.
// Single source of truth: one "working copy" per note (per path).
// Step 1 (editor only): tracks body edits. The commit comes later.
import { useSyncExternalStore } from 'react';

const KEY = 'vault-web:pending:v1';

const hasLS = typeof localStorage !== 'undefined';

function load() {
  if (!hasLS) return {};
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

let state = load();
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

// Cross-tab sync: if another tab changes the store, realign.
if (hasLS) {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      for (const l of listeners) l();
    }
  });
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return state;
}

// Records/updates a note's draft. If the body becomes equal to the original
// (base = note.body bundled at build time) the entry is removed: no delta.
export function setEdit(note, body) {
  if (body === note.body) {
    if (state[note.path]) {
      const { [note.path]: _drop, ...rest } = state;
      state = rest;
      emit();
    }
    return;
  }
  const prev = state[note.path];
  if (prev && prev.body === body) return;
  state = {
    ...state,
    [note.path]: { path: note.path, id: note.id, title: note.title, body },
  };
  emit();
}

export function discard(path) {
  if (state[path]) {
    const { [path]: _drop, ...rest } = state;
    state = rest;
    emit();
  }
}

export function discardMany(paths) {
  let changed = false;
  const next = { ...state };
  for (const p of paths) {
    if (next[p]) {
      delete next[p];
      changed = true;
    }
  }
  if (changed) {
    state = next;
    emit();
  }
}

export function discardAll() {
  if (Object.keys(state).length) {
    state = {};
    emit();
  }
}

export function usePending() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Effective body to show/edit: the draft if it exists, otherwise the original.
export function effectiveBody(pending, note) {
  return pending[note.path]?.body ?? note.body;
}
