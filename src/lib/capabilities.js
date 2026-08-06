// Client view of what the running deployment can do (adr/0034-*.md).
//
// One question today: can this deployment write? Editing, sharing and deleting
// all funnel into /api/commit, which needs a server-side GitHub token
// (adr/0018-*.md). Until now the client never asked — it attempted the commit
// and learned from a 500. That is fine for an action the user deliberately
// invoked; it is useless for DECIDING WHICH AFFORDANCE TO RENDER, which has to
// happen before any click.
//
// Fetched at runtime rather than read from the build: the token is a host secret
// an adopter adds after deploying, so a build-time flag would report `false` on a
// deployment that writes perfectly well.
//
// Store shape mirrors lib/upgrade.js: module state + useSyncExternalStore.
import { useSyncExternalStore } from 'react';

const URL_PATH = '/api/capabilities';

// `null` is a real third state, not a placeholder for `false`: "not asked yet"
// must be distinguishable from "asked, cannot write", so callers can hold back a
// read-only fallback that would flash on every load before the answer lands.
let state = { canWrite: null };
const listeners = new Set();

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}
function set(next) {
  if (next.canWrite === state.canWrite) return;
  state = next;
  for (const l of listeners) l();
}

let inFlight = null;

// Failure is silent and lands on `false`. A deployment we cannot ask about is
// one we should not offer write actions for: showing an action that then fails
// is worse than not showing it. Not persisted — it is a property of the
// deployment, not of the browser, and a stale cached `true` would outlive an
// adopter removing the secret.
export function loadCapabilities() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch(URL_PATH, { headers: { Accept: 'application/json' } });
      if (!res.ok) return set({ canWrite: false });
      const data = await res.json();
      set({ canWrite: !!data?.canWrite });
    } catch {
      set({ canWrite: false });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function useCapabilities() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { canWrite: snap.canWrite === true, known: snap.canWrite !== null };
}

export const __test = {
  URL_PATH,
  snapshot: () => state,
  reset: () => { state = { canWrite: null }; inFlight = null; },
};
