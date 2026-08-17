// Markdown link helpers, WITHOUT depending on BlockNote (so this can be used in
// the main bundle without pulling in the heavy editor).

export const MEDIA_EXT = /\.(mp4|webm|ogv|mov|m4v|mp3|wav|ogg|oga|m4a|aac|flac|pdf|log|zip|rar|7z|gz|docx?|xlsx?|pptx?|csv|json|ya?ml)(\?[^)]*)?$/i;
// The link text excludes newlines: a markdown link's text and destination are on
// one line in practice, and allowing the class to cross lines lets an unmatched
// `[` run away to the next `](…)` anywhere later in the note, swallowing whole
// blocks into one match.
export const MD_LINK = /(!?)\[([^\]\n]*)\]\(([^)\s]+)\)/g;

// Google Maps links, in all the common forms:
//   maps.app.goo.gl/…, goo.gl/maps/…, google.<tld>/maps…, maps.google.<tld>/…
// Kept here (dependency-free module) so the Node build script can import the
// exact same matcher used by the client.
export const MAPS_URL = /https?:\/\/(?:maps\.app\.goo\.gl\/[^\s)]+|goo\.gl\/maps\/[^\s)]+|(?:www\.)?google\.[a-z.]{2,}\/maps[^\s)]*|maps\.google\.[a-z.]{2,}\/[^\s)]*)/i;
const MAPS_URL_ANCHORED = new RegExp(`^(?:${MAPS_URL.source})$`, 'i');

// Parse a "map card line": an optional list marker (`-`/`*`/`+` or `N.`/`N)`),
// then a Google Maps link (bare, <url>, or [title](url)), then optional trailing
// text used as a short description. Returns { marker, num, url, label, desc } or
// null. `marker` is 'ordered' | 'unordered' | null (null = plain paragraph).
// This is how a place preview is triggered: the link must START the line (after
// an optional bullet), so links buried mid-prose are NOT matched.
export function parseMapCardLine(line) {
  let s = String(line).replace(/\s+$/, '');
  let marker = null;
  let num = null;
  let m;
  if ((m = s.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
    marker = 'ordered';
    num = Number(m[1]);
    s = m[2];
  } else if ((m = s.match(/^\s*[-*+]\s+(.*)$/))) {
    marker = 'unordered';
    s = m[1];
  } else {
    s = s.trim();
  }
  let url = null;
  let label = null;
  let desc = '';
  if ((m = s.match(/^\[([^\]]*)\]\(\s*([^)\s]+)\s*\)\s*(.*)$/))) {
    label = m[1];
    url = m[2];
    desc = m[3];
  } else if ((m = s.match(/^<([^>\s]+)>\s*(.*)$/))) {
    url = m[1];
    desc = m[2];
  } else if ((m = s.match(/^(\S+)\s*(.*)$/))) {
    url = m[1];
    desc = m[2];
  }
  if (!url || !MAPS_URL_ANCHORED.test(url)) return null;
  return { marker, num, url, label: label || null, desc: desc.trim() };
}

// What a place card is CALLED and what it SAYS, from the parsed line and the
// build-resolved place (adr/0049-*.md). Both are the author's to write and
// neither depends on what the build managed to resolve:
//
//   title = the link's own text, else the resolved place name, else the URL
//   note  = the text after the link, and nothing else
//
// The conditional this replaces (`desc || (info.title ? label : null)`) made the
// link text mean "title" or "description" depending on whether a build-time
// fetch succeeded, so an author could never write both — and a 429 silently
// renamed their places. Shared by the body card and the map popup so a place is
// named identically on both surfaces.
export function placeText(parsed, info = {}) {
  const label = parsed?.label || null;
  return {
    title: label || info.title || parsed?.url || 'Google Maps',
    note: parsed?.desc || null,
  };
}

// Rebuild a map card line from its parts, preserving the list marker/number.
// Inverse of `parseMapCardLine` for the fields the in-place editor can write.
// The brackets appear only with a title, the trailing text only with a
// description — so clearing the title yields a bare link, which is exactly the
// "no override" the card falls back from.
/**
 * @param {{ marker?: string|null, num?: number|null, url: string,
 *           title?: string|null, desc?: string|null }} parts
 */
export function buildMapCardLine({ marker, num, url, title, desc }) {
  const prefix = marker === 'ordered' ? `${num || 1}. ` : marker === 'unordered' ? '- ' : '';
  const t = (title || '').trim();
  const d = (desc || '').trim();
  const link = t ? `[${t}](${url})` : url;
  return prefix + link + (d ? ` ${d}` : '');
}

// The ⟬…⟭ token payload: a map card line, percent-encoded so it survives the
// trip through BlockNote as text rather than as markdown.
//
// The encoding is NOT relied on to keep the payload in a single span. It cannot:
// `encodeURIComponent` leaves most markdown punctuation untouched — `*`, `_`,
// `~`, `!`, `[` are all unreserved URI characters — so a description carrying
// emphasis reaches the parser with its markers intact and comes back split
// across several styled spans. Escaping each of those characters in turn would
// be a list to keep in sync with a markdown dialect. The block-level side reads
// the paragraph's whole text instead (`paragraphSoleText`), which makes the
// split irrelevant, and this stays a plain percent-encoding whose only job is
// keeping the line's own delimiters out of the token.
export function encodeMapToken(line) {
  return encodeURIComponent(line);
}

export function decodeMapToken(token) {
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

// The Google Maps URL in a map card line, or null. Used at build time to collect
// the links that need resolving.
export function mapUrlInLine(line) {
  const parsed = parseMapCardLine(line);
  return parsed ? parsed.url : null;
}

// Marker color palette, used to tell lists apart. Group 0 = paragraphs (and any
// non-list map link); each list (ordered or unordered) gets the next color.
export const MARKER_PALETTE = [
  '#d9534f', // red
  '#3b82f6', // blue
  '#22a06b', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#0ea5e9', // sky
  '#ec4899', // pink
  '#14b8a6', // teal
];
export function markerColor(group) {
  const g = Number.isFinite(group) ? group : 0;
  return MARKER_PALETTE[((g % MARKER_PALETTE.length) + MARKER_PALETTE.length) % MARKER_PALETTE.length];
}

// A stateful line classifier that assigns each line a "map group": 0 for
// paragraphs / non-list lines, and 1, 2, 3… for each distinct contiguous list
// (ordered or unordered). Blank lines are transparent (kept inside a loose
// list). Used identically by the body pre-processor and the map view so both
// color markers the same way. Call it on EVERY non-fenced line, in order.
export function createMapGrouper() {
  let listCount = 0;
  let current = 0;
  let prevWasListItem = false;
  return (line) => {
    if (/^\s*$/.test(line)) return null; // blank: no change
    if (/^\s*(?:[-*+]|\d+[.)])\s/.test(line)) {
      if (!prevWasListItem) {
        listCount += 1;
        current = listCount;
      }
      prevWasListItem = true;
      return current;
    }
    prevWasListItem = false;
    return 0; // paragraph or other non-list line
  };
}

// Maps a raw group id (0 = paragraphs, 1.. = each list) to a palette color index
// assigned in ORDER OF FIRST APPEARANCE among actual map links. So the first
// group that has a map link gets the first color: if there are no paragraph map
// links, the first list gets the first palette color (red) instead of wasting it
// on the (empty) paragraph group. Call it only for lines that are map links.
export function createColorAssigner() {
  const seen = new Map();
  let next = 0;
  return (rawGroup) => {
    const g = Number.isFinite(rawGroup) ? rawGroup : 0;
    if (!seen.has(g)) seen.set(g, next++);
    return seen.get(g);
  };
}

// True if the body contains (non-image) links to media/files or attachments,
// which BlockNote loses on round-trip: for these notes we use the raw editor.
export function bodyHasUnsafeForBlockNote(body) {
  if (!body) return false;
  MD_LINK.lastIndex = 0;
  let m;
  while ((m = MD_LINK.exec(body))) {
    const [, bang, , url] = m;
    if (!bang && (MEDIA_EXT.test(url) || url.includes('attachments/'))) return true;
  }
  return false;
}
