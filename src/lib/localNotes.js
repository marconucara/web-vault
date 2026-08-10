// Optimistic store of notes the web client has WRITTEN — created or modified.
// A commit lands immediately, but the change only enters the bundled
// content.json at the next Pages build. Without this store a just-created note
// would vanish (the draft is gone, the build has not caught up), and a note the
// app rewrote would keep showing its stale build-time content. So on a
// successful commit we keep a local, real-id copy here and render it until a
// build supersedes it.
//
// Two kinds of entry, self-healing on different conditions
// (adr/0045-manage-types-from-the-ui.md, criteria 13-14):
//
// - CREATED (`origin: 'created'`) — no build knows this note yet. It heals once
//   a build carries its id: the build is necessarily newer than the local copy.
// - MODIFIED (`origin: 'modified'`) — the build already carries this id, with
//   older content. Healing on "id present" would drop it instantly, so it heals
//   on the build's own timestamp: once a build ran after the commit, its content
//   wins. `buildAt` is the ms epoch recorded when the entry was written.
//
// Mirrors lib/deleted.js, but stores whole note objects (not just a flag) since
// for a created note there is no build-time source at all.
import { useSyncExternalStore } from 'react';

const KEY = 'vault-web:local-notes:v1';
// The store used to hold created notes only, under its old name. An adopter can
// have entries there from before this deploy — notes committed but not yet
// built, which are exactly the ones that must not vanish — so they are adopted
// once, as `created`, and the old key is cleared.
const LEGACY_KEY = 'vault-web:created:v1';
const hasLS = typeof localStorage !== 'undefined';

function load() {
  if (!hasLS) return {};
  try {
    const current = JSON.parse(localStorage.getItem(KEY)) || {};
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (!legacyRaw) return current;
    const legacy = JSON.parse(legacyRaw) || {};
    const merged = { ...current };
    for (const [id, note] of Object.entries(legacy)) {
      if (!merged[id]) merged[id] = { ...note, origin: 'created' };
    }
    localStorage.removeItem(LEGACY_KEY);
    localStorage.setItem(KEY, JSON.stringify(merged));
    return merged;
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
  state = { ...state, [note.id]: { ...note, origin: 'created' } };
  emit();
}

// A note that already exists in the build and the app has just rewritten — the
// notes a type rename touches. `buildAt` is the build the entry was written
// against; a later build supersedes it.
export function markModified(note, buildAt = Date.now()) {
  state = { ...state, [note.id]: { ...note, origin: 'modified', buildAt } };
  emit();
}

// Applies a change to the note as the app currently sees it (build content or an
// existing local entry), so callers do not have to reassemble the whole object.
export function applyLocalEdit(note, changes, buildAt = Date.now()) {
  const base = state[note.id] || note;
  markModified({ ...base, ...changes, id: note.id }, buildAt);
}

// Self-heal against the build now loaded.
//
// - created: the build carries the id, so it has caught up — drop the copy.
// - modified: the build carries the id too (it always did), so that cannot be
//   the test. Drop it once the build was produced AFTER the entry was written;
//   until then the local copy is the fresher one.
//
// `builtAt` is the current build's timestamp in ms, or null when the build
// carries none — in which case modified entries are kept rather than guessed
// away, and the next build with a timestamp clears them.
export function reconcileLocal(existingIds, builtAt = null) {
  let changed = false;
  const next = { ...state };
  for (const [id, entry] of Object.entries(next)) {
    const stale =
      entry.origin === 'modified'
        ? builtAt != null && entry.buildAt != null && builtAt > entry.buildAt
        : existingIds.has(id);
    if (stale) {
      delete next[id];
      changed = true;
    }
  }
  if (changed) {
    state = next;
    emit();
  }
}

// Drops entries by id — used when a local change is undone by a later one (a
// note deleted after being modified, say).
export function dropLocal(ids) {
  let changed = false;
  const next = { ...state };
  for (const id of ids) {
    if (next[id]) {
      delete next[id];
      changed = true;
    }
  }
  if (changed) {
    state = next;
    emit();
  }
}

export function useLocalNotes() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
