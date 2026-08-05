// The favicon as a data: URI, read from brand/favicon.svg at build time.
//
// For the 404 only. Every other page links the icon as a file: the app shell
// takes dist/favicon.svg, the share pages take dist/shared/favicon.svg (inside
// the Cloudflare Access Bypass that makes /shared/* public — the site root is
// not, so a share page cannot link the root icon).
//
// The 404 can do neither. It is served for any unmatched path at any depth, so
// no relative href resolves in every case, and the site root is behind Access.
// Same reason it already keeps its CSS and JS inline.
//
// Reading the SVG rather than pasting the encoded string keeps a single source
// for the mark: refine brand/favicon.svg and every surface follows.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BRAND_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'brand');

export function faviconDataUri() {
  const svg = readFileSync(join(BRAND_DIR, 'favicon.svg'), 'utf8').replace(/\n\s*/g, '');
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The <link> tag for a page that must carry the icon without fetching a file. */
export function inlineFaviconLink() {
  return `<link rel="icon" href="${faviconDataUri()}" type="image/svg+xml" />`;
}
