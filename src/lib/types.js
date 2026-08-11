// Deriving the vault's types from a set of notes (adr/0045-manage-types-from-the-ui.md).
//
// A type is not a first-class object: it is an ordinary note carrying
// `type: Type`, whose H1 is the type's name and whose frontmatter holds the
// presentation metadata. Notes join a type by repeating that name in their own
// `type:` frontmatter, and nothing else binds the two — the Type document's
// filename plays no part in resolution.
//
// The list is therefore the UNION of two independent sources: the types a Type
// document DECLARES, and the types the notes actually USE. Deriving from usage
// alone (as `content.js` did) makes a freshly created type invisible until a
// note joins it; deriving from declaration alone would drop the hand-written
// `type:` that no document backs. Both stay first-class.
//
// Everything here is a pure function of a note array, so it composes with the
// build-time content AND the app's optimistic overlay of locally changed notes
// — which is what lets a create/rename/delete show up before the next build.

export const TYPE_DOC = 'Type';

// A note is a Type document when its own `type:` is `Type`.
export function isTypeDoc(note) {
  return note?.type === TYPE_DOC;
}

// Presentation metadata for one Type document. `icon`/`color`/`order` are also
// accepted under a leading underscore: that is Tolaria's convention for keys the
// app owns, and real vaults carry both spellings. The panel always writes the
// un-prefixed form.
//
// `visible` is the exception: NO underscore alias (adr/0046, criterion 2).
// Tolaria writes and reads only the bare spelling — verified by toggling it from
// its own UI — so honouring `_visible` would hide a type here that stays visible
// there, off a key Tolaria never wrote.
export function typeDocMeta(note) {
  const fm = note?.frontmatter || {};
  const order = fm.order ?? fm._order;
  const n = typeof order === 'string' ? Number(order) : order;
  return {
    icon: fm.icon || fm._icon || null,
    color: fm.color || fm._color || null,
    // Only a finite number orders anything; anything else sorts as "no order".
    order: typeof n === 'number' && Number.isFinite(n) ? n : null,
    visible: isVisibleFrontmatter(fm),
    path: note?.path ?? null,
  };
}

// Only `false` hides. The key absent, `true`, or anything else means visible
// (adr/0046, criterion 3): absence is the default, so a vault that never carried
// the key reads exactly as it did before. The string `'false'` counts too — YAML
// quoted by hand, or a value that survived a round-trip as text.
export function isVisibleFrontmatter(fm) {
  const v = fm?.visible;
  return !(v === false || v === 'false');
}

// Metadata per declared type name. A Type document with no H1 declares nothing
// (`title` is the H1) and is skipped silently, so no empty-named type can reach
// the sidebar. Two documents whose names differ only in case declare the SAME
// type — the panel refuses to create the second — so the first one wins, keyed
// by lowercased name and carrying the spelling it declared.
export function declaredTypes(notes) {
  const out = new Map(); // lowercased name -> { name, ...meta }
  for (const n of notes) {
    if (!isTypeDoc(n)) continue;
    const name = (n.title || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (out.has(key)) continue;
    out.set(key, { name, ...typeDocMeta(n) });
  }
  return out;
}

// The names notes actually carry, Type documents excluded, one entry per type
// REGARDLESS OF CASE: `note`, `Note` and `NOTE` are one type, not three.
//
// Vaults accumulate these — a note typed by hand, one written by an agent, one
// copied from elsewhere — and matching them exactly produced a sidebar row each,
// splitting a type's notes across rows that all looked the same. Nothing else in
// the app distinguishes them either: `typeNameTaken` already refused to create a
// second document for a name differing only in case, so an exact-match
// derivation contradicted it.
//
// The display form is chosen per group by `canonicalName`; the notes' own files
// are never rewritten — this is a reading rule, not a migration.
export function usedTypes(notes) {
  const groups = new Map(); // lowercased name -> [names as written]
  for (const n of notes) {
    if (isTypeDoc(n)) continue;
    const t = (n.type || '').trim();
    if (!t) continue;
    const key = t.toLowerCase();
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  return groups;
}

// Title case for a type label: each word capitalised, the rest lowered, so
// `note`, `NOTE` and `nOtE` all read as `Note`. Only the letters' case changes —
// separators, digits and punctuation are left exactly as written, since a name
// like `to-do` must not lose its hyphen on the way to the sidebar.
export function titleCase(name) {
  return (name || '')
    .trim()
    .replace(/\p{L}[\p{L}\p{M}\p{Nd}'’]*/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// Which spelling of a type to show. A Type document settles it — its H1 IS the
// type's name, and that is the spelling the vault declared, kept verbatim
// however it is capitalised.
//
// With no document there is no declared spelling, only however each note
// happened to write it. Picking one of those (the most frequent, say) makes the
// label depend on the notes' accidents and shift as they change; a type carried
// only by `note` and `NOTE` would show one of those rather than a name. So the
// label is derived instead: title case, the form a type name takes. The notes
// keep what their files say — this only decides what the sidebar reads.
export function canonicalName(spellings, declaredName = null) {
  if (declaredName) return declaredName;
  return titleCase([...spellings][0] || '');
}

// Ordered type names: `order:` ascending where present, before the types without
// one; ties and the remainder alphabetically. Honouring `order:` changes the
// sidebar's order in vaults that until now saw the alphabetical one — an
// accepted consequence, since the key was always written and always ignored.
export function orderTypes(names, meta) {
  return [...names].sort((a, b) => {
    const oa = meta[a]?.order ?? null;
    const ob = meta[b]?.order ?? null;
    if (oa !== ob) {
      if (oa === null) return 1;
      if (ob === null) return -1;
      return oa - ob;
    }
    return a.localeCompare(b);
  });
}

// The whole derivation in one pass over the live notes.
//
//   names        — ordered union of declared and used: EVERY type, hidden ones
//                  included, which is what the visibility manager lists
//   visibleNames — the same order, minus the types hidden by `visible: false`;
//                  what the sidebar renders (adr/0046, criterion 1)
//   meta         — presentation metadata by name (declared types only)
//   declared     — Set of names an actual Type document backs
//
// The hidden ones are filtered OUT OF A SECOND LIST rather than dropped here,
// because a hidden type is not gone: the manager shows it with its icon and
// colour, and toggling it back on has to find it. `meta` therefore carries every
// type either way.
//
// A name in `names` but not in `declared` is a type the notes use with no
// document behind it: it renders with default presentation, and creating it
// from the panel gives it a document rather than colliding with it.
export function deriveTypes(notes) {
  const declaredMap = declaredTypes(notes);
  const usedMap = usedTypes(notes);
  // One entry per type, keyed case-insensitively, so a declared `Note` and a
  // used `note` meet as one rather than becoming two rows.
  const meta = {};
  const declared = new Set();
  for (const [key, decl] of declaredMap) {
    meta[decl.name] = {
      icon: decl.icon,
      color: decl.color,
      order: decl.order,
      visible: decl.visible,
      path: decl.path,
    };
    declared.add(decl.name);
  }
  for (const [key, spellings] of usedMap) {
    if (declaredMap.has(key)) continue; // the document already named it
    const name = canonicalName(spellings);
    // No document, so nothing declares it hidden: a type the notes carry is
    // always visible until a toggle gives it a document to say otherwise.
    if (!meta[name]) meta[name] = { icon: null, color: null, order: null, visible: true, path: null };
  }
  const names = orderTypes(new Set(Object.keys(meta)), meta);
  return { names, visibleNames: names.filter((n) => meta[n]?.visible !== false), meta, declared };
}

// Notes that are not Type documents: what every list and view shows.
export function contentOnly(notes) {
  return notes.filter((n) => !isTypeDoc(n));
}

// Name comparison for uniqueness: case-insensitive, surrounding whitespace
// ignored. Without this, "Project" and "project " would each get a document
// while the sidebar shows one type, and which one supplies the metadata would
// be undefined.
export function sameTypeName(a, b) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

// Whether `name` may be used for a NEW Type document. The test is against
// DECLARED types only: a name the notes already carry with no document behind it
// is accepted, and creating it gives that in-use type its document — the point
// of the action, not a collision. `exclude` is the name being edited, so saving
// a type under its own name is not a collision with itself.
export function typeNameTaken(name, declared, exclude = null) {
  if (exclude && sameTypeName(name, exclude)) return false;
  for (const d of declared) if (sameTypeName(name, d)) return true;
  return false;
}

// How many notes carry a type — what gates delete, and what the sidebar counts.
export function countNotesOfType(notes, name) {
  return contentOnly(notes).filter((n) => sameTypeName(n.type, name)).length;
}
