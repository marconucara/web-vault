// Optimistic store of notes CREATED from the web client. The create commit lands
// immediately, but the note only enters the bundled content.json at the next
// Pages build. Without this store the just-created note would vanish (the draft
// is gone, the build has not caught up yet). So on a successful create we keep a
// local, real-id copy of the note here and render it until the build supersedes
// it. Self-heal: once a build contains the id, drop the local copy.
//
// Mirrors lib/deleted.js, but stores whole note objects (not just a flag) since
// there is no build-time source for them yet.
import { useSyncExternalStore } from 'react';

const KEY = 'vault-web:created:v1';
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

// note: { id, path, title, type, frontmatter, body, mtime, ctime, fromDraftId }
export function markCreated(note) {
  state = { ...state, [note.id]: note };
  emit();
}

// Self-heal: drop entries whose id is already present in the current build.
export function reconcileCreated(existingIds) {
  let changed = false;
  const next = { ...state };
  for (const id of Object.keys(next)) {
    if (existingIds.has(id)) {
      delete next[id];
      changed = true;
    }
  }
  if (changed) {
    state = next;
    emit();
  }
}

export function useCreated() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
