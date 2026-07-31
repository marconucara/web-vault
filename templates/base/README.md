# WebVault starter template

A ready-to-deploy Markdown vault with [WebVault](https://github.com/marconucara/web-vault)
already wired in. Deploy it to Cloudflare Workers in a few clicks, get a working
web reader/editor with a small starter vault, then point it at your own notes.

New to WebVault? It's a static web viewer and editor for Markdown knowledge
vaults — browse notes in a browser, edit them with a WYSIWYG editor, and publish
isolated public share links. See the [WebVault README](https://github.com/marconucara/web-vault#readme).

## Deploy to Cloudflare

> ### ⚠️ Read this before clicking
>
> The deploy button clones this template into **your** GitHub account and sets up
> a Cloudflare Worker. The flow asks for a few things — set them like this:
>
> | Field | What to do |
> |-------|------------|
> | **Project name** | Your vault's name. It becomes the default URL (`<name>.<account>.workers.dev`). |
> | **Create private Git repository** | Off by default — **turn it on** (recommended): a vault should hold your private things. |
> | **Advanced settings → Build → Path** | **`/.web/`** |
> | **Variables / secrets** (in the flow) | **Skip them here** — set them afterwards (see below), so you don't have to guess build-vs-runtime. |

Click the button, then **come back here once the first build has finished** to continue:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/marconucara/web-vault/tree/main/templates/base)

After the first build your site is live — **public and read-only** — with the
starter vault. The two unlocks below are also waiting for you as a checklist in
the **welcome note** on the site itself.

## After deploying

### ✏️ 1. Turn on web editing — `GITHUB_TOKEN` (runtime secret)

Lets the in-browser editor commit changes back to your repo. Create a
**fine-grained GitHub token** with **Contents: write** on your new repository
only, then add it in **Worker → Settings → Variables and Secrets** as a **Secret**
named `GITHUB_TOKEN`. It lives only as a Worker secret and never enters the site
bundle. Until you set it, the site is read-only.

### 🔒 2. Make it private — Cloudflare Access (⚠️ important)

Gate the whole site with **Cloudflare Access / Zero Trust**, keeping only
`/shared/*` public. The exact hostname syntax for `*.workers.dev` (production +
preview) and the `/shared` `Bypass` are in WebVault's
[**DEPLOY.md**](https://github.com/marconucara/web-vault/blob/v0.4.0/DEPLOY.md#3-gate-the-site-with-cloudflare-access) —
the full runbook for tokens, Access, and troubleshooting.

### 🗺️ 3. (Optional) Faster Google Maps — `MAP_CACHE_KEY` + `SITE_URL` (build variables)

Only worth it if your notes have **many** map pins. These are **build-time**
variables (Workers Builds → **Build** → Variables and Secrets), *not* runtime
secrets. See DEPLOY.md for details (including the `/maps-cache.json` Access
Bypass). Skip this until you need it.

## Make it yours

- Edit or delete `welcome.md` and add your own `.md` notes anywhere in this repo.
- Saved views live in `views/*.yml`.
- Every push rebuilds and redeploys automatically, and so do editor commits.
- To use an **existing** vault instead of this starter, move the `.web/` folder
  into that vault's repository (or set `VAULT_DIR`) and connect that repository.

## What's in here

- `welcome.md`, `views/` — the minimal starter vault (plain Markdown). This
  repository is shaped exactly like a normal Markdown vault with a `.web/` folder
  inside it.
- `.web/` — the WebVault deployment shell: config plus the `web-vault` dependency.
  It owns no app code; the application and build pipeline live in the `web-vault`
  package. Don't hand-edit generated build artifacts (`.web/.wv/`, `.web/dist/`).

## Prefer setting up an existing vault by hand?

Two onboarding paths exist — pick the one that fits:

- **This template + one-click** (above) — start from near-zero, no coding agent.
- **Agent-driven setup into an existing vault** — if you already have a Markdown
  vault and a coding agent, see
  [WebVault's SETUP.md](https://github.com/marconucara/web-vault/blob/v0.4.0/SETUP.md).

## License

The `web-vault` package is AGPL-3.0. This starter content is yours to change.
