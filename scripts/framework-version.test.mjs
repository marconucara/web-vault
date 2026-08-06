import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// The framework version baked into the build must come from THIS package's
// package.json, never from the consumer project the build runs in. In this
// repo's own checkout the two coincide, so a regression here is invisible
// locally and only shows up once the package is installed in someone's vault:
// the app would report the adopter's shell version as its own. See adr/0037-*.md.
const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(SCRIPTS, '..');
const declared = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')).version;

// Resolve PACKAGE_DIR the way the build does — by importing paths.mjs — but
// from a cwd that is NOT this package, which is the situation in a real
// install. `wv` is always run from the consumer's `.web`, so process.cwd()
// there is the shell, not the framework.
function packageDirFromCwd(cwd) {
  const src = `import { PACKAGE_DIR } from ${JSON.stringify(join(SCRIPTS, 'paths.mjs'))};`
    + ` process.stdout.write(PACKAGE_DIR);`;
  return execFileSync(process.execPath, ['--input-type=module', '-e', src], {
    cwd,
    encoding: 'utf8',
  });
}

describe('framework version source', () => {
  it('declares a semver version in package.json', () => {
    // AC2 of adr/0037-*.md: the declared version is what a tag must match.
    expect(declared).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('resolves the package root independently of the working directory', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wv-consumer-'));
    try {
      // A stand-in for an adopter's `.web` shell: its own package.json, with a
      // different version. This is what PROJECT_DIR/VAULT_DIR would find.
      writeFileSync(
        join(tmp, 'package.json'),
        JSON.stringify({ name: 'my-vault-web', version: '9.9.9' }),
      );
      mkdirSync(join(tmp, 'sub'));

      for (const cwd of [tmp, join(tmp, 'sub')]) {
        const pkgDir = packageDirFromCwd(cwd);
        const version = JSON.parse(
          readFileSync(join(pkgDir, 'package.json'), 'utf8'),
        ).version;
        expect(version).toBe(declared);
        expect(version).not.toBe('9.9.9');
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
