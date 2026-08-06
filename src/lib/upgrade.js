// Passive "a newer WebVault exists" check. Reads the framework repository's
// published tags, picks the highest, and compares it to the version this build
// was made with (adr/0038-*.md). Read-only: it notifies, it never upgrades or
// reloads anything — performing the upgrade is a separate, adopter-invoked
// action.
//
// Mirrors the store shape of lib/created.js: versioned key, defensive around a
// missing localStorage, useSyncExternalStore for the React side.
import { useSyncExternalStore } from 'react';
import { build } from '../content.js';

// The framework's OWN repository, deliberately a constant. `build.repo` is the
// ADOPTER's vault repo (adr/0012-build-version-chip.md) — deriving the URL from
// it would query the adopter's own tags and compare against the wrong project.
// Same identity trap as PACKAGE_DIR vs PROJECT_DIR in the build.
const REPO = 'marconucara/web-vault';
const TAGS_URL = `https://api.github.com/repos/${REPO}/tags?per_page=100`;

export const releaseUrl = (version) => `https://github.com/${REPO}/tree/v${version}`;

// One automatic check per hour, and a manual re-check no oftener than a minute.
// The unauthenticated GitHub limit is 60 requests/hour per IP; both sit far
// inside it, and the timestamp is persisted so a tab left open for days keeps
// checking while a reload loop does not re-fetch each time.
const AUTO_INTERVAL_MS = 60 * 60 * 1000;
const MANUAL_INTERVAL_MS = 60 * 1000;

const KEY = 'vault-web:upgrade:v1';
const hasLS = typeof localStorage !== 'undefined';

// Strictly `X.Y.Z`. Anything else — pre-releases, `v1.2`, a moved branch-like
// tag — is not a published version for our purposes and is ignored rather than
// coerced into one.
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

export function parseVersion(tag) {
  const m = SEMVER.exec(String(tag ?? '').trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// Numeric, component by component. NOT string comparison and NOT the order the
// API returns: /tags is lexicographic, so `v0.10.0` arrives before `v0.6.1` and
// taking the first entry starts failing silently at the tenth minor.
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

export function highestVersion(tags) {
  if (!Array.isArray(tags)) return null;
  let best = null;
  for (const t of tags) {
    // The API returns objects; tolerate bare strings for callers and fixtures.
    const name = typeof t === 'string' ? t : t?.name;
    if (!parseVersion(name)) continue;
    const v = String(name).replace(/^v/, '');
    if (!best || compareVersions(v, best) > 0) best = v;
  }
  return best;
}

// Strictly newer only. A build can legitimately be AHEAD of every published tag
// (a maintainer running `main` after tagging); with an inequality test that
// maintainer would see a permanent, wrong "update available".
export function isNewer(latest, running) {
  if (!parseVersion(latest) || !parseVersion(running)) return false;
  return compareVersions(latest, running) > 0;
}

function load() {
  if (!hasLS) return {};
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

// { checkedAt: epoch ms, latest: 'X.Y.Z' | undefined }
//
// Deliberately no `dismissed`: dismissing closes the panel (click-outside or
// Escape), it does not suppress the marker. Suppression would have to persist
// to be worth anything, and a persisted one outlives the moment it was clicked
// in — days later the adopter has no signal that an upgrade is waiting, and no
// way to bring it back.
let state = load();
const listeners = new Set();

function persist() {
  if (!hasLS) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore: a full or unavailable store only costs us the throttle memory
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

let inFlight = null;

// Every failure path is silent (adr/0038-*.md): network error, non-2xx, rate
// limit, malformed payload, no usable tags. The adopter is not troubleshooting
// GitHub — a failed check is simply "no notice this time". The timestamp is
// still recorded, so a hard-down endpoint is not retried on every render.
async function fetchLatest() {
  try {
    const res = await fetch(TAGS_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    return highestVersion(await res.json());
  } catch {
    return null;
  }
}

// `now` is threaded through rather than read here so the throttle windows are
// testable: recording Date.now() while the caller reasons about an injected
// clock makes every window look freshly checked.
async function run(now) {
  const latest = await fetchLatest();
  state = { ...state, checkedAt: now, ...(latest ? { latest } : {}) };
  emit();
  return latest;
}

// `force` is the manual re-check: same work, tighter floor. Returns without
// fetching when called inside the applicable window, so a repeatedly clicked
// indicator cannot spend the rate limit.
export function checkForUpdate({ force = false, now = Date.now() } = {}) {
  // "Never checked" is not "checked at the epoch": with `last` defaulting to 0
  // the very first check would be refused as if one had just happened, and the
  // notice would never appear on a fresh install.
  const last = Number.isFinite(state.checkedAt) ? state.checkedAt : null;
  const floor = force ? MANUAL_INTERVAL_MS : AUTO_INTERVAL_MS;
  if (last !== null && now - last < floor) return Promise.resolve(null);
  if (inFlight) return inFlight;
  inFlight = run(now).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function useUpgrade() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const running = build?.frameworkVersion || '';
  const latest = snap.latest || '';
  // A build predating adr/0037-*.md carries no version. Nothing to compare, so
  // nothing is claimed — better than guessing an adopter is out of date.
  const available = isNewer(latest, running);
  return { running, latest, available, checkedAt: Number(snap.checkedAt) || 0 };
}

export const __test = { KEY, AUTO_INTERVAL_MS, MANUAL_INTERVAL_MS, TAGS_URL };
