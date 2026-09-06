// Commit client: calls the Pages Function /api/commit (same origin, behind
// Cloudflare Access). No token here: the secret lives in the Function.

// A failed commit that the caller can act on rather than only display. The
// Function tags each refusal with a `reason`, because they need different
// answers: `drift` carries the current remote content of the notes that changed
// elsewhere, so the editor can offer a resolution (adr/0050-*.md), while `moved`
// and `exists` are told to reload or rename. A plain Error would flatten all of
// that into its message.
export class CommitError extends Error {
  constructor(message, { reason = null, drifted = null, status = 0 } = {}) {
    super(message);
    this.name = 'CommitError';
    this.reason = reason;
    this.drifted = drifted;
    this.status = status;
  }
}

export async function commitFiles({ message, files }) {
  const res = await fetch('/api/commit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message, files }),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response (e.g. error HTML): leave data as null
  }
  if (!res.ok) {
    throw new CommitError(data?.error || `Error ${res.status}`, {
      reason: data?.reason ?? null,
      drifted: data?.drifted ?? null,
      status: res.status,
    });
  }
  return data; // { sha, committed: [...paths], noop? }
}
