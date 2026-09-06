import { describe, expect, it } from 'vitest';
import {
  applyOps,
  ensureShareId,
  isSafeNotePath,
  isSettableKey,
  reconstructFile,
  removeShareLine,
  retypeLine,
  setFrontmatterKey,
  setH1,
  makeCommitHandler,
} from './commit.js';

const FM = (...lines) => `---\n${lines.join('\n')}\n---\n`;

describe('frontmatter line operations (ADR 0022)', () => {
  it('replaces the body while keeping the frontmatter block verbatim', () => {
    const raw = `${FM('type: Person', 'weird_key: [a, b]')}\n# Ada\n\nold body\n`;
    const out = reconstructFile(raw, '\n# Ada\n\nnew body\n');
    expect(out).toContain('weird_key: [a, b]');
    expect(out).toContain('new body');
    expect(out).not.toContain('old body');
  });

  it('adds and removes share_id without touching the other keys', () => {
    const fm = FM('type: Person', 'order: 3');
    const shared = ensureShareId(fm, 'abc123');
    expect(shared).toContain('share_id: abc123');
    expect(shared).toContain('order: 3');
    // Already present: left alone rather than duplicated.
    expect(ensureShareId(shared, 'other')).toBe(shared);
    expect(removeShareLine(shared)).toBe(fm);
  });
});

describe('type panel frontmatter keys (ADR 0045, criterion 6)', () => {
  it('sets a key in place when present and appends it when missing', () => {
    const fm = FM('type: Type', 'icon: user');
    // In place: the line is replaced where it already sits.
    expect(setFrontmatterKey(fm, 'icon', 'book')).toBe(FM('type: Type', 'icon: book'));
    // Missing: appended just before the closing delimiter.
    expect(setFrontmatterKey(fm, 'order', 2)).toBe(FM('type: Type', 'icon: user', 'order: 2'));
  });

  it('removes the line on an empty value instead of writing a blank key', () => {
    const fm = FM('type: Type', 'icon: user', 'color: red');
    expect(setFrontmatterKey(fm, 'color', null)).toBe(FM('type: Type', 'icon: user'));
    expect(setFrontmatterKey(fm, 'color', '')).toBe(FM('type: Type', 'icon: user'));
    // Removing an absent key changes nothing.
    expect(setFrontmatterKey(fm, 'order', null)).toBe(fm);
  });

  it('preserves every key the panel does not own, including underscore aliases', () => {
    const fm = FM('type: Type', '_organized: true', 'aliases: [a, b]', 'icon: user');
    const out = setFrontmatterKey(fm, 'icon', 'book');
    expect(out).toContain('_organized: true');
    expect(out).toContain('aliases: [a, b]');
    expect(out).toContain('icon: book');
  });

  it('creates a minimal block when the file has no frontmatter', () => {
    expect(setFrontmatterKey('', 'icon', 'user')).toBe('---\nicon: user\n---\n');
    // ...but does not create one just to remove a key.
    expect(setFrontmatterKey('', 'icon', null)).toBe('');
  });

  it('only allows the keys the panel owns', () => {
    expect(isSettableKey('icon')).toBe(true);
    expect(isSettableKey('order')).toBe(true);
    expect(isSettableKey('share_id')).toBe(false);
    expect(isSettableKey('type')).toBe(false);
  });
});

describe('type rename (ADR 0045, criterion 7)', () => {
  it('rewrites `type:` only when it currently holds the old name', () => {
    expect(retypeLine(FM('type: Person'), 'Person', 'Human')).toBe(FM('type: Human'));
    // A note whose type drifted meanwhile is not reassigned by a stale rename.
    expect(retypeLine(FM('type: Place'), 'Person', 'Human')).toBe(FM('type: Place'));
  });

  it('matches a quoted value and leaves the rest of the block alone', () => {
    const out = retypeLine(FM('type: "Person"', 'order: 1'), 'Person', 'Human');
    expect(out).toBe(FM('type: Human', 'order: 1'));
  });

  it('replaces the H1 that carries the type name, or adds one', () => {
    expect(setH1('# Person\n\nA human being.\n', 'Human')).toBe('# Human\n\nA human being.\n');
    expect(setH1('no heading here\n', 'Human')).toBe('# Human\n\nno heading here\n');
    // Only the first H1 moves; a `#` deeper in the body is left alone.
    expect(setH1('# Person\n\n## Notes\n', 'Human')).toBe('# Human\n\n## Notes\n');
  });
});

describe('applyOps composition', () => {
  it('applies frontmatter keys, a retype and the H1 in one pass', () => {
    const raw = `${FM('type: Type', '_organized: true', 'icon: user')}\n# Person\n\nPeople I know.\n`;
    const out = applyOps(raw, {
      frontmatter: { icon: 'users', color: 'blue', order: 1 },
      h1: 'Human',
    });
    expect(out).toContain('icon: users');
    expect(out).toContain('color: blue');
    expect(out).toContain('order: 1');
    expect(out).toContain('_organized: true'); // untouched
    expect(out).toContain('# Human');
    expect(out).toContain('People I know.'); // body preserved
  });

  it('ignores frontmatter keys outside the settable set', () => {
    const raw = `${FM('type: Type')}\n# Person\n`;
    // Defence in depth: the handler rejects these, and applyOps drops them too.
    expect(applyOps(raw, { frontmatter: { share_id: 'sneaky' } })).not.toContain('sneaky');
  });

  it('rewrites a carrying note without disturbing its body', () => {
    const raw = `${FM('type: Person', 'tags: [friend]')}\n# Ada\n\nMet in 1843.\n`;
    const out = applyOps(raw, { retype: { from: 'Person', to: 'Human' } });
    expect(out).toBe(`${FM('type: Human', 'tags: [friend]')}\n# Ada\n\nMet in 1843.\n`);
  });
});

describe('path safety', () => {
  it('keeps rejecting traversal, hidden dirs and non-markdown paths', () => {
    expect(isSafeNotePath('notes/ada.md')).toBe(true);
    expect(isSafeNotePath('../secret.md')).toBe(false);
    expect(isSafeNotePath('.web/config.md')).toBe(false);
    expect(isSafeNotePath('notes/ada.txt')).toBe(false);
  });
});

describe('type visibility frontmatter (ADR 0046, criterion 7)', () => {
  it('accepts visible as a settable key', () => {
    expect(isSettableKey('visible')).toBe(true);
    // The underscore form is not writable either: nothing in the app writes it.
    expect(isSettableKey('_visible')).toBe(false);
  });

  it('writes visible: false without disturbing the other keys', () => {
    const fm = FM('type: Type', 'order: 0', '_organized: true');
    const out = setFrontmatterKey(fm, 'visible', false);
    expect(out).toContain('visible: false');
    expect(out).toContain('order: 0');
    expect(out).toContain('_organized: true');
  });

  it('removes the line when showing again, leaving the rest verbatim', () => {
    const fm = FM('type: Type', 'order: 0', 'visible: false', '_organized: true');
    const out = setFrontmatterKey(fm, 'visible', null);
    expect(out).not.toContain('visible');
    expect(out).toBe(FM('type: Type', 'order: 0', '_organized: true'));
  });

  it('is a no-op when showing a type that never carried the key', () => {
    // The common case: every type in a vault that predates the feature.
    const fm = FM('type: Type', 'icon: user');
    expect(setFrontmatterKey(fm, 'visible', null)).toBe(fm);
  });

  it('hides through applyOps without touching the body', () => {
    const raw = `${FM('type: Type', '_organized: true')}\n# Type\n\nHand-written description.\n`;
    const out = applyOps(raw, { frontmatter: { visible: false } });
    expect(out).toContain('visible: false');
    expect(out).toContain('Hand-written description.');
    expect(out).toContain('# Type');
  });

  it('round-trips: hiding then showing restores the original file', () => {
    const raw = `${FM('type: Type', 'order: 0', '_organized: true')}\n# Type\n\nWhat a type is.\n`;
    const hidden = applyOps(raw, { frontmatter: { visible: false } });
    const shown = applyOps(hidden, { frontmatter: { visible: null } });
    expect(shown).toBe(raw);
  });
});

// --- the drift preflight (ADR 0050) -----------------------------------------
//
// These exercise the handler itself rather than the pure helpers above, so the
// GitHub API is faked: a small in-memory repo plus a recording of every call the
// handler makes. What matters is not only the status it returns but WHICH calls
// it made — a refused commit must not have created a tree or a commit object.

/**
 * A fake GitHub. `files` maps path -> { sha, content }.
 * Returns the handler's `fetch` plus the log of calls it received.
 */
function fakeGitHub({ files = {}, tipSha = 'tip0', treeSha = 'tree0' } = {}) {
  const calls = [];
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
  const fetch = async (url, init = {}) => {
    const method = init.method || 'GET';
    const path = String(url).replace('https://api.github.com', '').split('?')[0];
    calls.push(`${method} ${path}`);
    const res = (body, status = 200) => ({
      ok: status < 400,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
    if (path.startsWith('/repos/o/r/git/ref/heads/')) return res({ object: { sha: tipSha } });
    if (path.startsWith(`/repos/o/r/git/commits/${tipSha}`)) return res({ tree: { sha: treeSha } });
    if (path.startsWith('/repos/o/r/contents/')) {
      const p = decodeURIComponent(path.slice('/repos/o/r/contents/'.length));
      const f = files[p];
      if (!f) return res({ message: 'Not Found' }, 404);
      return res({ sha: f.sha, content: b64(f.content) });
    }
    if (method === 'POST' && path === '/repos/o/r/git/trees') return res({ sha: 'newtree' });
    if (method === 'POST' && path === '/repos/o/r/git/commits') return res({ sha: 'newcommit' });
    if (method === 'PATCH' && path.startsWith('/repos/o/r/git/refs/heads/')) return res({});
    return res({ message: `unexpected ${method} ${path}` }, 500);
  };
  return { fetch, calls };
}

async function runCommit(files, gh) {
  const prev = globalThis.fetch;
  globalThis.fetch = gh.fetch;
  try {
    const handler = makeCommitHandler({ repo: 'o/r', buildBranch: 'main' });
    const res = await handler({
      request: { json: async () => ({ message: 'm', files }) },
      env: { GITHUB_TOKEN: 't' },
    });
    return { status: res.status, body: JSON.parse(await res.text()) };
  } finally {
    globalThis.fetch = prev;
  }
}

describe('commit-time drift detection (ADR 0050)', () => {
  const note = { sha: 'blobA', content: `${FM('type: Note')}\n# N\n\nremote body\n` };

  it('commits when the note still holds the content the edit started from', () => {
    const gh = fakeGitHub({ files: { 'n.md': note } });
    return runCommit([{ path: 'n.md', body: '\n# N\n\nmine\n', baseSha: 'blobA' }], gh).then((r) => {
      expect(r.status).toBe(200);
      expect(r.body.committed).toEqual(['n.md']);
    });
  });

  it('refuses when the note changed elsewhere, and returns the remote content', async () => {
    const gh = fakeGitHub({ files: { 'n.md': note } });
    // The edit began at blobOLD; the branch now holds blobA.
    const r = await runCommit([{ path: 'n.md', body: '\n# N\n\nmine\n', baseSha: 'blobOLD' }], gh);
    expect(r.status).toBe(409);
    expect(r.body.reason).toBe('drift');
    expect(r.body.drifted).toHaveLength(1);
    expect(r.body.drifted[0].path).toBe('n.md');
    expect(r.body.drifted[0].remote).toContain('remote body');
    expect(r.body.drifted[0].remoteSha).toBe('blobA');
  });

  it('reports the drifted note as a body, not as the whole file', async () => {
    // The client only ever holds the body, so returning the frontmatter would
    // put lines on one side of the comparison that cannot exist on the other —
    // every one of them a difference the user is asked to resolve for nothing.
    const gh = fakeGitHub({ files: { 'n.md': note } });
    const r = await runCommit([{ path: 'n.md', body: '\n# N\n\nmine\n', baseSha: 'blobOLD' }], gh);
    expect(r.body.drifted[0].remote).toContain('remote body');
    expect(r.body.drifted[0].remote).not.toContain('type: Note');
    expect(r.body.drifted[0].remote.startsWith('---')).toBe(false);
  });

  it('writes nothing at all when it refuses', async () => {
    const gh = fakeGitHub({ files: { 'n.md': note } });
    await runCommit([{ path: 'n.md', body: '\n# N\n\nmine\n', baseSha: 'blobOLD' }], gh);
    // The refusal happens before anything is built: no tree, no commit, no ref move.
    expect(gh.calls).not.toContain('POST /repos/o/r/git/trees');
    expect(gh.calls).not.toContain('POST /repos/o/r/git/commits');
    expect(gh.calls.some((c) => c.startsWith('PATCH'))).toBe(false);
  });

  it('refuses the whole batch when a single note drifted', async () => {
    const gh = fakeGitHub({
      files: { 'a.md': { sha: 'blobA', content: '# A\n' }, 'b.md': { sha: 'blobB', content: '# B\n' } },
    });
    const r = await runCommit(
      [
        { path: 'a.md', body: '# A edited\n', baseSha: 'blobA' }, // clean
        { path: 'b.md', body: '# B edited\n', baseSha: 'blobSTALE' }, // drifted
      ],
      gh
    );
    expect(r.status).toBe(409);
    expect(r.body.drifted.map((d) => d.path)).toEqual(['b.md']);
    // The clean file is not committed either: the batch is atomic (adr/0019).
    expect(gh.calls).not.toContain('POST /repos/o/r/git/trees');
  });

  it('does not check an edit that carries no base', async () => {
    const gh = fakeGitHub({ files: { 'n.md': note } });
    // A draft older than this mechanism, or an untracked note: nothing to
    // compare against, so it behaves exactly as it did before.
    const r = await runCommit([{ path: 'n.md', body: '\n# N\n\nmine\n' }], gh);
    expect(r.status).toBe(200);
    expect(r.body.committed).toEqual(['n.md']);
  });

  it('hands back the identity of what it wrote', async () => {
    // The bug this exists to prevent: without a fresh base the client's copy of
    // the note has none, and the NEXT commit on it skips the drift check —
    // exactly the note someone is actively working on.
    const gh = fakeGitHub({ files: { 'n.md': note } });
    const r = await runCommit(
      [{ path: 'n.md', body: '\n# N\n\nmine\n', baseSha: 'blobA' }],
      gh
    );
    expect(r.status).toBe(200);
    expect(r.body.bases['n.md']).toMatch(/^[0-9a-f]{40}$/);
    // It is git's own blob hash of the content that was written, so the next
    // commit can be compared against the branch without a round trip.
    expect(r.body.bases['n.md']).not.toBe('blobA');
  });

  it('computes a blob sha git would agree with', async () => {
    // Pinned against a known value: `printf '' | git hash-object --stdin` and
    // `printf 'hello' | git hash-object --stdin`.
    const gh = fakeGitHub({ files: { 'n.md': { sha: 'blobA', content: 'x' } } });
    const r = await runCommit([{ path: 'n.md', body: 'hello', baseSha: 'blobA' }], gh);
    // applyOps on a file with no frontmatter yields the body verbatim.
    expect(r.body.bases['n.md']).toBe('b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0');
  });

  it('tags its refusals so the client can tell them apart', async () => {
    const gh = fakeGitHub({ files: { 'n.md': note } });
    // A new note colliding with an existing path is a different problem with a
    // different answer, and must not be mistaken for drift.
    const r = await runCommit([{ path: 'n.md', content: '# fresh\n', isNew: true }], gh);
    expect(r.status).toBe(409);
    expect(r.body.reason).toBe('exists');
  });
});
