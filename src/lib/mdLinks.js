// Markdown link helpers, WITHOUT depending on BlockNote (so this can be used in
// the main bundle without pulling in the heavy editor).

export const MEDIA_EXT = /\.(mp4|webm|ogv|mov|m4v|mp3|wav|ogg|oga|m4a|aac|flac|pdf|log|zip|rar|7z|gz|docx?|xlsx?|pptx?|csv|json|ya?ml)(\?[^)]*)?$/i;
export const MD_LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)\)/g;

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
