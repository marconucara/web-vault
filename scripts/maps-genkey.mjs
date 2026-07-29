// Generates a fresh AES-256 key for the Maps resolver cache and prints it with
// setup instructions. It only prints — it never writes a file, so the key can't
// accidentally end up committed. Run: `yarn maps:genkey`.
import { randomBytes } from 'node:crypto';

const key = randomBytes(32).toString('base64');

console.log(`
Maps cache key (keep secret):

  ${key}

Set it as MAP_CACHE_KEY in your deploy/CI environment, or locally put it in
an (uncommitted) .web/.env file — see .web/.env.example — so plain
\`yarn build\` / \`yarn dev\` pick it up with no inline vars.

What it enables:
  • MAP_CACHE_KEY set  -> each build writes an ENCRYPTED map cache to
    dist/maps-cache.json. Public but opaque: useless without this key.
    (No key = no cache is written, ever. Never in plaintext.)

  • Also set SITE_URL   -> builds READ that deployed cache first
    (<SITE_URL>/maps-cache.json) and only fetch the map links that are
    still missing. This is what makes builds fast and immune to Google
    rate-limiting the links already resolved once.
    On Cloudflare Pages / Vercel / Netlify SITE_URL is optional: the
    host's own URL var is used automatically.

Test locally first (no server needed). Put in .web/.env:
  MAP_CACHE_KEY=<key>
  MAP_CACHE_URL=dist/maps-cache.json   # read from the local file, not a URL
Both \`yarn dev\` and \`yarn build\` WRITE dist/maps-cache.json and READ it on
the next run. So run once to create it, then again to see it load
(log: "N entr(ies) loaded ... 0 resolved now").

MAP_CACHE_URL overrides where to read from and also accepts a file path
or file:// URL (Node's fetch can't read files, so we read them directly).

Keep the same key across builds, or old caches can't be read.
`);
