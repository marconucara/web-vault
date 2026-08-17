import React from 'react';
import { createReactInlineContentSpec, createReactBlockSpec } from '@blocknote/react';
import { BlockNoteSchema, defaultInlineContentSpecs, defaultBlockSpecs, defaultStyleSpecs } from '@blocknote/core';
import Icon from '../components/Icon.jsx';
import MapCard from '../components/MapCard.jsx';
import { MEDIA_EXT } from './mdLinks.js';
import { chipClickIntent, isChipAuxClick } from './chipClick.js';
import { headingSpecWithAnchors } from './headingAnchors.js';
import { noteHash } from './headingSlug.js';
import { resolveTargetAnchor } from './wikilinks.js';
import { titleIndex, idTitle } from '../content.js';

// Resolves a wikilink target (path form `folder/filename`, title, or filename,
// each optionally carrying a `#heading` anchor) to the note id and the anchor.
function resolveWikilink(target) {
  return resolveTargetAnchor(target, titleIndex);
}

// Opens `href` per the gesture behind `e`: a plain click follows it, a modifier
// or middle click opens a new tab, anything else is left to the browser. Shared
// by the wikilink and media chips. `alwaysNewTab` is for a target that is not an
// app route — media — where even a plain click should leave the editor standing.
function handleChipClick(e, href, { alwaysNewTab = false } = {}) {
  const intent = chipClickIntent(e);
  if (intent === 'ignore') return;
  e.preventDefault();
  e.stopPropagation();
  if (intent === 'new-tab' || alwaysNewTab) window.open(href, '_blank', 'noopener,noreferrer');
  else window.location.hash = href;
}

// The pair of listeners every chip installs, splitting the buttons so no gesture
// can ever be answered twice (see isChipAuxClick).
function chipClickHandlers(href, options) {
  return {
    onClick: (e) => {
      if (isChipAuxClick(e)) return;
      handleChipClick(e, href, options);
    },
    onAuxClick: (e) => {
      if (!isChipAuxClick(e)) return;
      handleChipClick(e, href, options);
    },
  };
}

// Custom "wikilink" inline content: atomic chip that opens its target note (the
// in-app hash route) on a plain click or tap, like every other link surface in
// the product; if the target doesn't exist it stays a "dead", inert chip. Shows
// the note title (not the path). A resolved chip is a real anchor, which is what
// gives the context menu, middle click and long-press "Open in new tab" for
// free. See adr/0016-wikilink-and-media-blocks.md.
export function WikilinkChip({ target, alias }) {
  const { id, anchor } = resolveWikilink(target);
  const label = alias || (id && idTitle[id]) || target;
  if (!id) return <span className="wl-chip dead" title={target}>{label}</span>;
  const href = noteHash(id, anchor);
  return (
    <a className="wl-chip" href={href} title={target} {...chipClickHandlers(href)}>
      {label}
    </a>
  );
}

export const Wikilink = createReactInlineContentSpec(
  {
    type: 'wikilink',
    propSchema: { target: { default: '' }, alias: { default: '' } },
    content: 'none',
  },
  { render: ({ inlineContent }) => <WikilinkChip {...inlineContent.props} /> }
);

// Custom "medialink" inline content: chip for media/file links (video, audio,
// pdf, ...). Round-trip guaranteed; in the visual editor it is a chip with an
// icon instead of an unreadable token.
function kindOf(url) {
  const clean = String(url).split(/[?#]/)[0].toLowerCase();
  if (/\.(mp4|webm|ogv|mov|m4v)$/.test(clean)) return 'video';
  if (/\.(mp3|wav|ogg|oga|m4a|aac|flac)$/.test(clean)) return 'audio';
  return 'file';
}

export function MedialinkChip({ name, url, kind }) {
  const icon = kind === 'video' ? 'video' : kind === 'audio' ? 'music' : 'paperclip';
  const body = (
    <>
      <Icon name={icon} size={13} />
      {name || url}
    </>
  );
  if (!url) return <span className={`media-chip ${kind}`} title={url}>{body}</span>;
  return (
    <a
      className={`media-chip ${kind}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      // Media lives outside the app's routes, so every gesture opens a new tab.
      {...chipClickHandlers(url, { alwaysNewTab: true })}
    >
      {body}
    </a>
  );
}

export const Medialink = createReactInlineContentSpec(
  {
    type: 'medialink',
    propSchema: { name: { default: '' }, url: { default: '' }, kind: { default: 'file' } },
    content: 'none',
  },
  { render: ({ inlineContent }) => <MedialinkChip {...inlineContent.props} /> }
);

// Custom "mapcard" block: a Google Maps link alone on its own line, rendered as
// a keyless OpenStreetMap mini-map + title. It is an atomic block (content:
// 'none'): not text-editable, and it round-trips back to the original link via
// extractCustomBlocks (below), so the vault markdown is never altered. The token
// (payload of the ⟬…⟭ marker) is carried in props.
export const Mapcard = createReactBlockSpec(
  { type: 'mapcard', propSchema: { token: { default: '' }, group: { default: 0 } }, content: 'none' },
  {
    render: ({ block, editor }) => (
      <MapCard token={block.props.token} group={block.props.group} block={block} editor={editor} />
    ),
  }
);

// TipTap's `code` mark ships with `excludes: "_"`, meaning it excludes every
// other mark: a code span can carry no emphasis. That is a reasonable default
// for an editor where code is a terminal formatting state, but for a vault it
// is data loss — `**bold with `code` inside**` parses with the bold already
// stripped off the code span, so nothing downstream can put it back.
// Relaxing `excludes` lets the two marks coexist through the parse. `code: true`
// is left as upstream has it: it plays no part in the stripping.
// See adr/0015-durable-markdown-round-trip.md.
const codeStyle = defaultStyleSpecs.code;
const styleSpecs = {
  ...defaultStyleSpecs,
  code: {
    ...codeStyle,
    implementation: {
      ...codeStyle.implementation,
      mark: codeStyle.implementation.mark.extend({ excludes: '' }),
    },
  },
};

export const schema = BlockNoteSchema.create({
  styleSpecs,
  blockSpecs: {
    ...defaultBlockSpecs,
    // The stock heading, with an `id` on the rendered element so a heading can
    // be linked to (adr/0044-what-the-url-addresses.md). Only `render` is
    // overridden; the shortcuts, input rules and menu entries are untouched.
    heading: headingSpecWithAnchors(),
    // createReactBlockSpec returns a factory (options) => BlockSpec: call it.
    mapcard: Mapcard(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikilink: Wikilink,
    medialink: Medialink,
  },
});

// --- inject / extract of tokens <-> custom inline content ---
// Wikilink: ‹payload-url-encoded›  (payload = target or target|alias)
// Medialink: ⟦md-link-url-encoded⟧ (payload = "[name](url)")
const SCAN = /‹([^›]+)›|⟦([^⟧]+)⟧/g;

function safeDecode(enc) {
  try {
    return decodeURIComponent(enc);
  } catch {
    return enc;
  }
}

function decodeWikilink(enc) {
  const p = safeDecode(enc);
  const i = p.indexOf('|');
  return i === -1 ? { target: p, alias: '' } : { target: p.slice(0, i), alias: p.slice(i + 1) };
}

function decodeMedia(enc) {
  const raw = safeDecode(enc); // "[name](url)"
  const m = raw.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
  const name = m ? m[1] : raw;
  const url = m ? m[2] : '';
  return { name, url, kind: kindOf(url) };
}

function encWikilink(props) {
  const payload = props.alias ? `${props.target}|${props.alias}` : props.target;
  return `‹${encodeURIComponent(payload)}›`;
}
function encMedia(props) {
  return `⟦${encodeURIComponent(`[${props.name}](${props.url})`)}⟧`;
}

function injectInline(content) {
  if (!Array.isArray(content)) return content;
  const out = [];
  for (const item of content) {
    if (
      item && item.type === 'text' && typeof item.text === 'string' &&
      (item.text.includes('‹') || item.text.includes('⟦'))
    ) {
      const text = item.text;
      let last = 0;
      let m;
      SCAN.lastIndex = 0;
      while ((m = SCAN.exec(text))) {
        if (m.index > last) out.push({ ...item, text: text.slice(last, m.index) });
        if (m[1] != null) out.push({ type: 'wikilink', props: decodeWikilink(m[1]) });
        else out.push({ type: 'medialink', props: decodeMedia(m[2]) });
        last = m.index + m[0].length;
      }
      if (last < text.length) out.push({ ...item, text: text.slice(last) });
    } else {
      out.push(item);
    }
  }
  return out;
}

// BlockNote's exporter brackets every span on its own: it has no notion of a
// run, so `**bold with `code` inside**` — three spans sharing `bold`, the middle
// one also `code` — is emitted as `**bold with** **`code`**** inside**`, with the
// delimiters repeated around each piece. That is not what the author wrote, and
// re-parsing it loses formatting.
//
// The styles themselves are correct by this point (the schema keeps `code`
// alongside emphasis), so rather than repairing the exporter's string we render
// each run ourselves: group consecutive spans by the emphasis marks they share,
// emit one delimiter pair around the group, and hand the result over as plain
// text — which the exporter passes through untouched.
//
// See adr/0015-durable-markdown-round-trip.md.
const EMPHASIS = [
  ['bold', '**'],
  ['italic', '*'],
  ['strike', '~~'],
];

const isTextSpan = (it) => it && it.type === 'text' && typeof it.text === 'string';

// The marks that take delimiters, as a stable key — `code` is excluded because
// it is rendered per span (backticks hug the code itself, never the whole run).
const emphasisKey = (styles) =>
  EMPHASIS.filter(([name]) => styles && styles[name]).map(([name]) => name).join(',');

// A link carries its emphasis on the text inside it, so it can sit in the middle
// of a run (`**bold [link](url) here**`). It joins the run only when all of its
// text agrees on the same emphasis, which is the only case where one delimiter
// pair around the whole run is faithful.
const isLinkSpan = (it) =>
  it && it.type === 'link' && Array.isArray(it.content) && it.content.length > 0 &&
  it.content.every(isTextSpan);
const linkKey = (it) => {
  const keys = it.content.map((c) => emphasisKey(c.styles));
  return keys.every((k) => k === keys[0]) ? keys[0] : null;
};

// One span as it appears inside its run: the code backticks, if any, but no
// emphasis delimiters — those belong to the run.
function renderSpanBody(item) {
  if (item.type === 'link') {
    return `[${item.content.map(renderSpanBody).join('')}](${item.href})`;
  }
  const text = item.text;
  return item.styles && item.styles.code ? `\`${text}\`` : text;
}

// The emphasis of a run lives on its text spans; for a link it lives on the text
// inside it.
const runStyles = (item) =>
  (item.type === 'link' ? item.content[0].styles : item.styles) || {};

function renderRun(spans) {
  const body = spans.map(renderSpanBody).join('');
  const styles = runStyles(spans[0]);
  // Emphasis delimiters cannot sit against the run's own padding (`** bold **`
  // is not emphasis), so keep the surrounding whitespace outside the pair.
  const [, lead = '', core = '', trail = ''] = body.match(/^(\s*)([\s\S]*?)(\s*)$/) || [];
  if (!core) return body;
  const delims = EMPHASIS.filter(([name]) => styles[name]).map(([, d]) => d);
  const open = delims.join('');
  const close = delims.slice().reverse().join('');
  return `${lead}${open}${core}${close}${trail}`;
}

// Groups consecutive text spans that share the same emphasis and renders each
// group as one pre-formatted plain-text span. Spans with no emphasis at all are
// left exactly as they were, so ordinary text keeps the exporter's own escaping.
function joinEmphasisRuns(content) {
  const out = [];
  let run = [];
  const flush = () => {
    if (!run.length) return;
    out.push({ type: 'text', text: renderRun(run), styles: {} });
    run = [];
  };
  for (const item of content) {
    const key = isTextSpan(item)
      ? emphasisKey(item.styles)
      : isLinkSpan(item) ? linkKey(item) : null;
    if (!key) {
      flush();
      out.push(item);
      continue;
    }
    if (run.length && emphasisKey(runStyles(run[0])) !== key) flush();
    run.push(item);
  }
  flush();
  return out;
}

function extractInline(content) {
  if (!Array.isArray(content)) return content;
  const mapped = content.map((item) => {
    if (item && item.type === 'wikilink') return { type: 'text', text: encWikilink(item.props), styles: {} };
    if (item && item.type === 'medialink') return { type: 'text', text: encMedia(item.props), styles: {} };
    return item;
  });
  return joinEmphasisRuns(mapped);
}

// A paragraph whose ONLY content is a media token ⟦…⟧ represents a "block-level"
// media (video/audio/file on its own line, as in the vault). We promote it to
// the corresponding native BlockNote block, which renders real players/cards
// (same rendering as Tolaria). Media tokens inside mixed text instead stay
// inline chips (handled by injectInline).
const MEDIA_ONLY = /^\s*⟦([^⟧]+)⟧\s*$/;
const MAP_ONLY = /^\s*⟬([^⟭]+)⟭\s*$/;
const MEDIA_BLOCK_TYPES = new Set(['video', 'audio', 'file']);

// Markers to re-emit around a styled span, innermost first. `code` is applied
// last (outermost) so it wraps the others, matching how the exporter writes a
// styled run back out.
const STYLE_MARKERS = [
  ['bold', '**'],
  ['italic', '*'],
  ['strike', '~~'],
  ['code', '`'],
];

// The paragraph's text, joined across ALL its spans — or null if any part of it
// is not plain text (a link, a wikilink chip, an inline media token).
//
// Joining rather than requiring a single span is what makes the promotion depend
// on the token alone. A token's payload is percent-encoded, but the encoding
// leaves plenty of markdown punctuation untouched (`*` most visibly, but also
// `_`, `~`, `!`), so BlockNote's parser reads a description carrying emphasis as
// markup and hands back several styled spans instead of one. The token is intact
// in every one of those cases — merely spread across the spans — so requiring a
// single span rejected a perfectly good card and left the raw ⟬…⟭ on screen.
//
// The markers are RE-EMITTED from each span's styles rather than simply
// dropped. The parser consumed them into `styles` on the way in, so joining the
// bare text alone would hand the card `a b c` where the author wrote `a **b**
// c`: the vault file stays correct either way (the exporter re-applies the
// styles on the way out), but the card renders from this payload, and the
// emphasis it is supposed to show would be gone by the time it got there.
function paragraphSoleText(b) {
  if (!b || b.type !== 'paragraph' || !Array.isArray(b.content)) return null;
  let text = '';
  for (const it of b.content) {
    if (!it || it.type !== 'text' || typeof it.text !== 'string') return null;
    const styles = it.styles || {};
    const marks = STYLE_MARKERS.filter(([name]) => styles[name]).map(([, mark]) => mark);
    const open = marks.join('');
    const close = [...marks].reverse().join('');
    text += open + it.text + close;
  }
  return text;
}

function paragraphMediaToken(b) {
  const text = paragraphSoleText(b);
  const m = text != null ? text.match(MEDIA_ONLY) : null;
  return m ? m[1] : null;
}

function paragraphMapToken(b) {
  const text = paragraphSoleText(b);
  const m = text != null ? text.match(MAP_ONLY) : null;
  return m ? m[1] : null;
}

function mediaBlock(enc, id) {
  const { name, url, kind } = decodeMedia(enc);
  const props = kind === 'file' ? { url, name } : { url, name, showPreview: true };
  return { ...(id ? { id } : {}), type: kind, props, children: [] };
}

// A table's content is not an inline array but a `tableContent` object holding
// rows of cells, so mapping only `Array.isArray(content)` skipped every cell:
// a wikilink written inside a table kept its ‹…› token as literal text, both on
// screen and on the way back out. Each cell is itself either a bare inline array
// or a `tableCell` object wrapping one, so both shapes are handled.
const isTableContent = (c) => c && !Array.isArray(c) && Array.isArray(c.rows);

function mapTableContent(content, mapInline) {
  return {
    ...content,
    rows: content.rows.map((row) => ({
      ...row,
      cells: (row.cells || []).map((cell) =>
        Array.isArray(cell)
          ? mapInline(cell)
          : cell && Array.isArray(cell.content)
            ? { ...cell, content: mapInline(cell.content) }
            : cell
      ),
    })),
  };
}

// Inline content of a block, whatever shape the block uses for it.
function mapBlockContent(content, mapInline) {
  if (Array.isArray(content)) return mapInline(content);
  if (isTableContent(content)) return mapTableContent(content, mapInline);
  return content;
}

export function injectCustomBlocks(blocks) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((b) => {
    const enc = paragraphMediaToken(b);
    if (enc) return mediaBlock(enc, b.id);
    const mapEnc = paragraphMapToken(b);
    if (mapEnc) {
      // Token inner is `g<N>:<encoded-line>`: split the group off so the pin can
      // be colored, keeping props.token as the clean (round-trippable) payload.
      const gm = mapEnc.match(/^g(\d+):([\s\S]*)$/);
      const group = gm ? Number(gm[1]) : 0;
      const token = gm ? gm[2] : mapEnc;
      return { ...(b.id ? { id: b.id } : {}), type: 'mapcard', props: { token, group }, children: [] };
    }
    return {
      ...b,
      content: mapBlockContent(b.content, injectInline),
      children: Array.isArray(b.children) ? injectCustomBlocks(b.children) : b.children,
    };
  });
}

export function extractCustomBlocks(blocks) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((b) => {
    if (b && b.type === 'mapcard') {
      // Back to a paragraph carrying the ⟬…⟭ token; postProcessMapLinks then
      // restores the original link line verbatim.
      const token = (b.props && b.props.token) || '';
      return {
        ...b,
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: `⟬${token}⟭`, styles: {} }],
        children: [],
      };
    }
    if (b && MEDIA_BLOCK_TYPES.has(b.type)) {
      const name = (b.props && b.props.name) || '';
      const url = (b.props && b.props.url) || '';
      // Back to a paragraph with the media token: the exporter emits it as text
      // and postProcess brings it back to the exact [name](url).
      return {
        ...b,
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: encMedia({ name, url }), styles: {} }],
        children: [],
      };
    }
    return {
      ...b,
      content: mapBlockContent(b.content, extractInline),
      children: Array.isArray(b.children) ? extractCustomBlocks(b.children) : b.children,
    };
  });
}
