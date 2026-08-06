// Dev only: regenerate .wv/content.json when the vault changes.
//
// `wv dev` generates content.json once and then starts Vite, so without this an
// edit made in the vault (Obsidian, Tolaria, an editor) is invisible until the
// server is restarted. The other half of the loop already exists: virtualContent()
// in lib/vite-config.mjs calls addWatchFile(CONTENT_JSON), so rewriting that file
// invalidates the virtual module and pushes an HMR update. This plugin supplies
// the missing half — a watcher on the vault's own files that re-runs generation.
//
// Generation runs build-content.mjs as a SUBPROCESS rather than in-process. That
// script is top-level (it reads the vault and writes content.json at import time,
// exporting nothing), and spawning it keeps dev byte-for-byte identical to
// `wv gen` / `wv build` instead of growing a second copy of the pipeline.
// See plan/done/2026-08-05-dev-server-vault-watch.md.
import { spawn } from 'node:child_process';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWalkedNote } from './content-ignore.mjs';
import { VAULT_DIR, ATTACHMENTS_DIR, VIEWS_DIR } from './paths.mjs';

const BUILD_CONTENT = join(dirname(fileURLToPath(import.meta.url)), 'build-content.mjs');

// Collapse editor saves, sync clients and `git checkout` bursts into one run.
const DEBOUNCE_MS = 150;

// A change under views/ or attachments/ matters even though the note walker
// skips those directories: views/ feeds the saved-view list, and attachments
// are served from disk by attachmentsDev() but still want a refresh.
function isRelevant(file) {
  if (file === VIEWS_DIR || file === ATTACHMENTS_DIR) return false;
  if (file.startsWith(VIEWS_DIR + sep) || file.startsWith(ATTACHMENTS_DIR + sep)) return true;
  const rel = relative(VAULT_DIR, file);
  return isWalkedNote(rel);
}

export function contentWatchDev() {
  return {
    name: 'content-watch-dev',
    apply: 'serve',
    configureServer(server) {
      let timer = null;
      let running = false;
      let queued = false;

      function regenerate() {
        // Serialise: a change arriving mid-run queues exactly one follow-up
        // instead of spawning overlapping generations that race on the file.
        if (running) {
          queued = true;
          return;
        }
        running = true;
        const startedAt = Date.now();
        // stdout is dropped: build-content.mjs prints a '[gen] N notes' line
        // suited to a one-shot build, and repeating it on every keystroke is
        // noise. The concise line logged on success below replaces it, so a
        // reload is still visible in the dev output.
        const child = spawn(process.execPath, [...process.execArgv, BUILD_CONTENT], {
          stdio: ['ignore', 'ignore', 'pipe'],
          cwd: process.cwd(),
          env: process.env,
        });
        let stderr = '';
        child.stderr.on('data', (c) => { stderr += c; });
        const finish = (ok) => {
          running = false;
          if (ok) {
            server.config.logger.info(
              `[wv] vault changed, content reloaded in ${Date.now() - startedAt}ms`,
              { timestamp: true },
            );
          } else {
            // Leave the previous content.json in place and keep the server up:
            // a note with malformed frontmatter should not end the dev session.
            server.config.logger.error(
              `[wv] content regeneration failed, serving the last good content:\n${stderr.trim()}`,
              { timestamp: true },
            );
          }
          if (queued) {
            queued = false;
            regenerate();
          }
        };
        child.on('exit', (code) => finish(code === 0));
        child.on('error', (err) => {
          stderr += err.message;
          finish(false);
        });
      }

      function schedule(file) {
        if (!isRelevant(file)) return;
        clearTimeout(timer);
        timer = setTimeout(regenerate, DEBOUNCE_MS);
      }

      // Vite's watcher is rooted at the PACKAGE (see createViteConfig), so the
      // vault is outside it and must be added explicitly.
      server.watcher.add([VAULT_DIR, ATTACHMENTS_DIR, VIEWS_DIR]);
      server.watcher.on('add', schedule);
      server.watcher.on('change', schedule);
      server.watcher.on('unlink', schedule);
    },
  };
}
