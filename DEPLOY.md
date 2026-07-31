# Deploy

Deploying is optional, but it's where WebVault delivers its real value.

## Cloudflare Workers

The site is a static build served by a single **Cloudflare Worker** (Workers
Static Assets) behind **Cloudflare Access** (private); only `/shared/*` is public.
The in-browser editor commits back to your vault repo through the same Worker at
`/api/commit`. Deploy is **git-connected** (Workers Builds) — no local
`wrangler deploy`.

The deploy config (`.web/wrangler.toml`) is versioned in the repo. `yarn build`
(`wv build`) produces `dist/` and generates the Worker entry `.wv/worker.js`
(gitignored); the response-header rules (`dist/_headers`) are generated too. See
`adr/0040-cloudflare-workers-deploy-substrate.md`.

### 1. Create the Worker (git-connected)

Cloudflare dashboard → **Workers & Pages → Create → Workers → Import a
repository**. Select the vault's GitHub repo and set:

- **Root directory:** `.web`
- **Build command:** `yarn build`
- **Deploy command:** `npx wrangler deploy` *(default — production branch)*
- **Non-production branch deploy command:** `npx wrangler versions upload`
- **Worker name:** must match `name` in `.web/wrangler.toml`.
- **Build watch paths → Include:** `../*`
- **Build API token:** leave **Create new token** (Cloudflare provisions it).

The build watch path is easy to get wrong and fails silently. Watch paths are
evaluated **relative to the Root directory** (`.web`), not the repository root —
so the default `*` only matches changes *inside* `.web`, and an editor commit
(which changes vault notes at the repo root, e.g. `ricette/foo.md`) would **never
trigger a rebuild**. The edit lands in git and the optimistic UI shows it, but the
deployed static site stays stale. Set the include to `../*` so changes to the
vault (the parent of `.web`) trigger a build. This is the one setting Pages did not
need (its watch paths defaulted to the whole repo).

The two deploy commands matter: on Workers Builds **every branch runs the deploy
command**, so a non-production branch left on `npx wrangler deploy` would overwrite
production. `npx wrangler versions upload` publishes a **preview URL** instead,
without touching production. Keep the `npx` prefix so the command works with or
without a local wrangler. Enable **Preview URLs** / non-production branch builds in
the project settings (needs Wrangler ≥ 4.21.0).

Per-branch preview URLs take the form `<branch>-<worker>.<account>.workers.dev`;
production is `<worker>.<account>.workers.dev`.

### 2. Add the editor secret

In the Worker's **Settings → Variables and Secrets**, add a secret
`GITHUB_TOKEN` — a fine-grained PAT with **Contents: write** on the vault repo
only. Without it the site is read-only. Optionally set `GITHUB_REPO` /
`GITHUB_BRANCH` as plain vars to override the values baked at build time.

### 3. Gate the site with Cloudflare Access

Access protects the free `*.workers.dev` domain — no custom domain required. In
Zero Trust → **Access → Applications**, create **self-hosted** applications on the
Worker's hostnames. The subdomain field syntax is what makes it work:

| Purpose | Subdomain | Domain | Path | Policy |
|---------|-----------|--------|------|--------|
| Protect production | `<worker>` (exact) | `<account>.workers.dev` | *(empty)* | Allow (your identity) |
| Protect previews | `*-<worker>` (wildcard) | `<account>.workers.dev` | *(empty)* | Allow (your identity) |
| Public shares (prod) | `<worker>` (exact) | `<account>.workers.dev` | `shared` | Bypass (Everyone) |
| Public shares (preview) | `*-<worker>` (wildcard) | `<account>.workers.dev` | `shared` | Bypass (Everyone) |

The wildcard **must** keep the leading `*-`: on `*.workers.dev` an exact-hostname
application is not enforced (there is no per-worker DNS record to bind to), but a
wildcard application is matched at the edge on the Host header. `*-<worker>` also
covers preview hosts (`<branch>-<worker>...`) with a single policy. The `/shared`
Bypass keeps share links public while the rest of the site is Restricted; the
commit endpoint at `/api/commit` inherits the gate. When a policy exists, the
Worker's **Domains & Routes** panel shows the URL as **Restricted**.

For a **fully public** site, skip step 3 and, advisably, skip the `GITHUB_TOKEN`
in step 2 so there is no editing surface.

### 4. Deploy

Push to the deployment branch; Cloudflare builds and publishes. Verify the app
loads behind Access and a `/shared/<id>/` page is reachable publicly (and, on a
non-production branch, that its preview URL is separate from production).

### Troubleshooting

Three separate credentials are in play — don't confuse them: the **GitHub App**
connection (reads the repo + delivers push webhooks), the **build API token**
(lets the build authenticate `wrangler` to deploy the Worker), and the runtime
**`GITHUB_TOKEN`** secret (lets the running Worker commit edits back to GitHub).

- **Edits commit but the site never rebuilds:** the build watch path is relative
  to the Root directory (`.web`); set Include to `../*` (see step 1).
- **Build fails: "build token … has been deleted or rolled":** the build API
  token is stale. Worker → Settings → Build → **Create new token**, select it, and
  retry. It is currently a *user* token, so rotating/deleting it (or the user
  leaving the org) breaks builds until a new one is created.
- **Nothing builds on push at all:** check the repo is git-connected and
  "Enable automatic production branch deployments" (Branch control) is on, with
  the production branch set to `main`.
- **Map cache re-fetches every build (optional feature):** the map cache is
  build-time, so `MAP_CACHE_KEY` must be a **build** variable (Workers Builds →
  Build → Variables and Secrets), *not* a runtime Worker secret — if it is a
  runtime secret the build never sees it (`[maps-cache] MAP_CACHE_KEY unset`).
  Reading the previous cache also needs `SITE_URL` set to the deployed URL
  (e.g. `https://<worker>.<account>.workers.dev`): unlike Pages (`CF_PAGES_URL`),
  Workers Builds exposes no automatic deployment-URL variable. Keep an Access
  **Bypass on `/maps-cache.json`** so the unauthenticated build can read it. A
  working read logs `[maps] cache: N entr(ies) loaded from …`.
