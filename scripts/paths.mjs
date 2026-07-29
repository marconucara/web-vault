// Central path resolution for the build scripts.
//
// Everything is resolved from the CONSUMER's working directory (the `.web`
// folder where the `wv` bin is invoked), NOT from this package's location.
// This is what lets the app and build scripts live inside the package
// (node_modules) while reading the vault and writing output into the consumer
// project. Previously each script did `WEB = join(__dirname, '..')`; now that
// same `WEB` is `process.cwd()`.
import { join, resolve, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The consumer project dir (the `.web`). `wv` is always run from here.
export const PROJECT_DIR = process.cwd();

// The vault: parent of the project by default, overridable via VAULT_DIR.
export const VAULT_DIR = process.env.VAULT_DIR
  ? (isAbsolute(process.env.VAULT_DIR)
      ? process.env.VAULT_DIR
      : resolve(PROJECT_DIR, process.env.VAULT_DIR))
  : join(PROJECT_DIR, '..');

// This package's own root (scripts/..). Used as Vite `root` and to locate
// index.html / src inside the package.
export const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Generated, gitignored, consumer-side. Replaces src/generated (which used to
// live inside the app source).
export const GEN_DIR = join(PROJECT_DIR, '.wv');
export const CONTENT_JSON = join(GEN_DIR, 'content.json');

// Build output and Cloudflare Pages conventions, consumer-side.
export const DIST_DIR = join(PROJECT_DIR, 'dist');
export const PUBLIC_DIR = join(PROJECT_DIR, 'public');
export const FUNCTIONS_DIR = join(PROJECT_DIR, 'functions');

// Vault sub-locations.
export const ATTACHMENTS_DIR = join(VAULT_DIR, 'attachments');
export const VIEWS_DIR = join(VAULT_DIR, 'views');
