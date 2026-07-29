// Copies the vault folder ../attachments into dist/attachments after `vite build`.
// The vault's .md files may link binary assets (PDF, images) with relative links
// like ../attachments/x.pdf; with hash routing the document stays at "/", so that
// link resolves to /attachments/x.pdf. Without this copy the file is not in the
// deploy and Cloudflare Pages responds with the 404 fallback (HTML) instead of
// the PDF. The site is entirely behind Cloudflare Access, so these assets stay
// private; the public pages live only under /shared/*.
import { cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ATTACHMENTS_DIR as SRC, DIST_DIR } from './paths.mjs';

const DEST = join(DIST_DIR, 'attachments');

if (!existsSync(SRC)) {
  console.log('[attachments] no vault attachments/ folder to copy.');
  process.exit(0);
}
if (!existsSync(DIST_DIR)) {
  console.error('[attachments] dist missing: run `vite build` first.');
  process.exit(1);
}

cpSync(SRC, DEST, { recursive: true });
console.log('[attachments] vault attachments/ -> dist/attachments');
