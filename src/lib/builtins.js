// Built-in, vault-independent sidebar views: All notes, Inbox, Shared.
// See adr/0033-builtin-sidebar-views.md.

// A vault saved view whose id matches one of these is superseded by the built-in
// of the same name, so it is dropped from the vault's own view list (no duplicate).
export const RESERVED_VIEW_IDS = ['all-notes', 'inbox', 'shared'];

// Organized iff frontmatter `_organized` is true; absent or false means the note
// is still in the inbox. (Tolaria only ever writes `_organized: true`; the value
// can arrive as a YAML boolean or, defensively, as the string "true".)
export function isOrganized(note) {
  const v = note.frontmatter?._organized;
  return v === true || v === 'true';
}

export function isInboxNote(note) {
  return !isOrganized(note);
}

export function isSharedNote(note) {
  const v = note.frontmatter?.share_id;
  return v != null && String(v).trim() !== '';
}
