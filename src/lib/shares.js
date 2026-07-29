// Store for "in-flight" share publications, persisted in localStorage.
// It exists to NOT lose state if you navigate away from a just-shared note
// while the build is still running: coming back to the note resumes the
// activation polling. It also avoids regenerating a second share_id.
//
// Lifecycle of an entry { shareId, activated }:
// - created at "Share" time (even before the commit) → prevents duplicates;
// - activated:true when the /shared/<id>/ page turns out live (polling ok);
// - removed when the build "catches up" and content.json carries the share_id in
//   the note's frontmatter (self-heal): from there it is a normal shared note.
import { useSyncExternalStore } from 'react';

const KEY = 'vault-web:shares:v1';
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
    // quota/permissions: stays in memory for the session
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

// Imperative read (for effects, without depending on the React snapshot).
export function getShare(path) {
  return state[path] || null;
}

export function setShare(path, shareId, activated = false) {
  state = { ...state, [path]: { shareId, activated } };
  emit();
}

// Marks a note as "in-flight unshare": the frontmatter (build) may still carry
// the share_id until the build catches up, but the UI treats it as not shared
// right away. Self-heal when the frontmatter no longer has the share_id.
export function setUnshared(path) {
  state = { ...state, [path]: { unshared: true } };
  emit();
}

export function markActivated(path) {
  const r = state[path];
  if (r && !r.activated) {
    state = { ...state, [path]: { ...r, activated: true } };
    emit();
  }
}

export function removeShare(path) {
  if (state[path]) {
    const { [path]: _drop, ...rest } = state;
    state = rest;
    emit();
  }
}

export function useShares() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
