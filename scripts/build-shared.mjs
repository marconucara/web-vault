// Generates the public "share" pages in dist/shared/<share_id>/index.html.
// Runs AFTER `vite build` (dist exists): reads src/generated/content.json,
// takes the notes with a `share_id` frontmatter and for each writes a static,
// self-contained, isolated page (no data from other notes), with noindex.
// The rendering lives in shared-render.mjs (shared with the Vite dev middleware
// in vite.config.js, so `yarn dev` serves the same pages on demand).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildSharedMap, renderSharedPageForNote } from './shared-render.mjs';
import { CONTENT_JSON as CONTENT, DIST_DIR } from './paths.mjs';

const SHARED_OUT = join(DIST_DIR, 'shared');

function main() {
  if (!existsSync(CONTENT)) {
    console.error('[shared] content.json missing: run build-content.mjs first');
    process.exit(1);
  }
  const content = JSON.parse(readFileSync(CONTENT, 'utf8'));
  const { sharedUuidByNoteId, shareable } = buildSharedMap(content.notes);

  if (!shareable.length) {
    console.log('[shared] no notes with share_id.');
    return;
  }

  for (const note of shareable) {
    const html = renderSharedPageForNote(note, content, sharedUuidByNoteId);
    const uuid = sharedUuidByNoteId[note.id];
    const dir = join(SHARED_OUT, uuid);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
    console.log(`[shared] ${note.path} -> /shared/${uuid}/`);
  }
  console.log(`[shared] ${shareable.length} shared page(s) in dist/shared/.`);
}

main();
