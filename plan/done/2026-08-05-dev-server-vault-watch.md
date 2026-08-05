# Dev Server Reloads When the Vault Changes

**Owning ADR(s):** `adr/0003-stack-react-vite.md`, `adr/0002-build-time-content-pipeline.md`
**Dependencies:** None

## Context

`wv dev` generates `.wv/content.json` once (`build-content.mjs`) and then hands
off to Vite. Nothing regenerates it afterwards, so editing a note in the vault —
in Obsidian, in Tolaria, in an editor — leaves the running dev server serving
the snapshot taken at startup. The only way to see a change is to stop and
restart `wv dev`, which is the main friction in local development today.

The gap is narrow. The `virtualContent()` plugin in `lib/vite-config.mjs`
already calls `this.addWatchFile(CONTENT_JSON)`, so Vite invalidates the virtual
module and pushes an HMR update whenever `content.json` changes on disk. What is
missing is the other half: a watcher on the vault's own files that re-runs the
content generation when a source file changes. Once `content.json` is rewritten,
the existing chain does the rest.

The content build is a top-level script (it reads the vault and writes
`content.json` at import time, exporting nothing), so regeneration runs it as a
subprocess rather than calling into it. That keeps dev regeneration byte-for-byte
identical to `wv gen` and `wv build` — no second implementation of the pipeline
to drift out of sync.

## Scope

- A dev-only Vite plugin in `lib/vite-config.mjs` that watches the vault and
  regenerates `.wv/content.json` on change.
- Watch coverage:
  - Vault notes (`**/*.md`), honouring the same exclusions as the content
    walker: dotted directories, `node_modules`, `attachments`, `views`, and the
    `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` ignore list.
  - `views/` (saved views), so changing a saved view is reflected without a
    restart.
  - `attachments/`, so a new or replaced asset refreshes the page. These are
    already streamed from disk on demand by `attachmentsDev()`, so this only
    removes the need for a manual reload.
- Regeneration runs `build-content.mjs` as a subprocess, debounced so that a
  burst of writes (an editor save, a sync client, a `git checkout`) collapses
  into one run.
- Runs are serialised: a change arriving mid-run queues exactly one follow-up
  rather than spawning overlapping generations.
- Generation failures (malformed frontmatter, unparseable view YAML) are
  reported in the dev server output and leave the previous `content.json` in
  place; the server stays up.
- The watcher is `apply: 'serve'` only — no effect on `wv build` or `wv preview`.

## Out of scope

- Incremental regeneration of a single note. Rejected for now: it would
  duplicate the walker, the git date maps, the title index and the backlink
  derivation, and risks diverging from `wv build`. Revisit only if the full
  rescan proves too slow in practice.
- Preserving editor state across the reload (open note, scroll position,
  unsaved buffer). The virtual module update remounts the content; scoping the
  HMR boundary more tightly is a separate question.
- Watching the consumer project's own config or `.env`; those still need a
  restart.
- Any change to `wv build` / `wv preview`.

## Risks

`build-content.mjs` runs `git log` over the whole vault and resolves map links
on every invocation, so a full rescan is not free on a large vault. The maps
cache already absorbs most of the second cost. If the debounced rescan turns out
to be perceptibly slow, the mitigation is to reduce per-run work (cache the git
date maps for the life of the dev server), not to hand-roll an incremental path
— see Out of scope.

## Exit criteria

1. With `wv dev` running, editing a note's body in the vault updates the note in
   the browser without a manual reload and without restarting the server.
2. Creating a new note makes it appear in the note list; deleting one removes
   it; both without a restart.
3. Renaming a note, and editing a note that others link to, leaves wikilinks
   resolving correctly — the title index is rebuilt, not patched.
4. Editing a file under `views/` updates the corresponding saved view.
5. Adding or replacing a file under `attachments/` is reflected without a manual
   reload.
6. A burst of rapid writes triggers a single regeneration, not one per event.
7. A note with malformed frontmatter logs a readable error and leaves the dev
   server running on the last good `content.json`; fixing the note recovers
   without a restart.
8. `wv build` and `wv preview` output is byte-identical to before the change.
9. `yarn verify` green.

## Outcome

The HMR half of the loop already worked: `virtualContent()` invalidates the
virtual module on any `content.json` write. Only the watcher was missing, so the
change is one dev-only plugin plus the shared exclusion rules.

Those rules could not be exported from `build-content.mjs` as first planned —
that script generates on import, so the watcher importing it would have rewritten
`content.json` as a side effect at every server start. They moved to
`scripts/content-ignore.mjs`, a side-effect-free module that both the walker and
the watcher import, keeping one definition of what counts as a note.

Silencing the subprocess stdout removed the only signal that a reload had
happened. The watcher now logs its own concise line
(`[wv] vault changed, content reloaded in Nms`) instead of repeating the
one-shot build's `[gen] N notes` on every keystroke.

Verified against a live dev server on a scratch vault, and independently on a
real external vault: edit/create/delete/rename, views, attachments, a 10-write
burst collapsing to a single regeneration (~300ms), and malformed frontmatter
leaving the last good content served with the server up and recovering on fix.

Criterion 8 holds as a logically identical `dist/` listing, not byte-identical
output: two builds of unmodified code already produce different content hashes,
because `content.json` carries `builtAt` and the git SHA. That non-determinism
predates this work and is untouched by it.

No version bump: this is a dev-only improvement, deliberately left to ride along
with a later user-facing release. The owning ADRs were already `Implemented`, so
no status transition and no `INDEX.md` regeneration were needed.

**Shipped:** 2026-08-05 · ADR 0002, ADR 0003 (no revision; no status change)
