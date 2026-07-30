// Vite config FACTORY for web-vault.
//
// The app source (index.html, src/) lives in this package, but the build reads
// the vault and writes output into the CONSUMER project (the `.web`). So Vite's
// `root` points at the package while `build.outDir` and `publicDir` point back
// at the consumer (resolved from cwd in paths.mjs). The `wv` bin passes the
// object returned here straight to the Vite JS API with `configFile: false`.
import { readFileSync, existsSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { renderSharedPage } from '../scripts/shared-render.mjs';
import { PACKAGE_DIR, DIST_DIR, PUBLIC_DIR, CONTENT_JSON } from '../scripts/paths.mjs';

// Virtual module that exposes the build-time generated content.json to the app.
// The app imports `virtual:web-vault-content` instead of a physical path inside
// node_modules, so nothing is written into the package. content.json is produced
// by build-content.mjs into the consumer's .wv/ before Vite runs.
function virtualContent() {
  const virtualId = 'virtual:web-vault-content';
  const resolvedId = '\0' + virtualId;
  return {
    name: 'web-vault-content',
    resolveId(source) {
      if (source === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      this.addWatchFile(CONTENT_JSON); // dev: re-run when content.json changes
      const json = existsSync(CONTENT_JSON) ? readFileSync(CONTENT_JSON, 'utf8') : '{}';
      return `export default ${json}`;
    },
  };
}

// Dev only: serve the public /shared/<uuid>/ pages on demand (the vite dev
// server otherwise falls through to the SPA). Generated with the same code as
// the build (shared-render.mjs), so dev matches production. Unknown ids -> 404.
function sharedPagesDev() {
  return {
    name: 'shared-pages-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        const m = path.match(/^\/shared\/([A-Za-z0-9_-]+)\/?$/);
        if (!m) return next();
        let content;
        try {
          content = JSON.parse(readFileSync(CONTENT_JSON, 'utf8'));
        } catch {
          return next();
        }
        const html = renderSharedPage(content, m[1]);
        if (html == null) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Not found');
          return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    },
  };
}

export function createViteConfig() {
  return {
    root: PACKAGE_DIR,
    // base './' so assets resolve under any Cloudflare Pages path.
    base: './',
    publicDir: PUBLIC_DIR, // consumer .web/public (e.g. _headers) -> dist
    plugins: [react(), virtualContent(), sharedPagesDev()],
    build: {
      outDir: DIST_DIR, // consumer .web/dist
      emptyOutDir: true,
    },
    // BlockNote/Mantine import React: without dedupe two instances of the React
    // module get created (app vs pre-bundle) and their Contexts break
    // ("render2 is not a function"). Force a single copy of React (and react-dom).
    resolve: {
      dedupe: ['react', 'react-dom'],
      // Keep module paths unresolved through symlinks so that, when the package
      // is linked locally via `portal:`, dependencies resolve from the consumer's
      // node_modules. No effect on real installs (the package is a real dir).
      preserveSymlinks: true,
    },
    optimizeDeps: {
      // react-markdown's chain pulls `style-to-js`, a plain-CJS transitive dep
      // (module.exports = fn). Without listing it, Vite dev follows the ESM
      // import to the raw CJS file and its interop shim exposes no `default`
      // export ("does not provide an export named 'default'"), blanking the app.
      // Forcing the chain to be pre-bundled resolves the interop. Production
      // (Rollup) is unaffected; this is dev-only optimization.
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react-markdown',
        'remark-gfm',
        'style-to-js',
      ],
    },
  };
}
