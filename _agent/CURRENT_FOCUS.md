# Current Focus

This file is the LIVE SNAPSHOT of any in-flight session. It is short on purpose
— the durable record lives in git (`git log`), `_agent/WORKLOG.md`, and
`plan/done/`. The queued work lives in `plan/todo/`.

If status files and git disagree, git is authoritative; correct this file.

## Active state

- **Branch:** main
- **Active item:** none in flight.
- **Blockers:** none.
- **Uncommitted work:** none.

## Last shipped

- Initial import (this commit, tag **`v0.1.0`**): the web-vault framework package
  + the docflow catalogue. ADRs `0001`–`0029` — all Implemented except `0029`
  (Accepted). See `INDEX.md`.
- Distribution validated outside this repo (recorded here since git can't show
  it): the package installs as a git dependency
  (`github:marconucara/web-vault#v0.1.0` → `wv build` yields a full `dist/`), and
  the reference consumer (the `marconucaravault` vault's `.web`) builds green on
  Cloudflare Pages, preview and production.

## Next item

Two queued items, both under ADR `0029` (Accepted):

1. `plan/todo/0001-agent-driven-setup.md` — the **onboarding spec** an agent
   follows to install web-vault into *any* Markdown vault: point at the vault, add
   the `github:` dependency at a tag, write the thin consumer config (`package.json`
   scripts → `wv`, `wrangler.toml`, `public/_headers`, `.env.example`, and a
   `.gitignore` for `.wv/` + `functions/` + `dist/`). No wizard, no interactive
   `npx`. Reference implementation = the `.web` consumer in the `marconucaravault`
   repo; generalise it (strip vault-specific identity; `VAULT_DIR` defaults to
   `../`).
2. `plan/todo/0002-public-repo-distribution.md` — install-from-public-repo is
   already proven; the remaining piece is **documenting** it: the repo **README**
   (what web-vault is, install as a git dependency at a tag, the `wv` commands, the
   Cloudflare deploy + Zero-Trust runbook). Keep ADR numbers/titles out of the
   user-facing README prose (CONVENTIONS §ADR Privacy) — name behaviours instead.

On ship: `git mv` the todo to `plan/done/`, advance ADR `0029` → Implemented when
both are done, regenerate `INDEX.md`, append a `WORKLOG.md` row.

## Environment notes for a fresh agent

- Commits in THIS repo are **SSH-signed** (local config: `gpg.format=ssh`,
  `user.signingkey=~/.ssh/id_rsa.pub`; author Marco Nucara <marco.nucara@gmail.com>).
- **Never** add `Co-Authored-By: Claude` or `Claude-Session:` trailers to commits.
- Keep the package **vault-agnostic**: the consumer lives in a separate repo; no
  hardcoded vault identity here.
