# Cloudflare starter template — near-one-click onboarding

Owning ADR: `adr/0035-cloudflare-template-onboarding.md` (depends on
`adr/0040-cloudflare-workers-deploy-substrate.md`, `adr/0029`, `adr/0005`).

## Scope

A public starter template a newcomer can deploy to Cloudflare Workers with the
"Deploy to Cloudflare" one-click button, getting a running instance with a sample
vault, then repoint it at their own notes. README documents both onboarding
paths.

## What shipped

- Template lives in this repo at `templates/base/` (same-repo, not a separate
  starter repo). It is a self-contained vault-with-`.web` folder: `welcome.md`,
  `views/`, and the `.web/` Workers shell (pinned `web-vault#v0.4.0`, `yarn.lock`
  committed for the immutable CI install).
- `templates/base/README.md`: the **Deploy to Cloudflare** button pointing at the
  `templates/base` subfolder (the button clones that folder as the new repo root),
  a "read before clicking" table (Project name, private repo, **Path = `/.web/`**,
  skip in-flow variables), and post-deploy steps (runtime `GITHUB_TOKEN`, Access,
  optional build-var map cache) linking `DEPLOY.md`.
- `welcome.md`: setup checklist + a live feature demo (wikilink + three Google
  Maps pins that resolve at build time).
- web-vault `README.md`: documents both onboarding paths (template + agent-driven
  `SETUP.md`) and the Workers substrate.

## Exit criteria (met)

- `yarn build` in `templates/base/.web` produces `dist/` + `.wv/worker.js` and
  resolves the demo map pins.
- The one-click button clones the `templates/base` subfolder as the deployed
  repo root (confirmed by a live button test); `Path = /.web/` builds from the
  shell.
- ADR 0035 → Implemented, INDEX regenerated.

## Follow-up

- Retire the standalone `web-vault-template` repo (superseded by
  `templates/base/`); leave a pointer in its README and archive it.

Shipped: web-vault templates/base (v0.4.0 pin). HEAD recorded in the shipping commit.
