// Cloudflare Worker entry factory for web-vault (Workers Static Assets).
//
// The consumer's .wv/worker.js is GENERATED at build time (wv build) and just
// calls makeWorker() with build-injected config; the real logic lives here and
// in ./commit.js, and upgrades via `yarn up`. See scripts/generate-worker.mjs.
//
// This is the Workers analogue of the former Pages Function adapter: the commit
// logic (makeCommitHandler) is unchanged and host-agnostic; this file adds only
// the Cloudflare-Workers wiring — routing POST /api/commit and delegating every
// other path to the static-assets binding (env.ASSETS). Keeping env.ASSETS out
// of ./commit.js is what keeps the core portable to other hosts.
// See adr/0040-cloudflare-workers-deploy-substrate.md.
import { makeCommitHandler } from './commit.js';
import { getCapabilities } from './capabilities.js';
import { makeUpgradeHandler } from './upgrade.js';

// Returns a Workers module-format default export ({ fetch }). `config` is
// build-injected (see generate-worker.mjs); runtime env still wins over it.
export function makeWorker(config = {}) {
  const onCommit = makeCommitHandler(config);
  const onUpgrade = makeUpgradeHandler(config);
  return {
    async fetch(request, env) {
      const { pathname } = new URL(request.url);

      // What this deployment can do, read at request time so a token added
      // after the deploy is reflected without a rebuild (adr/0034-*.md).
      // Read-only and side-effect free, hence GET.
      if (pathname === '/api/capabilities') {
        if (request.method !== 'GET') {
          return new Response('Method Not Allowed', {
            status: 405,
            headers: { allow: 'GET' },
          });
        }
        return new Response(JSON.stringify(getCapabilities(env, config)), {
          headers: {
            'content-type': 'application/json; charset=utf-8',
            // The answer changes when an adopter adds the secret; a cached
            // `false` would outlive that and keep the UI wrong.
            'cache-control': 'no-store',
          },
        });
      }

      // The framework pin bump (adr/0039-*.md). A separate route from
      // /api/commit by design: its write scope is one file and one field, where
      // the note endpoint's path guard excludes `.web/` outright.
      if (pathname === '/api/upgrade') {
        if (request.method !== 'POST') {
          return new Response('Method Not Allowed', {
            status: 405,
            headers: { allow: 'POST' },
          });
        }
        return onUpgrade({ request, env });
      }

      if (pathname === '/api/commit') {
        // makeCommitHandler returns a Pages-style onRequestPost({ request, env })
        // that only handles POST. run_worker_first routes ALL /api/* verbs here,
        // so gate the method ourselves.
        if (request.method !== 'POST') {
          return new Response('Method Not Allowed', {
            status: 405,
            headers: { allow: 'POST' },
          });
        }
        return onCommit({ request, env });
      }

      // run_worker_first is scoped to /api/*, so normally the Worker is not
      // invoked for anything else; if it is, serve the static asset (which also
      // applies not_found_handling / dist/404.html on a miss).
      return env.ASSETS.fetch(request);
    },
  };
}
