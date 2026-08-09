// Upgrade endpoint: rewrite the framework pin in the adopter's shell
// package.json and commit it (adr/0039-*.md).
//
// Deliberately NOT part of /api/commit. That endpoint's path guard
// (isSafeNotePath) accepts only .md files and rejects any segment starting with
// a dot, which excludes `.web/` by construction — it is what keeps the note
// editor away from the toolchain. Widening it would hand every caller of the
// note endpoint write access to the build config. This endpoint instead has one
// file and one field in its entire write scope, checked here rather than
// delegated to a general path rule.
//
// The commit rides the same machinery as an edit: it targets the branch the
// deployment was built from (adr/0020-*.md), so the push rebuilds the
// deployment, and the rebuild reinstalls the framework at the new pin. There is
// no separate "reinstall" step — the deploy substrate performs it.

// The framework's OWN repository (mirrors src/lib/upgrade.js). NOT the adopter's
// vault repo: the tag being resolved is a web-vault release.
const FRAMEWORK_REPO = 'marconucara/web-vault';

// Where the pin lives, relative to the vault root. The shell sits inside the
// vault (SETUP.md), so this path is the same for every adopter.
const SHELL_MANIFEST = '.web/package.json';

const SEMVER = /^\d+\.\d+\.\d+$/;

// Matches the dependency VALUE only, and captures the tag separately so the
// rewrite can replace the version without touching the rest of the line.
// Tolerates the `github:` prefix being present or absent, and any surrounding
// whitespace, because this file is the adopter's and we did not write it.
const PIN = new RegExp(
  `("web-vault"\\s*:\\s*")(?:github:)?(${FRAMEWORK_REPO.replace('/', '\\/')})#v(\\d+\\.\\d+\\.\\d+)(")`
);

export function readPin(source) {
  const m = PIN.exec(String(source ?? ''));
  return m ? m[3] : null;
}

// Targeted string rewrite, NOT JSON.parse + stringify. The manifest is the
// adopter's file: a round trip through JSON would silently reformat it —
// reordering nothing but rewriting indentation, dropping the trailing newline,
// and turning a one-line upgrade into a whole-file diff in their history.
// Returns null when there is nothing to rewrite, so the caller can distinguish
// "no pin" from "written".
export function setPin(source, version) {
  const src = String(source ?? '');
  if (!SEMVER.test(String(version ?? ''))) return null;
  if (!PIN.test(src)) return null;
  return src.replace(PIN, `$1github:$2#v${version}$4`);
}

// GitHub rejects any REST request that carries no User-Agent, with a 403 whose
// body reads "Request forbidden by administrative rules". A browser sets one
// itself, a Worker does not — which is why the notice's own check works while a
// call made from here does not. Every request in this file goes through these
// headers so the two cannot drift apart again.
const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'web-vault-upgrade',
  'X-GitHub-Api-Version': '2022-11-28',
};

// The outcome of asking whether a tag exists. `unknown` is not a detail: reading
// it as "absent" is what told adopters their release was unpublished when the
// request had merely been refused.
export const TAG = /** @type {const} */ ({
  published: 'published',
  absent: 'absent',
  unknown: 'unknown',
});

// Confirms the target is a PUBLISHED tag before anything is written. Without
// this an upgrade could pin a tag that does not exist, and the resulting build
// would fail at install with the adopter's site already committed to it.
//
// Unauthenticated on purpose: this reads a public tag of the FRAMEWORK repo, and
// the adopter's token has no business reaching it.
/**
 * @param {string} version
 * @param {(url: string, init?: any) => Promise<any>} [fetchImpl]
 * @returns {Promise<'published' | 'absent' | 'unknown'>}
 */
export async function tagStatus(version, fetchImpl = fetch) {
  if (!SEMVER.test(String(version ?? ''))) return TAG.absent;
  try {
    const res = await fetchImpl(
      `https://api.github.com/repos/${FRAMEWORK_REPO}/git/ref/tags/v${version}`,
      { headers: { ...GH_HEADERS } }
    );
    if (res.ok) return TAG.published;
    // Only a 404 is evidence of absence. A 403 (no UA, rate limit) or a 5xx says
    // the question went unanswered, which is a different thing entirely.
    return res.status === 404 ? TAG.absent : TAG.unknown;
  } catch {
    // Network failure: also unanswered, never absence.
    return TAG.unknown;
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const gh = (env, path, init = {}) =>
  fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      ...GH_HEADERS,
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  });

// GitHub returns and expects base64. The manifest is ASCII in practice, but a
// UTF-8 aware round trip costs nothing and avoids a surprise on a non-ASCII
// package name.
const decodeB64 = (b64) =>
  new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\n/g, '')), (c) => c.charCodeAt(0)));
const encodeB64 = (text) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)));

// Single file, single field. Uses the Contents API rather than the Git Data
// dance in commit.js: that exists to make a MULTI-file edit atomic, and this
// writes exactly one file. The `sha` in the update request is the same
// optimistic-concurrency guard by another name — if the manifest changed since
// we read it, GitHub rejects the write instead of clobbering it.
export function makeUpgradeHandler(config = {}) {
  return async function onRequestPost({ request, env }) {
    if (!env.GITHUB_TOKEN) {
      return json({ error: 'This deployment has no write access configured.' }, 403);
    }
    const repo = env.GITHUB_REPO || config.repo || '';
    if (!repo) return json({ error: 'repo not configured (set GITHUB_REPO)' }, 500);
    const branch = env.GITHUB_BRANCH || config.buildBranch || 'main';

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400);
    }
    const version = String(payload?.version ?? '').trim();
    if (!SEMVER.test(version)) return json({ error: `invalid version: ${version}` }, 400);

    // Validate BEFORE writing. Pinning a tag that does not exist would commit
    // the adopter's site to a build that cannot install. Nothing below runs
    // unless the tag was positively confirmed.
    const status = await tagStatus(version);
    if (status === TAG.absent) {
      return json({ error: `version ${version} is not published` }, 400);
    }
    if (status !== TAG.published) {
      // The target may well be fine — we could not reach GitHub to find out. A
      // 502 says the upstream call failed; a 400 would blame the adopter's
      // request, which is what the old "not published" did.
      return json({ error: `could not verify that version ${version} exists` }, 502);
    }

    const url = `/repos/${repo}/contents/${SHELL_MANIFEST.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}`;
    const curRes = await gh(env, url);
    if (curRes.status === 404) {
      return json({ error: `no shell manifest at ${SHELL_MANIFEST}` }, 404);
    }
    if (!curRes.ok) return json({ error: 'could not read the shell manifest' }, 502);
    const cur = await curRes.json();
    const source = decodeB64(cur.content);

    const from = readPin(source);
    if (!from) {
      // A branch pin, a local link, or no dependency at all. Not an error the
      // adopter can act on from here, and definitely not something to overwrite.
      return json({ noop: true, reason: 'no version pin to update' });
    }
    if (from === version) return json({ noop: true, reason: 'already up to date', from });

    const next = setPin(source, version);
    if (next === null || next === source) {
      return json({ noop: true, reason: 'no version pin to update', from });
    }

    const updRes = await gh(env, `/repos/${repo}/contents/${SHELL_MANIFEST.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `chore: upgrade web-vault to v${version}`,
        content: encodeB64(next),
        sha: cur.sha,
        branch,
      }),
    });
    if (updRes.status === 409) {
      return json({ error: 'the repo changed in the meantime: reload and try again' }, 409);
    }
    if (!updRes.ok) return json({ error: 'could not write the shell manifest' }, 502);

    const sha = (await updRes.json())?.commit?.sha || '';
    return json({ committed: true, from, to: version, sha, branch });
  };
}

export const __test = { FRAMEWORK_REPO, SHELL_MANIFEST, PIN };
