import React from 'react';
import { createReactInlineContentSpec, createReactBlockSpec } from '@blocknote/react';
import { BlockNoteSchema, defaultInlineContentSpecs, defaultBlockSpecs } from '@blocknote/core';
import Icon from '../components/Icon.jsx';
import MapCard from '../components/MapCard.jsx';
import { MEDIA_EXT } from './mdLinks.js';
import { titleIndex, idTitle } from '../content.js';

// Resolves a wikilink target (path form `folder/filename`, title, or filename)
// to the note id, as transformWikilinks does for the read view.
function resolveWikilink(target) {
  return titleIndex[String(target).trim().toLowerCase()] || null;
}

// Custom "wikilink" inline content: atomic, clickable chip. Navigates to the
// target note (in-app hash route) as in Tolaria; if the target doesn't exist it
// stays a "dead", non-clickable chip. Shows the note title (not the path).
export const Wikilink = createReactInlineContentSpec(
  {
    type: 'wikilink',
    propSchema: { target: { default: '' }, alias: { default: '' } },
    content: 'none',
  },
  {
    render: ({ inlineContent }) => {
      const { target, alias } = inlineContent.props;
      const id = resolveWikilink(target);
      const label = alias || (id && idTitle[id]) || target;
      // Like Tolaria: a normal click does NOT navigate (it lets you place the
      // cursor and edit the chip); Cmd/Ctrl+click is needed to open the target note.
      const onClick = (e) => {
        if (!id || !(e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        e.stopPropagation();
        window.location.hash = `#/n/${encodeURIComponent(id)}`;
      };
      return (
        <span
          className={`wl-chip${id ? '' : ' dead'}`}
          title={id ? `${target} — Cmd/Ctrl+click to open` : target}
          onClick={onClick}
        >
          {label}
        </span>
      );
    },
  }
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

export const Medialink = createReactInlineContentSpec(
  {
    type: 'medialink',
    propSchema: { name: { default: '' }, url: { default: '' }, kind: { default: 'file' } },
    content: 'none',
  },
  {
    render: ({ inlineContent }) => {
      const { name, url, kind } = inlineContent.props;
      const icon = kind === 'video' ? 'video' : kind === 'audio' ? 'music' : 'paperclip';
      return (
        <span className={`media-chip ${kind}`} title={url}>
          <Icon name={icon} size={13} />
          {name || url}
        </span>
      );
    },
  }
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

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
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

function extractInline(content) {
  if (!Array.isArray(content)) return content;
  return content.map((item) => {
    if (item && item.type === 'wikilink') return { type: 'text', text: encWikilink(item.props), styles: {} };
    if (item && item.type === 'medialink') return { type: 'text', text: encMedia(item.props), styles: {} };
    return item;
  });
}

// A paragraph whose ONLY content is a media token ⟦…⟧ represents a "block-level"
// media (video/audio/file on its own line, as in the vault). We promote it to
// the corresponding native BlockNote block, which renders real players/cards
// (same rendering as Tolaria). Media tokens inside mixed text instead stay
// inline chips (handled by injectInline).
const MEDIA_ONLY = /^\s*⟦([^⟧]+)⟧\s*$/;
const MAP_ONLY = /^\s*⟬([^⟭]+)⟭\s*$/;
const MEDIA_BLOCK_TYPES = new Set(['video', 'audio', 'file']);

function paragraphSoleText(b) {
  if (!b || b.type !== 'paragraph' || !Array.isArray(b.content) || b.content.length !== 1) return null;
  const it = b.content[0];
  if (!it || it.type !== 'text' || typeof it.text !== 'string') return null;
  return it.text;
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
      content: Array.isArray(b.content) ? injectInline(b.content) : b.content,
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
      content: Array.isArray(b.content) ? extractInline(b.content) : b.content,
      children: Array.isArray(b.children) ? extractCustomBlocks(b.children) : b.children,
    };
  });
}
