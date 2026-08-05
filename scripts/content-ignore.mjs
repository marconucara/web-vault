// The vault-walk exclusion rules, in a side-effect-free module.
//
// These live here rather than in build-content.mjs because that script is
// top-level: importing it reads the vault and writes content.json. The dev
// watcher needs the same rules to decide whether a changed file is one the
// walker would have picked up, and must be able to import them without
// triggering a generation.
import { extname, basename, sep } from 'node:path';

// Dotted names (.web, .tools, .git, ...) are skipped separately, by prefix.
export const IGNORE_DIRS = new Set(['node_modules', 'attachments', 'views']);
export const IGNORE_FILES = new Set(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']);

// True when `rel` (a vault-relative path) is a note the content walker would
// include. Mirrors walk() in build-content.mjs: dotted segments and ignored
// directories anywhere in the path exclude it, as does a non-.md extension or
// an ignored basename.
export function isWalkedNote(rel) {
  if (!rel || rel.startsWith('..')) return false;
  const parts = rel.split(sep);
  const dirs = parts.slice(0, -1);
  if (dirs.some((d) => d.startsWith('.') || IGNORE_DIRS.has(d))) return false;
  const name = basename(rel);
  if (name.startsWith('.')) return false;
  return extname(name) === '.md' && !IGNORE_FILES.has(name);
}
