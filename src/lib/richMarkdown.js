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

// A hand-authored note wraps its prose at some column; in markdown those plain
// newlines carry no meaning and a renderer reflows them. BlockNote's parser
// keeps them as literal `\n` inside the block's text, so the editor shows a
// break wherever the source happened to wrap. The same wrap inside a list item
// is worse: the continuation becomes a *sibling paragraph*, the item drops out
// of the list, and a following ordered item restarts at 1.
//
// Both are irreversible once parsed (a paragraph after an item is ambiguous),
// so the join happens here, before the parse: fold every continuation line onto
// the line it continues. A blank line still ends the block, and constructs
// where the newline IS structural are left alone.
const LIST_MARKER = /^(\s*)(?:[-*+]|\d+[.)])\s+/;
// Lines whose break is structural rather than a soft wrap: fence markers,
// headings, table rows, blockquotes, and thematic breaks.
const STRUCTURAL = /^\s*(?:#{1,6}\s|\||>|(?:[-*_]\s*){3,}$)/;

export function joinListContinuations(body) {
  const out = [];
  let inFence = false;
  let itemIndent = null; // indent width of the marker text for the open item
  let inParagraph = false; // a paragraph line is open and may absorb a wrap
  for (const line of (body || '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      itemIndent = null;
      inParagraph = false;
      out.push(line);
      continue;
    }
    if (inFence) { out.push(line); continue; }

    if (line.trim() === '') {
      itemIndent = null;
      inParagraph = false;
      out.push(line);
      continue;
    }

    const marker = line.match(LIST_MARKER);
    if (marker) {
      itemIndent = marker[0].length;
      inParagraph = false;
      out.push(line);
      continue;
    }

    if (STRUCTURAL.test(line)) {
      itemIndent = null;
      inParagraph = false;
      out.push(line);
      continue;
    }

    // Inside an open item, a non-blank line indented at least to the marker's
    // text column is a continuation: append it to the item instead of breaking
    // the list.
    if (itemIndent !== null && /^\s+/.test(line)) {
      const indent = line.match(/^\s*/)[0].length;
      if (indent >= Math.min(itemIndent, 2)) {
        out[out.length - 1] += ` ${line.trim()}`;
        continue;
      }
    }

    // Otherwise this is prose. A line following an open paragraph line is that
    // paragraph's soft wrap — join it so the editor does not show a break the
    // author never typed.
    if (inParagraph && itemIndent === null) {
      out[out.length - 1] += ` ${line.trim()}`;
      continue;
    }

    itemIndent = null;
    inParagraph = true;
    out.push(line);
  }
  return out.join('\n');
}

// A fence with no info string parses to a code block whose `language` prop is
// `text` — BlockNote's default — which is exactly what a fence that DID declare
// `text` parses to. The two collapse into the same block, so by export time
// "the author wrote nothing" is no longer recoverable and the exporter labels
// both ```text. Marking the bare fence before the parse keeps them apart: the
// sentinel rides along as the block's language and is stripped on the way out,
// so a bare fence stays bare and an explicit `text` stays `text`.
//
// Only the OPENING fence of a block carries an info string; the closing one is
// bare by definition, so the fence state has to be tracked rather than matching
// every bare marker. The sentinel is not a plausible language name, so a fence
// that really declares it is not a case worth protecting.
const BARE_FENCE_LANG = 'wv-plain';
// The marker is the full run of backticks/tildes, so a longer fence (````) is
// matched whole and the leftover backticks are not mistaken for an info string.
const FENCE_OPEN = /^(\s*)(`{3,}|~{3,})(.*)$/;

export function preProcessBareFences(body) {
  const out = [];
  let fence = null; // marker of the open fence, null outside one
  for (const line of (body || '').split('\n')) {
    const m = line.match(FENCE_OPEN);
    if (!m) { out.push(line); continue; }
    const [, indent, marker, info] = m;
    if (fence) {
      // A closing marker is of the same kind, at least as long as the opening
      // one, and carries no info string. Anything else is literal content of
      // the fence that is open — including a shorter fence marker.
      const sameKind = marker[0] === fence[0];
      if (sameKind && marker.length >= fence.length && info.trim() === '') fence = null;
      out.push(line);
      continue;
    }
    fence = marker;
    out.push(info.trim() === '' ? `${indent}${marker}${BARE_FENCE_LANG}` : line);
  }
  return out.join('\n');
}

export function postProcessBareFences(md) {
  return (md || '').replace(
    new RegExp(`^(\\s*)(\`{3,}|~{3,})${BARE_FENCE_LANG}\\s*$`, 'gm'),
    '$1$2'
  );
}

// Full pre/post pipeline (wikilink + media link + map link + bare fences).
const preProcess = (body) =>
  preProcessBareFences(
    preProcessMapLinks(preProcessMediaLinks(preProcessWikilinks(joinListContinuations(body || ''))))
  );
const postProcess = (md) =>
  postProcessBareFences(postProcessMapLinks(postProcessMediaLinks(postProcessWikilinks(md))));

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

// A source-level soft wrap (a plain newline inside a paragraph) has no meaning
// in markdown, but BlockNote's exporter re-emits it as a hard break: the line
// ends with `\` and the next one starts with a space. Neither existed in the
// vault file, so an untouched note would not round-trip. Undo that pairing —
// only when both halves are present, so a hard break the author really typed
// (`\` with no leading space after it) is left alone.
function joinSoftWraps(md) {
  // Inside a blockquote the continuation carries the `> ` marker too, so the
  // artefact reads `\` + newline + `>  text` — strip the extra space the break
  // left behind and keep the quote marker.
  return md.replace(/\\\n>  /g, '\n> ').replace(/\\\n /g, '\n');
}

// When emphasis spans a soft wrap, the exporter closes it at the break and
// reopens it right after it: `**public and**\` + newline + `** read-only**`.
// The seam is only recognisable while the hard-break marker is still there —
// once the lines are joined, `**a** **b**` is indistinguishable from two
// genuine adjacent runs — so it has to be stitched before joinSoftWraps.
function joinSplitEmphasis(md) {
  return md.replace(/(\*{1,2})\\\n(\s*)\1/g, (_m, _delim, indent) => (indent ? ' ' : ''));
}

function normalizeMarkdown(md) {
  const out = [];
  let inFence = false;
  for (const line of joinSoftWraps(joinSplitEmphasis(md)).split('\n')) {
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
  // extractCustomBlocks also renders emphasis runs the exporter would otherwise
  // split around an inline code span, so it runs on this path too — not only on
  // the mounted-editor one.
  const out = await editor().blocksToMarkdownLossy(extractCustomBlocks(blocks));
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
