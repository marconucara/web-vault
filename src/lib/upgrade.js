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

// v2: v1 stored a single `checkedAt` that advanced on failure too, which cannot
// express "the last check failed" — the distinction AC6/AC9 now turn on. The
// only cost of discarding a v1 store is one extra check.
const KEY = 'vault-web:upgrade:v2';
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

// {
//   checkedAt:   epoch ms of the last SUCCESSFUL check — what "last checked"
//                means to an adopter, and the only one that may be reported
//   attemptedAt: epoch ms of the last attempt, successful or not — the throttle
//                reads this one, so a hard-down endpoint is not re-fetched on
//                every render
//   latest:      'X.Y.Z' | undefined
//   failed:      true when the last attempt did not produce an answer
// }
//
// The two timestamps have to be separate. Sharing one (as v1 did) forces a
// choice between re-fetching a dead endpoint on every render and reporting a
// failed check as a fresh one — AC6 rules out the second and the rate limit
// rules out the first.
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

// What a check resolves to. `checked` means "we have an answer" — whether that
// answer is an available update is read off the store, not off this value.
export const OUTCOME = { checked: 'checked', failed: 'failed' };

let inFlight = null;

// No failure path surfaces an error the adopter is asked to act on
// (adr/0038-*.md): network error, non-2xx, rate limit, malformed payload, no
// usable tags. But they are not all the same OUTCOME, and the difference is
// what the manual check reports.
//
// "The endpoint answered and its newest tag is not newer than us" is knowledge:
// it justifies telling the adopter they are up to date. "The endpoint did not
// answer" is the absence of knowledge, and reporting it as up-to-date would
// assert something this call did not establish. Hence `{ ok }` rather than a
// bare `latest | null`, which collapsed the two.
//
// A 200 carrying no usable tag counts as OK: the check ran, GitHub answered,
// there is simply no published version to compare against.
async function fetchLatest() {
  try {
    const res = await fetch(TAGS_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return { ok: false };
    return { ok: true, latest: highestVersion(await res.json()) };
  } catch {
    return { ok: false };
  }
}

// `now` is threaded through rather than read here so the throttle windows are
// testable: recording Date.now() while the caller reasons about an injected
// clock makes every window look freshly checked.
async function run(now) {
  const res = await fetchLatest();
  state = {
    ...state,
    attemptedAt: now,
    ...(res.ok
      ? { checkedAt: now, failed: false, ...(res.latest ? { latest: res.latest } : {}) }
      : { failed: true }),
  };
  emit();
  // A successful check keeps the last known `latest` when the payload had no
  // usable tag, so the marker does not blink off on a stray empty response.
  return res.ok ? OUTCOME.checked : OUTCOME.failed;
}

// `force` is the manual re-check: same work, tighter floor. Returns without
// fetching when called inside the applicable window, so a repeatedly clicked
// indicator cannot spend the rate limit.
//
// A refusal resolves to the outcome of the LAST check rather than to a refusal
// of its own, and this is deliberate — it is the one place where what the
// caller is told is not what just happened underneath (adr/0038-*.md AC8). The
// rate limit is our constraint, not the adopter's: someone clicking twice in
// thirty seconds asked the same question twice and the answer has not changed,
// so they get the answer, not a rebuff about a window they cannot see and were
// never told about. Do not "fix" this into a distinct refused outcome — that is
// the dead-button behaviour this replaced.
export function checkForUpdate({ force = false, now = Date.now() } = {}) {
  // "Never checked" is not "checked at the epoch": with `last` defaulting to 0
  // the very first check would be refused as if one had just happened, and the
  // notice would never appear on a fresh install.
  const last = Number.isFinite(state.attemptedAt) ? state.attemptedAt : null;
  const floor = force ? MANUAL_INTERVAL_MS : AUTO_INTERVAL_MS;
  if (last !== null && now - last < floor) {
    return Promise.resolve(state.failed ? OUTCOME.failed : OUTCOME.checked);
  }
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
  return {
    running,
    latest,
    available,
    // Of the last SUCCESSFUL check: this is what "last checked" is allowed to
    // mean when it is shown to an adopter.
    checkedAt: Number(snap.checkedAt) || 0,
  };
}

export const __test = { KEY, AUTO_INTERVAL_MS, MANUAL_INTERVAL_MS, TAGS_URL };
