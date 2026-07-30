# WebVault

A distributable, static web viewer and editor for Markdown knowledge vaults.
Browse your notes and saved views in a browser, edit them with a WYSIWYG block
editor, and publish isolated public share links. WebVault works with generic
Markdown vaults and is compatible with
[Tolaria](https://github.com/refactoringhq/tolaria) and Obsidian vaults.

## Get started

### Configure in your existing vault

Hand this one-line prompt to any coding agent working inside your vault:

> Add WebVault to this vault by reading and following
> https://github.com/marconucara/web-vault/blob/v0.3.0/SETUP.md

The agent scaffolds the `.web/` config shell and adds WebVault as a dependency.
[`SETUP.md`](SETUP.md) is the supported install path. The natural next step is to
[test it locally](#local-test-optional) or [deploy](#deploy) to see the result.

## How it works

WebVault ships as a framework: one package owns all the app code and the build
pipeline, and your vault keeps only a thin config shell (a `.web/` folder) — no
app code, no bundler config to maintain.

- **Read at build time.** WebVault scans your vault's `.md` notes (plus
  optional `views/*.yml` and `attachments/`) and bakes them into a static site.
  There is no read-time backend.
- **Edit in the browser.** The WYSIWYG editor commits changes back to your vault
  repo through a Cloudflare Pages Function, in one atomic commit via the GitHub
  Git Data API. The GitHub token lives only as a server-side Secret.
- **Share selectively.** Individual notes can be published as isolated
  `/shared/<id>/` pages; the rest of the vault stays private behind Cloudflare
  Access.

## Local test (optional)

Preview the site on your machine before deploying. Requires **Node 22** and
**Yarn 4** (enable it with `corepack enable`).

From `.web/`:

```sh
yarn install
yarn dev
```

Open the printed URL — your notes load in the browser. `yarn build` produces the
static site in `.web/dist/`.

## Deploy

Deploying is optional, but it's where WebVault delivers its real value.

Currently the supported target is **Cloudflare Pages**: a static site behind
**Cloudflare Access**, with only `/shared/*` public and the private vault never
exposed. Full steps in [`DEPLOY.md`](DEPLOY.md).

## Design decisions

The [`adr/`](adr/) catalogue is the source of truth for what this system does
and why; [`INDEX.md`](INDEX.md) is the generated table of contents. Contributor
rules are in [`AGENTS.md`](AGENTS.md) and [`CONVENTIONS.md`](CONVENTIONS.md).

## License

AGPL-3.0.
