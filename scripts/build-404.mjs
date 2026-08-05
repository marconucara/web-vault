// Generates dist/404.html, the catch-all Cloudflare Pages serves for any path
// that does not match a static asset (run after `vite build`).
//
// Why this file must exist: without a 404.html, Pages falls back to serving
// dist/index.html (the app shell) with status 200. Under /shared/* that shell
// renders as a blank page, because the app's /assets/* bundles are behind
// Cloudflare Access while /shared/* is on a Bypass policy: the HTML loads, its
// scripts do not. A dead share link therefore looks broken instead of missing.
//
// Replacing that fallback is safe here because the app uses hash routing, so no
// app route depends on a path-based fallback to index.html.
//
// The page is fully self-contained (inline CSS + JS, no /assets/* references):
// anything it loaded would be Access-protected and fail on a public share URL.
//
// It is always a plain "page not found", styled like the app's empty state
// (.empty-note in styles.css). Under /shared/* it adds one extra paragraph and
// an auto-refresh, because there the page may simply not be published yet: it
// polls the same URL and reloads once the real page is live, detected via the
// <meta name="x-web-vault-shared"> marker written by build-shared.mjs (a plain
// 200 is not enough: Pages answers 200 for unknown paths too).
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DIST_DIR as DIST } from './paths.mjs';
import { inlineFaviconLink } from './brand-inline.mjs';

// Same variables and empty-state look as the app (styles.css .empty-note).
const CSS = `
:root { --bg:#fff; --bg-alt:#f6f7f9; --bg-active:#e9eef5; --border:#e2e5ea; --text:#1b1d21; --text-dim:#6b7280; --accent:#2f6fed; --radius:8px; }
@media (prefers-color-scheme: dark) { :root { --bg:#16181d; --bg-alt:#1d2027; --bg-active:#262b34; --border:#2c313a; --text:#e6e8ec; --text-dim:#9aa1ac; --accent:#6a9bff; } }
* { box-sizing:border-box; }
html,body { height:100%; margin:0; }
body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--text); background:var(--bg); font-size:15px; line-height:1.5; display:flex; align-items:center; justify-content:center; padding:40px 24px; }
.empty-note { display:flex; flex-direction:column; align-items:center; gap:14px; max-width:480px; padding:40px 52px; border:1px solid var(--border); border-radius:14px; background:var(--bg-alt); color:var(--text-dim); text-align:center; }
.empty-note .icon { opacity:.5; }
.empty-note h1 { margin:0; font-size:16px; font-weight:600; color:var(--text); }
.empty-note p { margin:0; font-size:15px; }
.hint { display:none; font-size:14px; }
.hint.on { display:block; }
.status { display:none; align-items:center; gap:8px; font-size:13px; }
.status.on { display:flex; }
.dot { flex:none; width:7px; height:7px; border-radius:50%; background:var(--accent); animation:pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity:.25; } 50% { opacity:1; } }
button { font:inherit; font-size:14px; color:var(--text); background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); padding:6px 14px; cursor:pointer; }
button:hover { background:var(--bg-active); }
@media (prefers-reduced-motion:reduce) { .dot { animation:none; } }
`.trim();

// file-text icon, same paths as src/components/Icon.jsx.
const ICON = `<svg class="icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;

// No backticks or ${} below: this string is embedded in a JS template literal.
const JS = `
(function () {
  var MARKER = 'x-web-vault-shared';
  var SHARE_PATH = /^\\/shared\\/[^/]+/;
  // Backoff, then give up and hand over to the button (~5 minutes total).
  var DELAYS = [4000, 4000, 8000, 8000, 15000, 15000, 30000, 30000, 30000, 60000, 60000, 60000];

  // Plain not-found everywhere except under /shared/, where the page may not be
  // published yet: only there we explain it and keep checking.
  if (!SHARE_PATH.test(location.pathname)) return;

  var hint = document.getElementById('hint');
  var status = document.getElementById('status');
  hint.textContent = 'If this note was just shared, its page may still be publishing. That usually takes a couple of minutes, and this page refreshes by itself as soon as it is ready.';
  hint.className = 'hint on';

  function setStatus(html) {
    status.innerHTML = html;
    status.className = 'status on';
  }

  // The real page is live only when it carries the share marker: Pages answers
  // 200 for unknown paths too, so the status code alone would be misleading.
  function isLive() {
    return fetch(location.pathname + '?_=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.text() : ''; })
      .then(function (html) { return html.indexOf(MARKER) !== -1; })
      .catch(function () { return false; });
  }

  function giveUp() {
    setStatus('<button type="button" id="retry">Check again</button>');
    document.getElementById('retry').addEventListener('click', function () { run(0); });
  }

  function run(attempt) {
    if (attempt >= DELAYS.length) return giveUp();
    var secs = Math.round(DELAYS[attempt] / 1000);
    setStatus('<span class="dot"></span><span>Checking again in ' + secs + 's</span>');
    setTimeout(function () {
      setStatus('<span class="dot"></span><span>Checking</span>');
      isLive().then(function (live) {
        if (live) location.reload();
        else run(attempt + 1);
      });
    }, DELAYS[attempt]);
  }

  run(0);
})();
`.trim();

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<title>Page not found</title>
${inlineFaviconLink()}
<style>${CSS}</style>
</head>
<body>
<main class="empty-note">
${ICON}
<h1>Page not found</h1>
<p>This page doesn't exist.</p>
<p class="hint" id="hint"></p>
<div class="status" id="status"></div>
</main>
<script>${JS}</script>
</body>
</html>`;

if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });
writeFileSync(join(DIST, '404.html'), HTML);
console.log('[404] dist/404.html written.');
