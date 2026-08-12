// Vite config FACTORY for web-vault.
//
// The app source (index.html, src/) lives in this package, but the build reads
// the vault and writes output into the CONSUMER project (the `.web`). So Vite's
// `root` points at the package while `build.outDir` and `publicDir` point back
// at the consumer (resolved from cwd in paths.mjs). The `wv` bin passes the
// object returned here straight to the Vite JS API with `configFile: false`.
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import react from '@vitejs/plugin-react';
import { renderSharedPage } from '../scripts/shared-render.mjs';
import { commitDev } from '../scripts/commit-dev.mjs';
import { capabilitiesDev } from '../scripts/capabilities-dev.mjs';
import { upgradeDev } from '../scripts/upgrade-dev.mjs';
import { usedIconNamesFromFile, renderIconModule, iconChunkName } from '../scripts/type-icons.mjs';
import { contentWatchDev } from '../scripts/content-watch-dev.mjs';
import { PACKAGE_DIR, DIST_DIR, PUBLIC_DIR, CONTENT_JSON, ATTACHMENTS_DIR } from '../scripts/paths.mjs';

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

// Virtual module holding the lucide icons the vault's Type documents actually
// use, as a static { name: Component } map. Generated from the same content.json
// as the content module, so the icons ship in the app bundle instead of being
// fetched one chunk at a time on first paint (see scripts/type-icons.mjs).
function virtualIcons() {
  const virtualId = 'virtual:web-vault-icons';
  const resolvedId = '\0' + virtualId;
  return {
    name: 'web-vault-icons',
    resolveId(source) {
      if (source === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      this.addWatchFile(CONTENT_JSON); // dev: a new type icon re-generates this
      return renderIconModule(usedIconNamesFromFile(CONTENT_JSON));
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

// Dev only: serve the vault's /attachments/* on demand. In a build these files
// are copied into dist/attachments (copy-attachments.mjs) and served statically;
// the dev server has no such copy, and Vite's root is the PACKAGE, so a request
// for /attachments/x falls through to the SPA (the note's images 404 / return
// HTML). This middleware streams the file straight from the vault's attachments
// folder, matching the production URL (/attachments/<path>). Unknown/unsafe
// paths -> next() (SPA/404), never a traversal outside the folder.
const ATTACH_MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.bmp': 'image/bmp', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.json': 'application/json',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v', '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.aac': 'audio/aac', '.flac': 'audio/flac',
};
function attachmentsDev() {
  return {
    name: 'attachments-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (!path.startsWith('/attachments/')) return next();
        let rel;
        try {
          rel = decodeURIComponent(path.slice('/attachments/'.length));
        } catch {
          return next();
        }
        // Resolve inside the attachments folder and reject anything that escapes
        // it (path traversal) or that isn't a regular file.
        const full = normalize(join(ATTACHMENTS_DIR, rel));
        if (full !== ATTACHMENTS_DIR && !full.startsWith(ATTACHMENTS_DIR + '/')) return next();
        let st;
        try {
          st = statSync(full);
        } catch {
          return next();
        }
        if (!st.isFile()) return next();
        res.statusCode = 200;
        res.setHeader('Content-Type', ATTACH_MIME[extname(full).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Content-Length', st.size);
        createReadStream(full).pipe(res);
      });
    },
  };
}

// Dev only: serve the package's brand/ icon set (favicon, touch icon, PWA
// icons, manifest) at the URLs index.html references. In a build these are
// copied into dist by copy-brand.mjs; in dev there is no such copy, and Vite's
// publicDir is the CONSUMER's public/, so a request for /favicon.svg would fall
// through to the SPA and the tab would show the app shell's HTML as an icon.
// The consumer's own public/<name> still wins: Vite's static middleware runs
// first, so this only answers what the consumer did not override.
const BRAND_MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};
function brandDev() {
  const BRAND_DIR = join(PACKAGE_DIR, 'brand');
  return {
    name: 'brand-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        // Root-level files, plus the one icon the share pages link at
        // /shared/favicon.svg (see copy-brand.mjs). A single flat segment, so
        // nothing can traverse out of brand/.
        const m = path.match(/^\/(?:shared\/)?([A-Za-z0-9._-]+)$/);
        if (!m || m[1] === 'ASSETS.md') return next();
        if (path.startsWith('/shared/') && m[1] !== 'favicon.svg') return next();
        const full = join(BRAND_DIR, m[1]);
        const mime = BRAND_MIME[extname(full).toLowerCase()];
        if (!mime || !existsSync(full)) return next();
        res.statusCode = 200;
        res.setHeader('Content-Type', mime);
        createReadStream(full).pipe(res);
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
    plugins: [
      react(),
      virtualContent(),
      virtualIcons(),
      sharedPagesDev(),
      attachmentsDev(),
      brandDev(),
      commitDev(),
      capabilitiesDev(),
      upgradeDev(),
      contentWatchDev(),
    ],
    build: {
      outDir: DIST_DIR, // consumer .web/dist
      emptyOutDir: true,
      rollupOptions: {
        output: {
          // Group lucide's per-icon modules into a few chunks instead of the
          // ~1,750 single-icon files its dynamic entry point otherwise emits
          // (see iconChunkName in scripts/type-icons.mjs for why, and why the
          // buckets are hashed rather than alphabetical).
          manualChunks: (id) => iconChunkName(id),
        },
      },
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
      // Some transitive deps are plain CJS whose exports Vite's dev scanner
      // can't detect statically, so it serves the raw file with no matching
      // export ("does not provide an export named ...") and blanks the app.
      // Listing them forces esbuild to pre-bundle with correct interop.
      // Production (Rollup) is unaffected; this is dev-only optimization.
      //   - style-to-js: `module.exports = fn` (via the react-markdown chain).
      //   - The BlockNote editor and its @mantine UI pull mixed CJS/ESM deps
      //     (e.g. zustand -> use-sync-external-store, a conditional-`require`
      //     CJS whose named export Vite can't detect when the importer is
      //     served raw). Pre-bundling the editor libraries makes esbuild inline
      //     the whole subtree, resolving those named imports internally.
      //   - leaflet: a UMD bundle with no `default` export for Vite to find.
      //     It is only reached through the lazily-imported map view, so the
      //     dev scanner never sees it at startup and would otherwise serve it
      //     raw the first time someone opens that view.
      //   - use-sync-external-store/shim: reached from react-i18next's
      //     useTranslation. Conditional-`require` CJS with no `main` (exports
      //     only), so nothing about it is statically detectable.
      //
      // This list cannot be replaced by letting the scanner discover deps
      // (optimizeDeps.entries). Measured under a `portal:` link, which is how
      // this package is developed: `preserveSymlinks: true` makes esbuild walk
      // modules by their real paths inside the linked package, so it stops
      // classifying them as optimizable dependencies at all. Dropping the list
      // in favour of `entries` breaks the app on `react-dom/client` before it
      // ever reaches the exotic cases. The list is load-bearing, not legacy —
      // when a new dependency blanks `wv dev` with "does not provide an export
      // named ...", the fix is to add it here.
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react-markdown',
        'remark-gfm',
        'style-to-js',
        '@blocknote/core',
        '@blocknote/react',
        '@blocknote/mantine',
        'leaflet',
        'use-sync-external-store/shim',
      ],
    },
  };
}
