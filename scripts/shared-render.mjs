// Pure rendering of the public "share" pages (no file I/O). Shared by
// scripts/build-shared.mjs (writes the static files at build time) and by the
// Vite dev middleware (serves them on demand under `yarn dev`), so the two never
// drift. A shared page is a self-contained static HTML string.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GithubSlugger from 'github-slugger';
import { parseMapCardLine, createMapGrouper, createColorAssigner, markerColor } from '../src/lib/mdLinks.js';

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
export const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Body: wikilink -> link only if the target is shared, otherwise plain text.
function transformSharedWikilinks(md, titleIndex, idTitle, sharedUuidByNoteId) {
  return md.replace(WIKILINK, (_m, target, alias) => {
    const id = titleIndex[target.trim().toLowerCase()];
    const text = (alias || (id && idTitle[id]) || target).trim();
    const uuid = id ? sharedUuidByNoteId[id] : null;
    return uuid ? `[${text}](/shared/${uuid}/)` : text;
  });
}

// Frontmatter relationships: only shared targets, as chip-links.
function sharedRelTargets(value, titleIndex, idTitle, sharedUuidByNoteId) {
  const arr = Array.isArray(value) ? value : [value];
  const out = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    let m;
    WIKILINK.lastIndex = 0;
    while ((m = WIKILINK.exec(v))) {
      const target = m[1].trim();
      const id = titleIndex[target.toLowerCase()];
      const uuid = id ? sharedUuidByNoteId[id] : null;
      if (uuid) out.push({ text: (m[2] || (id && idTitle[id]) || target).trim(), uuid });
    }
  }
  return out;
}

// A Google Maps place card as static HTML (no editor, no JS). Only public place
// data (resolved at build time) for THIS note's own link is emitted. On a public
// page a click opens Google Maps directly.
function renderMapCard(parsed, info, color) {
  const i = info || {};
  const title = i.title || parsed.label || 'Google Maps';
  const meta = [i.category, i.address].filter(Boolean).join(' · ');
  const note = parsed.desc || (i.title ? parsed.label : null);
  const rating = i.ratingStars ? '★'.repeat(i.ratingStars) : null;
  const num = parsed.marker === 'ordered' ? parsed.num : null;
  const pinInner = num != null ? escapeHtml(String(num)) : '<span class="mapcard-pin-dot"></span>';
  const style = color ? ` style="background:${escapeHtml(color)}"` : '';
  const body =
    `<span class="mapcard-title">${escapeHtml(title)}</span>` +
    (meta ? `<span class="mapcard-sub">${escapeHtml(meta)}</span>` : '') +
    (note ? `<span class="mapcard-sub mapcard-note">${escapeHtml(note)}</span>` : '') +
    (rating ? `<span class="mapcard-rating">${rating}</span>` : '');
  const thumb = i.image
    ? `<span class="mapcard-thumb"><img src="${escapeHtml(i.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`
    : '';
  return (
    `<a class="mapcard" href="${escapeHtml(parsed.url)}" target="_blank" rel="noopener noreferrer">` +
    `<span class="mapcard-pin"${style}><span class="mapcard-pin-in">${pinInner}</span></span>` +
    `<span class="mapcard-body">${body}</span>${thumb}</a>`
  );
}

// Puts an `id` on every heading, using a slugger supplied by the caller so the
// numbering of duplicate headings spans the whole note rather than restarting
// per rendered segment. This is `rehype-slug`'s job, but that plugin owns its
// slugger and there is no way to hand it one, so the eight lines are written
// here against the same rule the app uses (src/lib/headingSlug.js).
function headingIds(slugger) {
  const HEADING = /^h[1-6]$/;
  const text = (node) =>
    node.type === 'text'
      ? node.value
      : (node.children || []).map(text).join('');
  return () => (tree) => {
    const walk = (node) => {
      for (const child of node.children || []) {
        if (child.type === 'element' && HEADING.test(child.tagName)) {
          child.properties = child.properties || {};
          if (!child.properties.id) child.properties.id = slugger.slug(text(child));
        }
        walk(child);
      }
    };
    walk(tree);
  };
}

// Render a note body to HTML: map card lines (a Google Maps link starting its own
// line) become static cards; everything else is rendered by react-markdown. The
// grouping/colors match the app (shared mdLinks helpers). `maps` is looked up
// only for links present in this note.
export function renderBody(md, maps) {
  const grouper = createMapGrouper();
  const colorOf = createColorAssigner();
  const out = [];
  let buffer = [];
  let inFence = false;
  // Heading anchors (adr/0044-what-the-url-addresses.md). One slugger for the
  // whole note, NOT one per render call: the body is rendered in segments split
  // by map cards, and `rehype-slug`'s own slugger is per-render, so two
  // same-named headings on opposite sides of a map card would each come out
  // `#setup` instead of `#setup` / `#setup-1`.
  const slugger = new GithubSlugger();
  const flushMarkdown = () => {
    if (!buffer.length) return;
    const seg = buffer.join('\n');
    if (seg.trim()) {
      out.push(renderToStaticMarkup(React.createElement(ReactMarkdown, {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [headingIds(slugger)],
      }, seg)));
    }
    buffer = [];
  };
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      grouper(line);
      buffer.push(line);
      continue;
    }
    if (inFence) {
      buffer.push(line);
      continue;
    }
    const rawGroup = grouper(line) || 0;
    const parsed = parseMapCardLine(line);
    if (parsed) {
      flushMarkdown();
      out.push(renderMapCard(parsed, maps[parsed.url], markerColor(colorOf(rawGroup))));
    } else {
      buffer.push(line);
    }
  }
  flushMarkdown();
  return out.join('\n');
}

const CSS = `
:root { --bg:#fff; --bg-alt:#f6f7f9; --bg-active:#e9eef5; --border:#e2e5ea; --text:#1b1d21; --text-dim:#6b7280; --accent:#2f6fed; --radius:8px; }
@media (prefers-color-scheme: dark) { :root { --bg:#16181d; --bg-alt:#1d2027; --bg-active:#262b34; --border:#2c313a; --text:#e6e8ec; --text-dim:#9aa1ac; --accent:#6a9bff; } }
* { box-sizing:border-box; }
html,body { margin:0; }
body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--text); background:var(--bg); font-size:15px; line-height:1.5; }
a { color:var(--accent); text-decoration:none; }
a:hover { text-decoration:underline; }
.note-inner { max-width:760px; margin:0 auto; padding:44px 24px 96px; }
.meta { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:24px; }
.badge { font-size:12px; background:var(--bg-active); border:1px solid var(--border); border-radius:100px; padding:2px 10px; }
.badge.status { color:var(--accent); }
.rel { display:inline-flex; flex-wrap:wrap; gap:6px; align-items:center; font-size:13px; }
.rel-key { color:var(--text-dim); }
.chip { background:var(--bg-alt); border:1px solid var(--border); border-radius:100px; padding:2px 10px; font-size:13px; }
.markdown { font-size:16px; line-height:1.7; }
.markdown > *:first-child { margin-top:0; }
/* Matches the app: room above a heading jumped to by its anchor. */
.markdown :is(h1,h2,h3,h4,h5,h6) { scroll-margin-top:24px; }
.markdown h1 { font-size:32px; line-height:1.25; margin:0 0 20px; }
.markdown h2 { font-size:23px; line-height:1.25; margin:36px 0 12px; }
.markdown h3 { font-size:19px; line-height:1.25; margin:26px 0 10px; }
.markdown p { margin:0 0 16px; }
.markdown ul,.markdown ol { margin:0 0 18px; padding-left:24px; }
.markdown li { margin:6px 0; }
.markdown li > p { margin:0; }
/* GFM task lists: the checkbox replaces the bullet, so the list marker goes.
   Scoped to .contains-task-list, so a plain bullet in the same list keeps its
   marker. Kept as flow layout, not flex: a task item may contain a nested list,
   which flex would pull up alongside the label. The checkbox is emitted disabled
   — a share page is read-only — hence the default cursor: it shows state, it
   does not invite a click. */
.markdown .contains-task-list { list-style:none; padding-left:2px; }
.markdown .task-list-item input[type="checkbox"] { margin:0 8px 0 0; vertical-align:middle; cursor:default; }
/* Strike the label only. A loose list (one with blank lines between items) wraps
   each label in a <p>, so the checkbox sits at li > p > input rather than
   li > input — both shapes are matched. The :not() keeps the rule off an item
   that nests a sub-list, whose children would otherwise inherit the line
   through a parent they do not belong to. */
.markdown .task-list-item:has(> input:checked):not(:has(ul,ol)),
.markdown .task-list-item:has(> p > input:checked):not(:has(ul,ol)) { text-decoration:line-through; color:var(--text-dim); }
/* In a loose list the strike lands on the <p>, which also carries the checkbox;
   keep the box itself unstruck. */
.markdown .task-list-item input[type="checkbox"] { text-decoration:none; }
.markdown hr { border:none; border-top:1px solid var(--border); margin:28px 0; }
.markdown table { border-collapse:collapse; width:100%; margin:16px 0 20px; display:block; overflow-x:auto; }
.markdown th,.markdown td { border:1px solid var(--border); padding:6px 10px; text-align:left; }
.markdown code { background:var(--bg-alt); padding:1px 5px; border-radius:4px; font-size:13px; }
.markdown pre { background:var(--bg-alt); padding:12px; border-radius:var(--radius); overflow-x:auto; }
.markdown pre code { background:none; padding:0; }
.markdown blockquote { border-left:3px solid var(--border); margin:12px 0; padding:2px 14px; color:var(--text-dim); }
.markdown img { max-width:100%; }
.foot { margin-top:48px; padding-top:16px; border-top:1px solid var(--border); font-size:12px; color:var(--text-dim); }
.mapcard { position:relative; display:flex; align-items:stretch; gap:12px; width:100%; box-sizing:border-box; margin:12px 0; min-height:72px; padding:10px 12px 10px 20px; border:1px solid var(--border); border-radius:9px; background:var(--bg-alt); color:var(--text); }
.mapcard:hover { text-decoration:none; }
.mapcard-pin { position:absolute; top:10px; left:-12px; width:24px; height:24px; background:#d9534f; border-radius:50% 50% 50% 0; transform:rotate(-45deg); box-shadow:0 1px 2px rgba(0,0,0,.3); }
.mapcard-pin-in { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; transform:rotate(45deg); color:#fff; font-size:12px; font-weight:700; line-height:1; }
.mapcard-pin-dot { width:7px; height:7px; border-radius:50%; background:#fff; }
.mapcard-body { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; justify-content:flex-start; gap:2px; }
.mapcard-title { font-weight:700; line-height:1.25; overflow-wrap:anywhere; }
.mapcard-sub { color:var(--text-dim); font-size:.88em; line-height:1.3; overflow-wrap:anywhere; }
.mapcard-note { color:var(--text); }
.mapcard-rating { color:#f5a623; font-size:.85em; letter-spacing:1px; }
.mapcard-thumb { flex:none; align-self:flex-start; width:88px; height:68px; border-radius:8px; overflow:hidden; background:var(--bg-active); }
.mapcard-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
@media (min-width:1100px) { .mapcard-thumb { width:126px; height:96px; } }
`.trim();

function renderPage(note, bodyHtml, relRows) {
  const title = escapeHtml(note.title);
  const status = note.frontmatter.status ?? note.frontmatter.Status;
  const meta = [];
  if (note.type) meta.push(`<span class="badge">${escapeHtml(note.type)}</span>`);
  if (status) meta.push(`<span class="badge status">${escapeHtml(String(status))}</span>`);
  for (const [key, targets] of relRows) {
    const chips = targets
      .map((t) => `<a class="chip" href="/shared/${t.uuid}/">${escapeHtml(t.text)}</a>`)
      .join('');
    meta.push(`<span class="rel"><span class="rel-key">${escapeHtml(key)}:</span>${chips}</span>`);
  }
  const metaHtml = meta.length ? `<div class="meta">${meta.join('')}</div>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<meta name="x-web-vault-shared" content="1" />
<title>${title}</title>
<!-- One file for every share page, copied by copy-brand.mjs. It lives inside
     /shared/ because that prefix is the one on a Cloudflare Access Bypass:
     the icon at the site root is private and would 302 to the login. -->
<link rel="icon" href="../favicon.svg" type="image/svg+xml" />
<style>${CSS}</style>
</head>
<body>
<article class="note-inner">
${metaHtml}
<div class="markdown">${bodyHtml}</div>
<div class="foot">Shared page · read-only</div>
</article>
</body>
</html>`;
}

// noteId -> share_id (uuid), validating the id and skipping duplicates/invalids.
export function buildSharedMap(notes) {
  const sharedUuidByNoteId = {};
  const shareable = [];
  for (const n of notes) {
    const raw = n.frontmatter && n.frontmatter.share_id;
    if (raw == null || raw === '') continue;
    const uuid = String(raw).trim();
    if (!SAFE_ID.test(uuid)) {
      console.warn(`[shared] invalid share_id in ${n.path}: "${uuid}" (allowed A-Za-z0-9_-) — skipped`);
      continue;
    }
    if (sharedUuidByNoteId[n.id] || Object.values(sharedUuidByNoteId).includes(uuid)) {
      console.warn(`[shared] duplicate share_id "${uuid}" (${n.path}) — skipped`);
      continue;
    }
    sharedUuidByNoteId[n.id] = uuid;
    shareable.push(n);
  }
  return { sharedUuidByNoteId, shareable };
}

// Render one shareable note to its full HTML page.
export function renderSharedPageForNote(note, content, sharedUuidByNoteId) {
  const { titleIndex, idTitle, maps = {} } = content;
  const md = transformSharedWikilinks(note.body, titleIndex, idTitle, sharedUuidByNoteId);
  const bodyHtml = renderBody(md, maps);
  const relRows = [];
  for (const [key, val] of Object.entries(note.frontmatter)) {
    if (key.startsWith('_') || key === 'share_id') continue;
    const targets = sharedRelTargets(val, titleIndex, idTitle, sharedUuidByNoteId);
    if (targets.length) relRows.push([key, targets]);
  }
  return renderPage(note, bodyHtml, relRows);
}

// Convenience for the dev middleware: render the page for a given share uuid, or
// null if no shared note has it.
export function renderSharedPage(content, uuid) {
  const { sharedUuidByNoteId } = buildSharedMap(content.notes);
  const note = content.notes.find((n) => sharedUuidByNoteId[n.id] === uuid);
  return note ? renderSharedPageForNote(note, content, sharedUuidByNoteId) : null;
}
