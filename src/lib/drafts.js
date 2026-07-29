// Store for not-yet-committed NEW notes (created from the web client), persisted
// in localStorage so they survive closing/reopening the browser.
//
// Separate from lib/pending.js (which tracks body edits of existing notes):
// a draft has no path yet — the filename is derived from the first H1 at commit
// time (Tolaria convention), and the file is always created in the vault root.
// A draft is keyed by a stable temp id so its identity survives while the title
// (and thus the future filename) is still being typed.
import { useSyncExternalStore } from 'react';
import { deriveTitle } from './noteFile.js';

const KEY = 'vault-web:drafts:v1';
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

// Cross-tab sync.
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

function newId() {
  const rnd =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `draft-${rnd}`;
}

// New notes start like Tolaria's: `type: X` frontmatter + an empty H1 that the
// user fills in (the title, and thus the filename, is inferred from it).
const INITIAL_BODY = '\n# \n';

// Creates a draft note contextual to the current navigation (the type comes from
// the type the user is browsing, or "Note" for plain views). Returns its id.
export function createDraft({ type = null } = {}) {
  const id = newId();
  const frontmatter = {};
  if (type) frontmatter.type = type;
  state = {
    ...state,
    [id]: {
      id,
      type: type || null,
      frontmatter,
      body: INITIAL_BODY,
      // Stable creation timestamp (seconds), used for the untitled fallback
      // filename so it does not drift while editing.
      createdSec: Math.floor(Date.now() / 1000),
      createdAt: Date.now(),
    },
  };
  emit();
  return id;
}

export function setDraftBody(id, body) {
  const d = state[id];
  if (!d || d.body === body) return;
  state = { ...state, [id]: { ...d, body } };
  emit();
}

export function discardDraft(id) {
  if (state[id]) {
    const { [id]: _drop, ...rest } = state;
    state = rest;
    emit();
  }
}

export function discardDrafts(ids) {
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

export function useDrafts() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Render-ready note object for a draft, shaped like a build-time note so it can
// flow through NoteList / NoteView / notesById unchanged. `draft: true` marks it
// so those components route edits to this store and skip path-based features.
export function draftToNote(draft) {
  return {
    id: draft.id,
    path: null,
    draft: true,
    title: deriveTitle(draft.body) || 'Untitled',
    type: draft.type,
    frontmatter: draft.frontmatter || {},
    body: draft.body,
    words: 0,
    bytes: 0,
    lastCommit: null,
    mtime: draft.createdAt,
    ctime: draft.createdAt,
  };
}
