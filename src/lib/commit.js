// Commit client: calls the Pages Function /api/commit (same origin, behind
// Cloudflare Access). No token here: the secret lives in the Function.
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
    throw new Error(data?.error || `Error ${res.status}`);
  }
  return data; // { sha, committed: [...paths], noop? }
}
