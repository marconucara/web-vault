// "Durable markdown" layer for the block editor (BlockNote).
// Inspired by Tolaria's approach (AGPL repo) but our own implementation:
// - frontmatter kept OUT of BlockNote (split off first, re-appended after);
// - [[wikilinks]] protected with the Unicode tokens ‹ › before the parse, so
//   BlockNote's markdown serializer does not escape/break them, and restored
//   after the export.
//
// The goal is a clean round-trip: opening a note, not touching it, and
// re-serializing must return (ideally) the same markdown.
import { BlockNoteEditor } from '@blocknote/core';
import { MEDIA_EXT, MD_LINK, parseMapCardLine, createMapGrouper, createColorAssigner } from './mdLinks.js';
import { schema, injectCustomBlocks, extractCustomBlocks } from './blocknoteSchema.jsx';

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export function splitFrontmatter(md) {
  const m = md.match(FRONTMATTER);
  const fm = m ? m[0] : '';
  return { frontmatter: fm, body: md.slice(fm.length) };
}

// [[target]] / [[target|alias]] -> ‹<payload-url-encoded>›
// encodeURIComponent prevents markdown special characters from ending up inside
// the token; ‹ › (U+2039/U+203A) are not markdown syntax and survive the
// round-trip as text.
const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
export function preProcessWikilinks(body) {
  return body.replace(WIKILINK, (_m, target, alias) => {
    const payload = alias != null ? `${target}|${alias}` : target;
    return `‹${encodeURIComponent(payload)}›`;
  });
}

const TOKEN = /‹([^›]+)›/g;
export function postProcessWikilinks(md) {
  return md.replace(TOKEN, (_m, enc) => {
    let payload = enc;
    try {
      payload = decodeURIComponent(enc);
    } catch {
      // invalid token: leave as is
    }
    return `[[${payload}]]`;
  });
}

// Media/file links ([name](url.mp4|.mp3|.pdf|…) or to attachments/) would
// otherwise be "lost" by BlockNote's lossy exporter: we protect them as ⟦…⟧
// tokens (different from the wikilink one) and restore them afterward. Images
// ![](..), on the other hand, BlockNote handles natively, so we leave them alone.
export function preProcessMediaLinks(body) {
  return body.replace(MD_LINK, (m, bang, _text, url) => {
    if (bang) return m; // image: BlockNote handles it
    if (MEDIA_EXT.test(url) || url.includes('attachments/')) {
      return `⟦${encodeURIComponent(m)}⟧`;
    }
    return m;
  });
}

const MEDIA_TOKEN = /⟦([^⟧]+)⟧/g;
export function postProcessMediaLinks(md) {
  return md.replace(MEDIA_TOKEN, (_m, enc) => {
    try {
      return decodeURIComponent(enc);
    } catch {
      return _m;
    }
  });
}

// A "map card line" (a Google Maps link that starts a line, optionally after a
// list marker, with optional trailing text) becomes a ⟬…⟭ token whose payload is
// the ORIGINAL line, verbatim. The token survives BlockNote's parser as plain
// text and is later promoted to a `mapcard` block. Links buried in prose are
// left untouched. Code fences are skipped.
export function preProcessMapLinks(body) {
  let inFence = false;
  let prevWasToken = false;
  const grouper = createMapGrouper();
  const colorOf = createColorAssigner();
  const out = [];
  for (const line of (body || '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push(line);
      prevWasToken = false;
      grouper(line); // fence marker is a non-list line: resets the current list
      continue;
    }
    if (inFence) {
      out.push(line);
      prevWasToken = false;
      continue;
    }
    const rawGroup = grouper(line) || 0;
    if (parseMapCardLine(line)) {
      const group = colorOf(rawGroup); // color index by first appearance
      // Adjacent card lines (e.g. list items) must each become their OWN block,
      // else BlockNote merges them into one paragraph: force a blank line
      // between consecutive tokens. postProcessMapLinks collapses it back.
      // The token carries the group (g<N>:) so the block can color its pin; the
      // group is stripped on the way out, so the vault markdown stays clean.
      if (prevWasToken) out.push('');
      out.push(`⟬g${group}:${encodeURIComponent(line.replace(/\s+$/, ''))}⟭`);
      prevWasToken = true;
    } else {
      out.push(line);
      prevWasToken = false;
    }
  }
  return out.join('\n');
}

const MAP_TOKEN = /⟬([^⟭]+)⟭/g;
// Token inner is `g<N>:<encoded-line>` (group prefix optional). Strip the group
// and decode back to the original line.
function decodeTokenInner(inner) {
  const m = String(inner).match(/^g\d+:([\s\S]*)$/);
  const enc = m ? m[1] : inner;
  try {
    return decodeURIComponent(enc);
  } catch {
    return enc;
  }
}
const isListItemLine = (s) => /^\s*(?:[-*+]|\d+[.)])\s/.test(s);

export function postProcessMapLinks(md) {
  // Each map token became its own paragraph, so BlockNote separates consecutive
  // tokens with a blank line. For tokens that were LIST items, collapse that
  // blank line so a list of places round-trips as a tight list (not a loose one
  // split by blank lines). Then restore the original lines verbatim.
  const collapsed = md.replace(/(⟬[^⟭]+⟭)\n\n+(?=⟬[^⟭]+⟭)/g, (m, tok) =>
    isListItemLine(decodeTokenInner(tok.slice(1, -1))) ? `${tok}\n` : m
  );
  return collapsed.replace(MAP_TOKEN, (_m, inner) => decodeTokenInner(inner));
}

// Full pre/post pipeline (wikilink + media link + map link).
const preProcess = (body) => preProcessMapLinks(preProcessMediaLinks(preProcessWikilinks(body || '')));
const postProcess = (md) => postProcessMapLinks(postProcessMediaLinks(postProcessWikilinks(md)));

// Normalizes BlockNote's output to the vault style (like Tolaria):
// - unordered lists `* ` -> `- `;
// - compact tables (trimmed cells, `---` separators), instead of the alignment
//   padding that BlockNote's exporter adds.
// All outside code fences (inside code nothing is touched).
function compactTableLine(line) {
  let cells = line.trim().split('|');
  if (cells[0] === '') cells = cells.slice(1);
  if (cells.length && cells[cells.length - 1] === '') cells = cells.slice(0, -1);
  const isSep = cells.length > 0 && cells.every((c) => /^\s*:?-+:?\s*$/.test(c));
  if (isSep) {
    return '|' + cells.map((c) => {
      const t = c.trim();
      return (t.startsWith(':') ? ':' : '') + '---' + (t.endsWith(':') ? ':' : '');
    }).join('|') + '|';
  }
  return '| ' + cells.map((c) => c.trim()).join(' | ') + ' |';
}

function normalizeMarkdown(md) {
  const out = [];
  let inFence = false;
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; out.push(line); continue; }
    if (inFence) { out.push(line); continue; }
    if (/^\s*\|/.test(line)) { out.push(compactTableLine(line)); continue; }
    out.push(line.replace(/^(\s*)\* /, '$1- '));
  }
  return out.join('\n');
}

// A reusable editor for parse/serialize (the methods do not mutate the document).
let _editor = null;
function editor() {
  if (!_editor) _editor = BlockNoteEditor.create({ schema });
  return _editor;
}

// markdown (body only) -> BlockNote blocks
export async function bodyToBlocks(body) {
  return editor().tryParseMarkdownToBlocks(preProcess(body));
}

// BlockNote blocks -> markdown (body only)
export async function blocksToBody(blocks) {
  const out = await editor().blocksToMarkdownLossy(blocks);
  return normalizeMarkdown(postProcess(out));
}

// Round-trip of the body only (to measure fidelity).
export async function roundTripBody(body) {
  return blocksToBody(await bodyToBlocks(body));
}

// --- Versions that use the component's editor (for the mounted editor) ---

// Loads a markdown body (without frontmatter) into the given BlockNote editor.
export async function loadBodyIntoEditor(ed, body) {
  const blocks = await ed.tryParseMarkdownToBlocks(preProcess(body));
  const injected = injectCustomBlocks(blocks);
  if (injected && injected.length) ed.replaceBlocks(ed.document, injected);
}

// Serializes the editor document into a markdown body (vault style), with the
// leading blank line and the trailing newline as in the vault notes.
export async function serializeEditorBody(ed) {
  const extracted = extractCustomBlocks(ed.document);
  const out = await ed.blocksToMarkdownLossy(extracted);
  const s = normalizeMarkdown(postProcess(out)).replace(/\s+$/, '');
  return `\n${s}\n`;
}

// Round-trip of a whole note (frontmatter preserved verbatim + body).
export async function roundTripNote(md) {
  const { frontmatter, body } = splitFrontmatter(md);
  return frontmatter + (await roundTripBody(body));
}
