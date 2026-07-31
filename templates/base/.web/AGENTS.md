# AGENTS.md — .web (web-vault consumer)

`.web` is the deployment shell for this vault's web client. It is **not** a notes
vault: the vault's own note conventions (wikilinks, types, views, frontmatter) do
**not** apply here.

The application, build pipeline, and scripts live in the separate `web-vault`
package (a dependency in `package.json`). This folder holds **only
configuration** — change config here; app changes go to the `web-vault` package.

## How to use it

- `yarn dev` — local dev server
- `yarn build` — full static build into `./dist`
- `yarn preview` — serve the build

All wrap the `web-vault` `wv` CLI. Generated content and the Worker entry
(`.wv/`) and `dist/` are build artifacts (gitignored) — never edit or commit
them by hand.

## Rules

- Everything user-facing in the client is **English** (only vault note content
  may be non-English).
- Deploy **behind Cloudflare Access**; only `/shared/*` is public. Never expose
  the private vault.
