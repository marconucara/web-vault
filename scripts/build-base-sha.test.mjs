import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Every note carries the identity of the content it was built from, so a commit
// can be refused when the note changed elsewhere in the meantime (adr/0050-*.md).
//
// The identity is the hash of the file's own bytes, NOT its SHA in HEAD, and the
// difference is what makes the mechanism work at all:
//
// - Under `wv dev` a write goes straight to disk and creates no git commit, so a
//   base read from HEAD would sit still while the file changed underneath it.
// - The vault's own git history moves on its own — Tolaria's AutoGit commits on
//   idle and on focus changes — so HEAD is not a stable reference for a draft
//   that is open. A content hash changes if and only if the content changes.
// - An untracked note gets a base like any other, so a note created in the
//   client is protected rather than silently exempt from the check.
const SCRIPTS = dirname(fileURLToPath(import.meta.url));

// The function under test is read out of the build script rather than
// reimplemented: a copy would keep passing while the real one broke.
const SOURCE = readFileSync(join(SCRIPTS, 'build-content.mjs'), 'utf8');

/** A throwaway git repo, seeded by `seed` before the first commit. */
function repo(seed) {
  const dir = mkdtempSync(join(tmpdir(), 'wv-base-sha-'));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
    });
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  seed(dir, git);
  return dir;
}

/** Run the real `gitBlobShas` against `vault` for `paths`. */
function blobShas(vault, paths) {
  const start = SOURCE.indexOf('function gitBlobShas');
  const end = SOURCE.indexOf('function makeSnippet');
  expect(start, 'gitBlobShas not found in build-content.mjs').toBeGreaterThan(-1);
  expect(end, 'makeSnippet not found after it').toBeGreaterThan(start);
  const src =
    `import { execFileSync } from 'node:child_process';\n` +
    SOURCE.slice(start, end) +
    `process.stdout.write(JSON.stringify(gitBlobShas(${JSON.stringify(vault)}, ${JSON.stringify(paths)})));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', src], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(out);
}

/** What git itself says the file's blob hash is. */
const hashOf = (dir, rel) =>
  execFileSync('git', ['hash-object', join(dir, rel)], { encoding: 'utf8' }).trim();

describe('the edit base a note carries', () => {
  it('is the hash of the file on disk', () => {
    const dir = repo((d, git) => {
      writeFileSync(join(d, 'note.md'), '# committed\n');
      git('add', '.');
      git('commit', '-qm', 'first');
    });
    try {
      expect(blobShas(dir, ['note.md'])['note.md']).toBe(hashOf(dir, 'note.md'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('follows the working copy, not HEAD, when the two differ', () => {
    // The case that decides the design. A dev write changes the file without
    // committing, and Tolaria's AutoGit may commit at any moment for reasons of
    // its own — so the base has to track the CONTENT, which is what the client
    // read and what the write path compares against.
    const dir = repo((d, git) => {
      writeFileSync(join(d, 'note.md'), '# committed\n');
      git('add', '.');
      git('commit', '-qm', 'first');
      writeFileSync(join(d, 'note.md'), '# changed, not committed\n');
    });
    try {
      const head = execFileSync('git', ['rev-parse', 'HEAD:note.md'], {
        cwd: dir,
        encoding: 'utf8',
      }).trim();
      const base = blobShas(dir, ['note.md'])['note.md'];
      expect(base).toBe(hashOf(dir, 'note.md'));
      expect(base).not.toBe(head); // the fixture is actually dirty
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('covers an untracked note', () => {
    // A note created in the client is not in git yet, but it is in the vault and
    // a second browser can overwrite it just as easily. Reading HEAD would leave
    // exactly these notes unprotected.
    const dir = repo((d, git) => {
      writeFileSync(join(d, 'note.md'), '# committed\n');
      git('add', '.');
      git('commit', '-qm', 'first');
      writeFileSync(join(d, 'fresh.md'), '# never added\n');
    });
    try {
      const shas = blobShas(dir, ['note.md', 'fresh.md']);
      expect(shas['fresh.md']).toBe(hashOf(dir, 'fresh.md'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('covers notes in subdirectories, and paths carrying spaces', () => {
    const dir = repo((d, git) => {
      mkdirSync(join(d, 'sub dir'));
      writeFileSync(join(d, 'sub dir', 'my note.md'), '# nested\n');
      git('add', '.');
      git('commit', '-qm', 'first');
    });
    try {
      const rel = 'sub dir/my note.md';
      expect(blobShas(dir, [rel])[rel]).toBe(hashOf(dir, rel));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('works in a vault with no commits at all', () => {
    // `hash-object` hashes bytes and needs no history, so a vault that was never
    // committed — or is not a git repo — still gets bases.
    const dir = repo((d) => {
      writeFileSync(join(d, 'note.md'), '# uncommitted\n');
    });
    try {
      expect(blobShas(dir, ['note.md'])['note.md']).toBe(hashOf(dir, 'note.md'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns nothing, rather than failing, when there are no notes', () => {
    const dir = repo((d, git) => {
      writeFileSync(join(d, 'note.md'), '# committed\n');
      git('add', '.');
      git('commit', '-qm', 'first');
    });
    try {
      expect(blobShas(dir, [])).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
