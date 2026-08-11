// The anchor slug for a heading, and the grammar that carries one in the URL.
//
// This is a compatibility surface: the moment a vault author writes
// `[jump](#drop-a-place-on-the-map)` in a note, changing the rule breaks links
// living in the user's own content, which this product cannot migrate. So the
// rule is the GitHub one the surrounding ecosystem already uses, via
// `github-slugger` — not whatever a renderer happens to emit. See
// adr/0044-what-the-url-addresses.md.
//
// Two surfaces render note bodies through completely different pipelines —
// BlockNote in the app (always editable) and react-markdown on the share pages
// — and both import this module, so the same heading text yields the same
// anchor on each.

import GithubSlugger from 'github-slugger';

// Slugs for a note's headings, in document order. One slugger instance per
// note, which is what gives duplicate headings their stable `-1`, `-2`, …
// suffixes: the counter is per-document, so an anchor never silently points at
// the wrong one of two same-named sections.
export function slugsForHeadings(texts) {
  const slugger = new GithubSlugger();
  return texts.map((t) => slugger.slug(String(t ?? '')));
}

// The slug for a single heading, ignoring duplicates. Only for callers that
// have one heading and no document to disambiguate against — prefer
// `slugsForHeadings` wherever the whole note is in hand.
export function headingSlug(text) {
  return new GithubSlugger().slug(String(text ?? ''));
}

// `#/n/<encodeURIComponent(id)>` optionally followed by `#<slug>`.
//
// Splitting on `#` is only safe because the id is percent-encoded: a note id is
// its vault-relative path minus `.md`, so a file named `C# tips.md` really does
// carry a `#`, and `encodeURIComponent` turns it into `%23`. The FIRST `#`
// after the route prefix therefore always starts the anchor, never the id.
const ROUTE = /^#\/n\/([^#]+)(?:#(.*))?$/;

// Parses a location hash into the note it addresses and the position within it.
// Anything that is not a note route reads as "no note open", as before.
export function parseNoteHash(hash) {
  const m = String(hash || '').match(ROUTE);
  if (!m) return { id: null, anchor: null };
  return {
    id: decodeURIComponent(m[1]),
    anchor: m[2] ? decodeURIComponent(m[2]) : null,
  };
}

// The hash addressing a note, or a heading within it.
export function noteHash(id, anchor = null) {
  const base = `#/n/${encodeURIComponent(id)}`;
  return anchor ? `${base}#${anchor}` : base;
}

// Whether `href` is a bare in-document anchor (`#some-heading`) as an author
// writes it, rather than an app route (`#/n/…`, `#/`) or an external link.
//
// A bare anchor cannot be assigned to `window.location.hash` as-is: it would
// replace the whole hash, so the note id is lost and the note closes. It is
// rewritten against the open note before being followed.
export function isBareAnchor(href) {
  const s = String(href || '');
  return s.startsWith('#') && !s.startsWith('#/') && s.length > 1;
}

// The anchor an author wrote, as it appears in an href. `#a%20b` is decoded, so
// the slug compared against a heading id is the real one.
export function anchorOf(href) {
  if (!isBareAnchor(href)) return null;
  const raw = String(href).slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    // A malformed escape is not a reason to lose the link; take it verbatim.
    return raw;
  }
}
