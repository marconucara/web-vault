# Deploy

Deploying is optional, but it's where WebVault delivers its real value.

## Cloudflare Pages

The site is a static build behind **Cloudflare Access** (private); only
`/shared/*` is public. The in-browser editor commits back to your vault repo
through a Pages Function. Do these steps in the Cloudflare dashboard.

1. **Create a Pages project** connected to the vault's GitHub repo. Settings:
   - Root directory: `.web`
   - Build command: `yarn build`
   - Output directory: `dist`
   - Project name: must match `name` in `.web/wrangler.toml`.

2. **Add the editor secret** — a `GITHUB_TOKEN` (fine-grained PAT with
   **Contents:write** on the vault repo only). Without it the site is read-only.

3. **Gate the site with Cloudflare Access** — an `Allow` policy over the whole
   domain, plus a path-scoped `Bypass` on `/shared/*` so share links stay public.

Deploy by pushing to the deployment branch; Cloudflare builds and publishes.
Verify the app loads behind Access and a `/shared/<id>/` page is reachable
publicly.

> The deploy config files (`.web/wrangler.toml`, and the response-header rules)
> are handled for you: `wrangler.toml` is written during setup, and `_headers`
> is generated into the build output. See `adr/0026-cloudflare-pages-access.md`.
