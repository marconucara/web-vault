// Helpers to turn a draft note into a real vault file at commit time:
// - the title is the first H1 of the body (Tolaria convention);
// - the filename is the kebab-case of the title, in the vault ROOT (Marco moves
//   it into the right folder later, by preference);
// - if there is no title yet, fall back to Tolaria's `untitled-<type>-<epoch>`.

export function deriveTitle(body) {
  const m = (body || '').match(/^#[ \t]+(.+?)[ \t]*$/m);
  return m ? m[1].trim() : '';
}

// Accent-stripped, lowercase, kebab-case. Returns '' if nothing usable remains.
export function slugify(s) {
  return (s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// A root-level `<base>.md` unique against the already-taken paths, appending
// `-2`, `-3`, … on collision.
export function uniquePath(base, taken) {
  let candidate = `${base}.md`;
  let i = 2;
  while (taken.has(candidate)) candidate = `${base}-${i++}.md`;
  return candidate;
}

// Filename (vault-root path) for a draft, unique against `taken`.
export function draftPath(draft, taken) {
  const slug = slugify(deriveTitle(draft.body));
  const base =
    slug || `untitled-${(draft.type || 'note').toLowerCase()}-${draft.createdSec || Math.floor(Date.now() / 1000)}`;
  return uniquePath(base, taken);
}

// Full file content for a new note: `type` frontmatter (if any) + body. The body
// is normalized to start right after the frontmatter (one blank line), matching
// the vault's existing notes.
export function draftFileContent(draft) {
  const body = (draft.body || '').replace(/^\n+/, '');
  if (draft.type) return `---\ntype: ${draft.type}\n---\n\n${body}`;
  return body;
}
