import { headingSlug } from './headingSlug.js';

const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// Splits a wikilink target into the note half and the heading anchor half, and
// resolves the note half through `titleIndex` exactly as an anchorless target is
// resolved — the anchor is carried through unresolved: never validated, never
// checked against the target note's headings. An anchor matching nothing simply
// opens the note at its top, which is the settled behaviour for any such anchor.
// See adr/0044-what-the-url-addresses.md (criterion 15).
//
// The anchor half is put through `headingSlug`, so BOTH the slug and the
// heading TEXT are accepted: `[[nota#My Heading]]` is what Obsidian's own link
// picker inserts, and a vault written there is the common case. This cannot
// regress a target that already carries a slug, because the function is
// idempotent over its own output. It does not disambiguate duplicate headings —
// `headingSlug` has no document to count against — so a target naming one of two
// same-named headings reaches the first; `#note-1` written out still works.
//
// The WHOLE target is looked up first, and only on a miss is it split at the
// LAST `#`. A note id may legitimately contain a `#` — a vault file named
// `C# tips.md` is exactly the case src/lib/headingSlug.js names — so splitting
// eagerly would break links that resolve today. `[[C# tips]]` therefore resolves
// on the first attempt, `[[C# tips#heading]]` on the second.
//
// Imported by both the client bundle and the Node build scripts, so the app and
// the share pages split a target the same way.
export function resolveTargetAnchor(target, titleIndex) {
  const full = String(target).trim();
  const direct = titleIndex[full.toLowerCase()];
  if (direct) return { id: direct, anchor: null };
  const i = full.lastIndexOf('#');
  if (i <= 0) return { id: null, anchor: null };
  const note = full.slice(0, i).trim();
  const anchor = headingSlug(full.slice(i + 1).trim());
  if (!anchor) return { id: null, anchor: null };
  return { id: titleIndex[note.toLowerCase()] || null, anchor };
}

// Extracts wikilink targets from a frontmatter value (string or list).
export function wikilinkTargets(value, titleIndex, idTitle = {}) {
  const arr = Array.isArray(value) ? value : [value];
  const out = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    let m;
    WIKILINK.lastIndex = 0;
    while ((m = WIKILINK.exec(v))) {
      const target = m[1].trim();
      const { id, anchor } = resolveTargetAnchor(target, titleIndex);
      out.push({ text: (m[2] || (id && idTitle[id]) || target).trim(), id, anchor });
    }
  }
  return out;
}
