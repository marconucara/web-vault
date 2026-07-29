// Optimistic store of notes deleted from the web client: the delete commit lands
// immediately, but the bundled content.json still lists the note until the next
// Pages build. We hide those paths in the meantime, then self-heal: once a build
// no longer contains a path, we drop it from the set (the hide is no longer
// needed). Mirrors the share store's self-heal pattern.
import { useSyncExternalStore } from 'react';

const KEY = 'vault-web:deleted:v1';
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
    // ignore
  }
}
function emit() {
  persist();
  for (const l of listeners) l();
}
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

export function markDeleted(path) {
  if (!path || state[path]) return;
  state = { ...state, [path]: true };
  emit();
}

// Self-heal: drop entries whose path is no longer in the current build.
export function reconcileDeleted(existingPaths) {
  let changed = false;
  const next = { ...state };
  for (const p of Object.keys(next)) {
    if (!existingPaths.has(p)) {
      delete next[p];
      changed = true;
    }
  }
  if (changed) {
    state = next;
    emit();
  }
}

export function useDeleted() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
