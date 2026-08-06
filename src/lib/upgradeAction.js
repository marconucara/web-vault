// Client side of the one-click upgrade (adr/0039-*.md).
//
// Calls the dedicated endpoint, then watches for the rebuild to land. The two
// halves are separate on purpose: the commit succeeding says only that the pin
// was written, not that the new version is live. The deployment still has to
// rebuild, and a rebuild can fail — so the panel resolves by observing the
// version actually served, never by assuming the commit implied it.
const ENDPOINT = '/api/upgrade';

export async function requestUpgrade(version) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version }),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response (e.g. error HTML): leave data as null
  }
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data; // { committed: true, from, to } | { noop: true, reason }
}

// Polls the version the DEPLOYMENT reports serving, until it reports `target` —
// which is what "the upgrade is live" actually means.
//
// It asks the capability endpoint rather than reading the running bundle: the
// bundle's own version is fixed at the moment this page loaded and cannot change
// under it, so a client watching itself would wait forever. Bounded, because a
// rebuild can fail, and a spinner that never ends is worse than a stated
// timeout.
/**
 * @param {string} target
 * @param {{ intervalMs?: number, timeoutMs?: number, now?: () => number,
 *           fetchImpl?: (url: string, init?: any) => Promise<any> }} [opts]
 */
export function pollForVersion(target, {
  intervalMs = 15000,
  timeoutMs = 15 * 60 * 1000,
  now = () => Date.now(),
  fetchImpl = fetch,
} = {}) {
  const started = now();
  let timer = null;
  let cancelled = false;

  const promise = new Promise((resolve) => {
    const attempt = async () => {
      if (cancelled) return;
      try {
        const res = await fetchImpl(`/api/capabilities?t=${now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.frameworkVersion === target) return resolve({ live: true });
        }
      } catch {
        // A failed probe is not a failed upgrade — the deployment is very
        // likely mid-rebuild and briefly unreachable. Keep waiting.
      }
      if (cancelled) return;
      if (now() - started >= timeoutMs) return resolve({ live: false, timedOut: true });
      timer = setTimeout(attempt, intervalMs);
    };
    attempt();
  });

  return {
    promise,
    cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}
