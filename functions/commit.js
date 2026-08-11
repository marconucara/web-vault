// Cloudflare Pages Function factory: POST /api/commit
//
// The consumer's functions/api/commit.js is GENERATED at build time (wv build)
// and just calls makeCommitHandler() with build-injected config; the real logic
// lives here in the package and upgrades via `yarn up`. See scripts/generate-functions.mjs.
//
// Commits one or more vault notes to the deployment branch via the GitHub Git
// Data API, in ONE atomic commit. The GitHub token lives as an encrypted Secret
// of the Pages project (env.GITHUB_TOKEN) and NEVER enters the client bundle:
// the UI only calls this Function (same origin, behind the same Cloudflare Access).
//
// Config resolution (runtime env wins over build-injected config):
// - GITHUB_TOKEN  (Secret, required) — fine-grained PAT with Contents:write on the vault repo only.
// - GITHUB_REPO   (env) or config.repo (build-injected, from the git remote).
// - GITHUB_BRANCH (env) or config.buildBranch (CF_PAGES_BRANCH baked at build), else "main".

const MAX_FILES = 50;
const MAX_BYTES = 512 * 1024; // 512 KiB per note

// Allowed note path: relative, .md, no traversal, no hidden files/dirs (so
// .web/, .git, etc. are excluded). Allowed: letters, digits, ._- space, and /.
const SAFE_SEGMENT = /^[A-Za-z0-9._\- ]+$/;

export function isSafeNotePath(p) {
  if (typeof p !== 'string' || !p) return false;
  if (p.startsWith('/') || p.includes('..') || p.includes('\\')) return false;
  if (!/\.md$/.test(p)) return false;
  const segs = p.split('/');
  return segs.every((s) => s && !s.startsWith('.') && SAFE_SEGMENT.test(s));
}

// Allowed share token (same as build-shared.mjs).
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

// Rebuilds the file keeping the current frontmatter block and replacing the
// body. If the file has no frontmatter, the new content is just the body.
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
export function reconstructFile(rawCurrent, newBody) {
  const fm = (rawCurrent.match(FRONTMATTER) || [''])[0];
  return fm + newBody;
}

// Inserts `share_id: <token>` into the frontmatter block without touching the
// rest (no YAML re-serialization). If the frontmatter is missing, it creates a
// minimal one. If share_id is already there, it leaves it unchanged.
export function ensureShareId(fmBlock, token) {
  if (!fmBlock) return `---\nshare_id: ${token}\n---\n`;
  if (/^share_id:/m.test(fmBlock)) return fmBlock;
  return fmBlock.replace(
    /(\r?\n)---(\r?\n?)$/,
    (_m, nl, tail) => `${nl}share_id: ${token}${nl}---${tail}`
  );
}

// Removes the `share_id: ...` line from the frontmatter (unshare), leaving the
// rest unchanged.
export function removeShareLine(fmBlock) {
  if (!fmBlock) return fmBlock;
  return fmBlock.replace(/^[ \t]*share_id[ \t]*:.*\r?\n/m, '');
}

// Frontmatter keys the type panel owns and may write (adr/0045), plus `visible`
// for the visibility manager (adr/0046). A closed list: everything else in the
// document is preserved verbatim, never re-serialized.
const SETTABLE_KEYS = new Set(['icon', 'color', 'order', 'visible']);
export function isSettableKey(k) {
  return SETTABLE_KEYS.has(k);
}

// Sets `<key>: <value>` in the frontmatter block, replacing the line in place if
// the key is there and appending it just before the closing `---` otherwise. A
// null/empty value removes the line instead. Only the key's own line is touched,
// so unknown keys — including the underscore-prefixed spellings this app reads
// but does not write — survive exactly as the author left them.
export function setFrontmatterKey(fmBlock, key, value) {
  const remove = value == null || value === '';
  const line = `${key}: ${value}`;
  const present = new RegExp(`^[ \\t]*${key}[ \\t]*:.*\\r?\\n`, 'm');
  if (!fmBlock) return remove ? '' : `---\n${line}\n---\n`;
  if (present.test(fmBlock)) {
    return remove
      ? fmBlock.replace(present, '')
      : fmBlock.replace(present, (m) => `${line}${m.endsWith('\r\n') ? '\r\n' : '\n'}`);
  }
  if (remove) return fmBlock;
  return fmBlock.replace(/(\r?\n)---(\r?\n?)$/, (_m, nl, tail) => `${nl}${line}${nl}---${tail}`);
}

// Rewrites the `type:` value when a type is renamed, and only when the line
// currently holds the old name — a note whose type drifted meanwhile is left
// alone rather than being reassigned by a stale rename.
export function retypeLine(fmBlock, from, to) {
  if (!fmBlock) return fmBlock;
  return fmBlock.replace(
    /^([ \t]*type[ \t]*:[ \t]*)(.*?)([ \t]*\r?\n)/m,
    (m, head, val, tail) => {
      const bare = val.replace(/^["']|["']$/g, '').trim();
      return bare === from ? `${head}${to}${tail}` : m;
    }
  );
}

// Replaces the document's H1 — the type's name lives there, not in the filename.
export function setH1(body, title) {
  if (/^#[ \t]+.+$/m.test(body)) return body.replace(/^#[ \t]+.*$/m, `# ${title}`);
  // No H1 yet: put one at the top, keeping whatever body follows.
  const rest = body.replace(/^\n+/, '');
  return rest ? `# ${title}\n\n${rest}` : `# ${title}\n`;
}

// Applies a file's operations: body replacement, share_id add/remove, the type
// panel's frontmatter keys, a type rename, and the H1. The rest of the
// frontmatter is always preserved.
export function applyOps(rawCurrent, op) {
  let fm = (rawCurrent.match(FRONTMATTER) || [''])[0];
  let body = typeof op.body === 'string' ? op.body : rawCurrent.slice(fm.length);
  if (op.unshare) fm = removeShareLine(fm);
  else if (op.shareId) fm = ensureShareId(fm, String(op.shareId));
  if (op.frontmatter && typeof op.frontmatter === 'object') {
    for (const [k, v] of Object.entries(op.frontmatter)) {
      if (isSettableKey(k)) fm = setFrontmatterKey(fm, k, v);
    }
  }
  if (op.retype && op.retype.from && op.retype.to) {
    fm = retypeLine(fm, String(op.retype.from), String(op.retype.to));
  }
  if (typeof op.h1 === 'string' && op.h1) body = setH1(body, op.h1);
  return fm + body;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '';
  }
}

function decodeBase64Utf8(b64) {
  const bin = atob(String(b64).replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function utf8Bytes(s) {
  return new TextEncoder().encode(s).length;
}

function gh(env, path, init = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'web-vault-commit',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
}

const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');

// Returns the Pages Function handler. `config` is build-injected (see
// generate-functions.mjs); runtime env always wins over it.
export function makeCommitHandler(config = {}) {
  return async function onRequestPost({ request, env }) {
    if (!env.GITHUB_TOKEN) {
      return json({ error: 'GITHUB_TOKEN not configured' }, 500);
    }
    const repo = env.GITHUB_REPO || config.repo || '';
    if (!repo) {
      return json({ error: 'repo not configured (set GITHUB_REPO)' }, 500);
    }
    const branch = env.GITHUB_BRANCH || config.buildBranch || 'main';

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400);
    }

    const message = (payload?.message ?? '').toString().trim() || 'Update notes from web editor';
    const files = Array.isArray(payload?.files) ? payload.files : [];
    if (!files.length) return json({ error: 'no files to commit' }, 400);
    if (files.length > MAX_FILES) return json({ error: `too many files (max ${MAX_FILES})` }, 400);
    for (const f of files) {
      if (!isSafeNotePath(f?.path)) return json({ error: `invalid path: ${f?.path}` }, 400);
      const isNew = f?.isNew === true;
      const hasContent = typeof f?.content === 'string';
      const hasBody = typeof f?.body === 'string';
      const hasShare = f?.shareId != null && f?.shareId !== '';
      const hasUnshare = f?.unshare === true;
      const hasDelete = f?.delete === true;
      if (isNew) {
        // Creation: the client supplies the full file content verbatim.
        if (!hasContent) return json({ error: `missing content for new note: ${f?.path}` }, 400);
        if (utf8Bytes(f.content) > MAX_BYTES) return json({ error: `note too large: ${f.path}` }, 413);
        continue;
      }
      if (hasDelete) continue; // deletion needs only the path
      // Type-panel operations (adr/0045): a closed set of frontmatter keys, a
      // type rename, and the H1 that carries the type's name.
      const hasFm = f?.frontmatter != null && typeof f.frontmatter === 'object';
      const hasRetype = f?.retype != null && typeof f.retype === 'object';
      const hasH1 = typeof f?.h1 === 'string' && f.h1 !== '';
      if (!hasBody && !hasShare && !hasUnshare && !hasFm && !hasRetype && !hasH1) {
        return json({ error: `no operation for ${f?.path}` }, 400);
      }
      if (hasBody && utf8Bytes(f.body) > MAX_BYTES) return json({ error: `note too large: ${f.path}` }, 413);
      if (hasShare && !SAFE_ID.test(String(f.shareId))) return json({ error: `invalid share_id: ${f.path}` }, 400);
      if (hasFm) {
        for (const [k, v] of Object.entries(f.frontmatter)) {
          if (!isSettableKey(k)) return json({ error: `frontmatter key not settable: ${k}` }, 400);
          // A value must stay a single frontmatter line: no newline may smuggle
          // extra keys into the block.
          if (v != null && /[\r\n]/.test(String(v))) {
            return json({ error: `invalid value for ${k}: ${f.path}` }, 400);
          }
        }
      }
      if (hasRetype && (!f.retype.from || !f.retype.to || /[\r\n]/.test(String(f.retype.to)))) {
        return json({ error: `invalid retype for ${f.path}` }, 400);
      }
      if (hasH1 && /[\r\n]/.test(f.h1)) return json({ error: `invalid h1 for ${f.path}` }, 400);
    }

    // 1. SHA of the commit at the tip of the branch.
    const refRes = await gh(env, `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    if (!refRes.ok) {
      return json({ error: `branch "${branch}" not found`, detail: await safeText(refRes) }, 502);
    }
    const baseCommitSha = (await refRes.json()).object.sha;

    // 2. Base tree.
    const baseCommitRes = await gh(env, `/repos/${repo}/git/commits/${baseCommitSha}`);
    if (!baseCommitRes.ok) return json({ error: 'base commit not readable' }, 502);
    const baseTreeSha = (await baseCommitRes.json()).tree.sha;

    // 3. For each file: re-read the current one (for the frontmatter), compute the
    //    new content, and skip no-ops.
    const treeEntries = [];
    const committed = [];
    for (const f of files) {
      if (f.isNew) {
        // New note: the file must NOT already exist (avoid clobbering). 404 is the
        // expected, happy path; a 200 means a filename collision the client didn't
        // foresee (e.g. a note created from the desktop app since the last build).
        const curRes = await gh(env, `/repos/${repo}/contents/${encPath(f.path)}?ref=${encodeURIComponent(branch)}`);
        if (curRes.ok) return json({ error: `a note already exists at ${f.path}` }, 409);
        if (curRes.status !== 404) return json({ error: `read failed: ${f.path}`, detail: await safeText(curRes) }, 502);
        treeEntries.push({ path: f.path, mode: '100644', type: 'blob', content: f.content });
        committed.push(f.path);
        continue;
      }
      if (f.delete) {
        // Deletion: `sha: null` in the tree removes the file. If it is already
        // gone (404), treat it as a no-op.
        const curRes = await gh(env, `/repos/${repo}/contents/${encPath(f.path)}?ref=${encodeURIComponent(branch)}`);
        if (curRes.status === 404) continue;
        if (!curRes.ok) return json({ error: `read failed: ${f.path}`, detail: await safeText(curRes) }, 502);
        treeEntries.push({ path: f.path, mode: '100644', type: 'blob', sha: null });
        committed.push(f.path);
        continue;
      }
      const curRes = await gh(env, `/repos/${repo}/contents/${encPath(f.path)}?ref=${encodeURIComponent(branch)}`);
      if (curRes.status === 404) return json({ error: `note does not exist: ${f.path}` }, 404);
      if (!curRes.ok) return json({ error: `read failed: ${f.path}`, detail: await safeText(curRes) }, 502);
      const cur = await curRes.json();
      const rawCurrent = decodeBase64Utf8(cur.content);
      const newContent = applyOps(rawCurrent, f);
      if (newContent === rawCurrent) continue; // no real change
      treeEntries.push({ path: f.path, mode: '100644', type: 'blob', content: newContent });
      committed.push(f.path);
    }
    if (!treeEntries.length) {
      return json({ sha: baseCommitSha, committed: [], noop: true });
    }

    // 4. Create the tree on top of the base one.
    const treeRes = await gh(env, `/repos/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
    });
    if (!treeRes.ok) return json({ error: 'tree creation failed', detail: await safeText(treeRes) }, 502);
    const newTreeSha = (await treeRes.json()).sha;

    // 5. Create the commit.
    const commitRes = await gh(env, `/repos/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message, tree: newTreeSha, parents: [baseCommitSha] }),
    });
    if (!commitRes.ok) return json({ error: 'commit creation failed', detail: await safeText(commitRes) }, 502);
    const newCommitSha = (await commitRes.json()).sha;

    // 6. Fast-forward the ref (force:false): if the branch has advanced in the
    //    meantime (e.g. a commit from the desktop app) it fails -> 409, and the UI
    //    prompts to reload.
    const updRes = await gh(env, `/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommitSha, force: false }),
    });
    if (!updRes.ok) {
      return json(
        { error: 'the repo changed in the meantime: reload and try again', detail: await safeText(updRes) },
        409
      );
    }

    return json({ sha: newCommitSha, committed });
  };
}
