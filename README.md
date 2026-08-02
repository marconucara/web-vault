# WebVault

A distributable, static web viewer and editor for Markdown knowledge vaults.
Browse your notes and saved views in a browser, edit them with a WYSIWYG block
editor, and publish isolated public share links. WebVault works with generic
Markdown vaults and is compatible with
[Tolaria](https://github.com/refactoringhq/tolaria) and Obsidian vaults.

## Why

WebVault started from a vault I already kept in
[Tolaria](https://github.com/refactoringhq/tolaria). Its opinionated
organization solved most of how I capture and structure notes — but two things I
relied on were out of reach: reading my vault comfortably on mobile, and sharing
a handful of notes with other people. WebVault fills exactly those gaps — a
browser-based reader and editor that works on a phone, and isolated public share
links — while leaving the plain-Markdown vault and the way it's organized
untouched.

WebVault is one way to work with your vault, not the only one — and not
necessarily the main one. Because the vault is just a git repository of Markdown
files, you can keep editing it however you like: I do most of my editing through
coding agents (Claude Code, Jules, Codex…), which also makes it comfortable to
work from a phone. WebVault adds a visual reader, a WYSIWYG editor, and public
sharing on top of that — use as much or as little of it as you want.

## Get started

Two onboarding paths — pick the one that fits.

### Start from a template (near one-click)

No vault yet, and want the fastest path? Deploy the starter template to
**Cloudflare Workers** in a few clicks — you get a running instance with a small
sample vault, then point it at your own notes. See the
[starter template](https://github.com/marconucara/web-vault-template) for the
**Deploy to Cloudflare** button and its setup steps.

### Add WebVault to your existing vault

Already have a Markdown vault? (No vault yet? I recommend
[Tolaria](https://github.com/refactoringhq/tolaria), but any repository of mixed
Markdown files works reasonably well.) Hand this one-line prompt to any coding
agent working inside your vault:

> Add WebVault to this vault by reading and following
> https://github.com/marconucara/web-vault/blob/v0.5.1/SETUP.md

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
  repo through a Cloudflare Worker, in one atomic commit via the GitHub Git Data
  API. The GitHub token lives only as a server-side Secret.
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

Currently the supported target is **Cloudflare Workers**: a static site (served
by a single Worker) behind **Cloudflare Access**, with only `/shared/*` public
and the private vault never exposed. Full steps in [`DEPLOY.md`](DEPLOY.md).

## Design decisions

The [`adr/`](adr/) catalogue is the source of truth for what this system does
and why; [`INDEX.md`](INDEX.md) is the generated table of contents. Contributor
rules are in [`AGENTS.md`](AGENTS.md) and [`CONVENTIONS.md`](CONVENTIONS.md).

## License

AGPL-3.0.
