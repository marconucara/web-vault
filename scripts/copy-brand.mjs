// Copies the package's brand/ icon set into dist/ after `vite build`.
//
// These files (favicon, touch icon, PWA icons, manifest) are boilerplate —
// identical for every vault, no user-specific values — so the PACKAGE owns them
// and the consumer shell never carries them. Same shape as the _headers, the
// 404 and the Worker entry: produced at build time, not scaffolded by setup.
//
// Why not Vite's publicDir: that points at the CONSUMER's public/ (see
// paths.mjs), which is the adopter's override surface, not somewhere the
// framework can ship from. `wv dev` gets the same files through the brand-dev
// middleware in lib/vite-config.mjs.
//
// Consumer override: if the consumer ships their own public/<name>, `vite build`
// copied it into dist first and this script leaves it untouched — an adopter can
// rebrand any single file without forking the rest.
//
// ASSETS.md is authoring documentation and is deliberately not deployed.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_DIR, DIST_DIR, PUBLIC_DIR } from './paths.mjs';

const SRC = join(PACKAGE_DIR, 'brand');
const SKIP = new Set(['ASSETS.md']);

// The shared pages get their own copy of the favicon, one for all of them, at
// dist/shared/favicon.svg. The site root is behind Cloudflare Access while
// /shared/* is on a Bypass, so a public share page linking the root icon would
// have its request intercepted by the Access login and show a broken tab. One
// file inside the bypassed prefix, referenced as ../favicon.svg from each
// /shared/<uuid>/ page, keeps that off the duplicated-per-share path.
const SHARED_ICON = 'favicon.svg';

export function copyBrand({ src = SRC, dist = DIST_DIR, publicDir = PUBLIC_DIR } = {}) {
  const copied = [];
  const kept = [];
  for (const name of readdirSync(src).sort()) {
    if (SKIP.has(name)) continue;
    // The consumer's own copy is already in dist; don't clobber it.
    if (existsSync(join(publicDir, name))) {
      kept.push(name);
      continue;
    }
    copyFileSync(join(src, name), join(dist, name));
    copied.push(name);
  }

  // Mirror whichever favicon won above, so an adopter override reaches the
  // share pages too. Runs before build-shared.mjs creates the per-share dirs,
  // hence the mkdir.
  const rootIcon = join(dist, SHARED_ICON);
  if (existsSync(rootIcon)) {
    mkdirSync(join(dist, 'shared'), { recursive: true });
    copyFileSync(rootIcon, join(dist, 'shared', SHARED_ICON));
  }

  return { copied, kept };
}

// Only run when invoked as a script, so the tests can import copyBrand().
if (process.argv[1] && process.argv[1].endsWith('copy-brand.mjs')) {
  if (!existsSync(DIST_DIR)) {
    console.error('[brand] dist missing: run `vite build` first.');
    process.exit(1);
  }
  const { copied, kept } = copyBrand();
  console.log(`[brand] ${copied.length} icon file(s) -> dist/`);
  for (const name of kept) console.log(`[brand] dist/${name} kept from consumer public/${name}`);
}
