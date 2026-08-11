import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// `build.dirty` means "built from a working tree with uncommitted changes",
// which only a local build can be. It drives the `+` on the commit chip and the
// "(uncommitted local changes)" line in its tooltip (adr/0012-*.md).
//
// It was computed as `!CF_PAGES_COMMIT_SHA`, correct while Cloudflare Pages was
// the substrate. adr/0040-*.md moved the deploy to Workers, which does not set
// that variable, so the probe began running on hosted builds — against a tree
// the build had just written its own artifacts into. Every production build
// reported local changes it did not have. These tests pin the detection to the
// meaning rather than to one vendor's variable name.
const SCRIPTS = dirname(fileURLToPath(import.meta.url));

// The detection under test, read out of the build script rather than
// reimplemented here: a copy would pass while the real one stayed broken.
const SOURCE = readFileSync(join(SCRIPTS, 'build-content.mjs'), 'utf8');

/**
 * A throwaway git repo with one commit, optionally left dirty afterwards.
 * @param {{ dirty?: boolean }} [opts]
 */
function repo({ dirty = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wv-build-dirty-'));
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
  writeFileSync(join(dir, 'note.md'), '# committed\n');
  git('add', '.');
  git('commit', '-qm', 'first');
  if (dirty) {
    // What a hosted build actually leaves behind: its own generated output,
    // untracked, in the tree it would be probing.
    writeFileSync(join(dir, 'generated.json'), '{}');
  }
  return dir;
}

/**
 * Run the real `gitBuildInfo` against `vault`, under exactly `env` — the
 * ambient environment is dropped, so a CI variable set on the machine running
 * the suite cannot decide the answer (this suite runs on CI itself).
 * @param {string} vault
 * @param {Record<string, string>} env
 */
function buildInfo(vault, env) {
  // The function is module-private and the module runs a full build on import,
  // so it is lifted out by source and evaluated on its own.
  const start = SOURCE.indexOf('const isHostedBuild');
  const end = SOURCE.indexOf('const build = gitBuildInfo(');
  expect(start, 'isHostedBuild not found in build-content.mjs').toBeGreaterThan(-1);
  expect(end, 'gitBuildInfo call site not found in build-content.mjs').toBeGreaterThan(start);
  const src =
    `import { execFileSync } from 'node:child_process';\n` +
    // frameworkVersion() reads this package's package.json; it is not under
    // test and must not fail the extraction.
    `const frameworkVersion = () => '0.0.0-test';\n` +
    SOURCE.slice(start, end) +
    `process.stdout.write(JSON.stringify(gitBuildInfo(${JSON.stringify(vault)})));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', src], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
    // These repos have no remote, which `gitBuildInfo` handles by leaving
    // `repo` empty — git still writes to stderr on the way, and that is not
    // this suite's output.
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(out);
}

describe('the dirty flag on the build chip', () => {
  it('is false on a Workers build, however dirty the build directory looks', () => {
    // The regression case. adr/0040-*.md: WORKERS_CI_BRANCH is what the current
    // substrate sets, and the tree is dirty because the build wrote to it.
    const dir = repo({ dirty: true });
    try {
      expect(buildInfo(dir, { WORKERS_CI_BRANCH: 'main' }).dirty).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is false on a transitional Pages build', () => {
    const dir = repo({ dirty: true });
    try {
      const info = buildInfo(dir, { CF_PAGES_COMMIT_SHA: 'a'.repeat(40) });
      expect(info.dirty).toBe(false);
      // Pages supplies the SHA directly; the chip shows that commit.
      expect(info.sha).toBe('a'.repeat(40));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is false on any hosted runner that only sets CI', () => {
    // The substrate-agnostic backstop: the next move should not need this
    // function edited again.
    const dir = repo({ dirty: true });
    try {
      expect(buildInfo(dir, { CI: 'true' }).dirty).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is true for a local build with uncommitted changes', () => {
    // The affordance the flag exists for, unchanged.
    const dir = repo({ dirty: true });
    try {
      expect(buildInfo(dir, {}).dirty).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is false for a local build on a clean tree', () => {
    const dir = repo();
    try {
      const info = buildInfo(dir, {});
      expect(info.dirty).toBe(false);
      // No Pages variable, so the SHA comes from the checkout — which is also
      // how a Workers build resolves it.
      expect(info.short).toMatch(/^[0-9a-f]{7}$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
