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

// Both link passes below rewrite spans of the body into tokens, and both must
// leave code alone: a note that documents the wikilink syntax writes `[[` in a
// code span or a complete [[note]] in a fence, and neither is a link. Code is
// also where an *unmatched* `[[` is most likely to appear, which is what made
// the omission structural rather than cosmetic — see the newline note on
// WIKILINK below.
//
// Applying a replacer only outside code keeps that rule in one place instead of
// duplicating fence tracking in each pass. Fences are tracked line by line (the
// same way preProcessMapLinks and normalizeMarkdown do it) and code spans are
// found per line by matching backtick runs, so a closing run must be the same
// length as the one that opened the span.
const CODE_SPAN = /(`+)(?:[^`]|(?!\1)`)*\1/g;

/**
 * Applies `fn` to each stretch of `body` that is outside a fenced block and
 * outside an inline code span, leaving code verbatim.
 * @param {string} body
 * @param {(text: string) => string} fn
 * @returns {string}
 */
function outsideCode(body, fn) {
  const out = [];
  let inFence = false;
  for (const line of (body || '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) { out.push(line); continue; }
    // Split the line into code spans and the prose between them, mapping only
    // the prose. `lastIndex` walks the line so the untouched spans are copied
    // through exactly as written, backticks included.
    let result = '';
    let at = 0;
    CODE_SPAN.lastIndex = 0;
    let m;
    while ((m = CODE_SPAN.exec(line))) {
      result += fn(line.slice(at, m.index)) + m[0];
      at = m.index + m[0].length;
    }
    out.push(result + fn(line.slice(at)));
  }
  return out.join('\n');
}

// [[target]] / [[target|alias]] -> ‹<payload-url-encoded>›
// encodeURIComponent prevents markdown special characters from ending up inside
// the token; ‹ › (U+2039/U+203A) are not markdown syntax and survive the
// round-trip as text.
//
// The character classes exclude newlines because a wikilink never spans lines in
// Tolaria or Obsidian. Without that, an unmatched `[[` starts a match that runs
// to the next `]]` anywhere later in the note, swallowing the headings and
// paragraphs in between into one inline token — the blocks are gone from the
// editor, and the damage is committed as literal text the moment the user edits.
//
// This pass is only safe because postProcessWikilinks is its exact inverse: an
// untouched note is re-tokenised and detokenised symmetrically, so it commits
// byte-identical. The round-trip tests exist to keep that inverse true.
const WIKILINK = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g;
export function preProcessWikilinks(body) {
  return outsideCode(body, (text) =>
    text.replace(WIKILINK, (_m, target, alias) => {
      const payload = alias != null ? `${target}|${alias}` : target;
      return `‹${encodeURIComponent(payload)}›`;
    })
  );
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
  return outsideCode(body, (text) =>
    text.replace(MD_LINK, (m, bang, _text, url) => {
      if (bang) return m; // image: BlockNote handles it
      if (MEDIA_EXT.test(url) || url.includes('attachments/')) {
        return `⟦${encodeURIComponent(m)}⟧`;
      }
      return m;
    })
  );
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

// A code block keeps only its language, so everything else about how the fence
// was written is dropped on parse and re-invented by the exporter, which always
// emits three backticks and labels an unlabelled block `text`
// (see adr/0015-durable-markdown-round-trip.md, criterion 5):
//
//   ```      -> language "text" -> ```text   (a language the author never wrote)
//   ~~~js    -> language "js"   -> ```js     (the marker kind is gone)
//   ````     -> language "text" -> ```text   (the marker length is gone)
//
// The `text` case is the worst of the three because it is unrecoverable rather
// than merely lossy: a bare fence and one that really declares `text` parse to
// the same block, so no export-side rule could tell them apart.
//
// All three are carried across in the one field that does survive — the
// language — by rewriting the opening fence into a sentinel that encodes the
// marker and the original info string, then restoring it on the way out. The
// sentinel is not a plausible language name, so a fence that genuinely declares
// it is not a case worth protecting.
//
// Only the OPENING fence of a block carries an info string; the closing one is
// bare by definition, so the fence state has to be tracked rather than matching
// every bare marker.
const FENCE_SENTINEL = 'wv-fence';
// The marker is the full run of backticks/tildes, so a longer fence (````) is
// matched whole and the leftover backticks are not mistaken for an info string.
const FENCE_OPEN = /^(\s*)(`{3,}|~{3,})(.*)$/;
// `wv-fence-<kind><length>-<encoded info string>`, e.g. ```` ```` ```` with no
// info string becomes `wv-fence-b4-`, and `~~~js` becomes `wv-fence-t3-js`.
// The info string is encoded so a space or a backtick in it cannot break the
// language token apart.
//
// The fence's indent is NOT carried here. `exportBlocks` re-indents every block
// nested under a list item, code fences included, so carrying it too would
// apply it twice.
const SENTINEL_LINE = new RegExp(
  `^(\\s*)(\`{3,})${FENCE_SENTINEL}-([bt])(\\d+)-(\\S*)\\s*$`
);

/**
 * Rewrites every opening fence into a sentinel language carrying how the fence
 * was written, so the parse cannot drop it.
 * @param {string} body
 * @returns {string}
 */
export function preProcessFences(body) {
  /** @type {string[]} */
  const out = [];
  /** @type {string | null} */
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
    const kind = marker[0] === '`' ? 'b' : 't';
    const encoded = encodeURIComponent(info.trim());
    out.push(
      `${indent}${marker}${FENCE_SENTINEL}-${kind}${marker.length}-${encoded}`
    );
  }
  return out.join('\n');
}

/**
 * Restores each fence from its sentinel: the marker kind and length the author
 * wrote, the original info string, and the indent that carries the block back
 * inside its list item.
 * @param {string} md
 * @returns {string}
 */
export function postProcessFences(md) {
  /** @type {string[]} */
  const out = [];
  /**
   * How to close and indent the fence that is open, or null outside one.
   * @type {{ marker: string, emitted: string, indent: string } | null}
   */
  let closing = null;
  for (const line of (md || '').split('\n')) {
    if (closing === null) {
      const m = line.match(SENTINEL_LINE);
      if (!m) { out.push(line); continue; }
      const [, indent, emitted, kind, length, encoded] = m;
      let info = encoded;
      try {
        info = decodeURIComponent(encoded);
      } catch {
        // invalid token: fall back to the encoded form rather than dropping it
      }
      // The exporter lengthens the marker when the content itself holds a
      // fence; never shorten below what it chose, or the block would close
      // early on its own content.
      const marker = (kind === 'b' ? '`' : '~').repeat(Math.max(Number(length), emitted.length));
      // `exportBlocks` has already placed the fence at its own indent; this
      // step only swaps the marker and the info string back under it.
      closing = { marker, emitted, indent };
      out.push(`${indent}${marker}${info}`);
      continue;
    }
    // The exporter closes with the same marker it opened with, so that is the
    // line to swap back. Everything else is the block's own content and is left
    // exactly as it stands — it already carries the indent `exportBlocks` gave
    // it, and code content must not be rewritten.
    if (line.trim() === closing.emitted) {
      out.push(closing.indent + closing.marker);
      closing = null;
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

// A block indented under a CHECKLIST item escapes it on parse, where the same
// block under a plain bullet nests correctly. BlockNote's markdown parser counts
// the item's content column including the `[ ] ` marker, so it expects a
// continuation at column 6 and treats the idiomatic column 2 as a sibling:
//
//   - [ ] todo      ->  <ul><li><input><p>todo</p></li></ul><p>note</p>
//     note              (the paragraph left the item)
//
//   - todo          ->  <ul><li><p>todo</p><p>note</p></li></ul>
//     note              (nested, as written)
//
// A nested *list* survives because a second rule admits sub-lists between the
// marker and the content column; nothing covers a paragraph, quote or table.
//
// The defect is in the dependency, so it is neutralised here instead: children
// of a checklist item are re-indented to the column the parser expects, and put
// back on the way out. Only lines that are already children are moved, so an
// item's own text and a following top-level block are untouched.
const CHECK_ITEM = /^(\s*)([-*+])(\s+)(\[[ xX]\])(\s+)/;

export function preProcessCheckItemChildren(body) {
  const lines = (body || '').split('\n');
  /** @type {string[]} */
  const out = [];
  let child = null; // { from: number, to: number } indent columns being remapped
  for (const line of lines) {
    const m = line.match(CHECK_ITEM);
    if (m) {
      const [, indent, marker, gap, box, boxGap] = m;
      child = {
        from: indent.length + marker.length + gap.length,
        to: indent.length + marker.length + gap.length + box.length + boxGap.length,
      };
      out.push(line);
      continue;
    }
    if (!child) { out.push(line); continue; }
    if (line.trim() === '') { out.push(line); continue; }
    const width = (line.match(/^\s*/) || [''])[0].length;
    // A line indented to the item's text column (or deeper) is its child; one
    // at or left of the marker ends the item.
    if (width >= child.from) {
      out.push(' '.repeat(child.to - child.from) + line);
    } else {
      child = null;
      out.push(line);
    }
  }
  return out.join('\n');
}

export function postProcessCheckItemChildren(md) {
  const lines = (md || '').split('\n');
  /** @type {string[]} */
  const out = [];
  let child = null;
  for (const line of lines) {
    const m = line.match(CHECK_ITEM);
    if (m) {
      const [, indent, marker, gap, box, boxGap] = m;
      child = {
        from: indent.length + marker.length + gap.length,
        extra: box.length + boxGap.length,
      };
      out.push(line);
      continue;
    }
    if (!child) { out.push(line); continue; }
    if (line.trim() === '') { out.push(line); continue; }
    const width = (line.match(/^\s*/) || [''])[0].length;
    if (width >= child.from + child.extra) {
      out.push(line.slice(child.extra));
    } else {
      child = null;
      out.push(line);
    }
  }
  return out.join('\n');
}

// Full pre/post pipeline (wikilink + media link + map link + fences + checklist).
const preProcess = (body) =>
  preProcessCheckItemChildren(
    preProcessFences(
      preProcessMapLinks(
        preProcessMediaLinks(preProcessWikilinks(joinListContinuations(body || '')))
      )
    )
  );
// `normalizeMarkdown` runs BEFORE this, never after: it splits a table row on
// every `|`, so a wikilink alias (`[[a/b|Alias]]`) restored first would be torn
// into two cells. While the payload is still inside its token the pipe is
// url-encoded (`%7C`) and the row is compacted correctly around it.
const postProcess = (md) =>
  postProcessCheckItemChildren(
    postProcessFences(postProcessMapLinks(postProcessMediaLinks(postProcessWikilinks(md))))
  );

// Normalizes BlockNote's output to the vault style (like Tolaria):
// - unordered lists `* ` -> `- `;
// - compact tables (trimmed cells, `---` separators), instead of the alignment
//   padding that BlockNote's exporter adds.
// All outside code fences (inside code nothing is touched).
function compactTableLine(line) {
  // The leading whitespace is what keeps a table nested inside its list item,
  // so it is preserved and only the cells are compacted.
  const indent = (line.match(/^\s*/) || [''])[0];
  let cells = line.trim().split('|');
  if (cells[0] === '') cells = cells.slice(1);
  if (cells.length && cells[cells.length - 1] === '') cells = cells.slice(0, -1);
  const isSep = cells.length > 0 && cells.every((c) => /^\s*:?-+:?\s*$/.test(c));
  if (isSep) {
    return indent + '|' + cells.map((c) => {
      const t = c.trim();
      return (t.startsWith(':') ? ':' : '') + '---' + (t.endsWith(':') ? ':' : '');
    }).join('|') + '|';
  }
  return indent + '| ' + cells.map((c) => c.trim()).join(' | ') + ' |';
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

// A block nested under a list item — a paragraph, a quote, a table, a heading —
// is exported at column zero, because BlockNote's HTML step lifts every non-list
// child out of its `<li>` and keeps the depth only in a `data-nesting-level`
// attribute the markdown step never reads. The indent is what holds the block
// INSIDE the item, so losing it does not merely rewrite the note: the block
// leaves the list. It cannot be repaired afterwards either, since a block that
// merely follows a list is indistinguishable there from one nested inside it.
//
// The block tree still knows the nesting, and each block exports correctly on
// its own — only the composition is wrong. So the export walks the tree and
// indents each child under its parent, calling the stock exporter on the parts.
// (see adr/0015-durable-markdown-round-trip.md)
const LIST_TYPES = new Set(['bulletListItem', 'numberedListItem', 'checkListItem']);
const MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;

const indentLines = (s, indent) =>
  indent ? s.split('\n').map((l) => (l ? indent + l : l)).join('\n') : s;

/**
 * Exports a block tree to markdown, preserving the indent of blocks nested
 * under a list item.
 * @param {{ blocksToMarkdownLossy: (blocks: any[]) => Promise<string> }} ed
 * @param {any[]} blocks
 * @param {string} indent
 * @returns {Promise<string>}
 */
async function exportBlocks(ed, blocks, indent = '') {
  /** @type {string[]} */
  const parts = [];
  const flatten = async (/** @type {any} */ b) =>
    (await ed.blocksToMarkdownLossy([{ ...b, children: [] }])).replace(/\n+$/, '');

  for (let i = 0; i < blocks.length; ) {
    // Separate blocks are separated by a blank line, the same way the stock
    // exporter does it — a list run counts as one block, so its items stay
    // tight against each other.
    if (parts.length) parts.push('');
    if (!LIST_TYPES.has(blocks[i].type)) {
      parts.push(indentLines(await flatten(blocks[i]), indent));
      i += 1;
      continue;
    }
    // A contiguous run of items goes through the exporter together: it counts
    // the ordinals itself, and one call per item would restart every list at 1.
    // The run stops at a change of list type — the exporter separates two
    // different lists with a blank line, which would break the one-line-per-item
    // correspondence the loop below relies on.
    /** @type {any[]} */
    const run = [];
    const runType = blocks[i].type;
    while (i < blocks.length && blocks[i].type === runType) run.push(blocks[i++]);
    const flat = (await ed.blocksToMarkdownLossy(run.map((b) => ({ ...b, children: [] }))))
      .replace(/\n+$/, '');
    const emitted = flat.split('\n');
    // The loop below pairs one emitted line with one item. If the exporter ever
    // emits a different number, pairing them would drop or duplicate content —
    // fall back to its output verbatim, losing only the nesting indent.
    if (emitted.length !== run.length) {
      parts.push(indentLines(flat, indent));
      for (const b of run) {
        for (const child of b.children || []) {
          parts.push(`\n${await exportBlocks(ed, [child], `${indent}  `)}`);
        }
      }
      continue;
    }

    for (let n = 0; n < run.length; n += 1) {
      const line = emitted[n] ?? '';
      parts.push(indent + line);
      const children = run[n].children || [];
      if (!children.length) continue;
      // Children line up with the item's TEXT column, so the indent is the
      // width of the marker actually emitted — `1. ` is three, `10. ` is four.
      const childIndent = indent + ' '.repeat((line.match(MARKER) || [''])[0].length);
      for (const child of children) {
        const sub = await exportBlocks(ed, [child], childIndent);
        // A nested list continues the item directly; any other block is a
        // separate one and needs the blank line that marks it as such.
        parts.push(LIST_TYPES.has(child.type) ? sub : `\n${sub}`);
      }
      // Once an item has carried a nested block, the item that follows starts a
      // new block too — without the blank line it would read as a continuation.
      if (n + 1 < run.length) parts.push('');
    }
  }
  return parts.join('\n');
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
  const out = await exportBlocks(editor(), extractCustomBlocks(blocks));
  return postProcess(normalizeMarkdown(out));
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
  const out = await exportBlocks(ed, extracted);
  const s = postProcess(normalizeMarkdown(out)).replace(/\s+$/, '');
  return `\n${s}\n`;
}

// Round-trip of a whole note (frontmatter preserved verbatim + body).
export async function roundTripNote(md) {
  const { frontmatter, body } = splitFrontmatter(md);
  return frontmatter + (await roundTripBody(body));
}
