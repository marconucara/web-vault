// Composing the commit payloads for type management (adr/0045).
//
// Everything here is pure: it turns a panel form plus the live note set into the
// `files` array `lib/commit.js` posts, so the interesting rules — what a rename
// touches, where a document is allowed to move, which notes get rewritten — are
// testable without a vault or a network.
import { slugify, uniquePath } from './noteFile.js';
import { sameTypeName, contentOnly } from './types.js';

/**
 * One entry of the commit endpoint's `files` array. Every field is optional
 * because each operation uses its own subset (adr/0019, adr/0045).
 * @typedef {{
 *   path: string,
 *   content?: string,
 *   isNew?: boolean,
 *   delete?: boolean,
 *   body?: string,
 *   h1?: string,
 *   frontmatter?: Record<string, string | number | null>,
 *   retype?: { from: string, to: string },
 * }} CommitFile
 */

// A Type document as the app writes it. `_organized: true` is Tolaria's marker
// for a document the tooling owns; the H1 carries the name, the body carries the
// description, and the presentation keys carry the rest (criterion 4).
export function typeDocContent({ name, description = '', icon = null, color = null, order = null }) {
  const fm = ['type: Type'];
  if (icon) fm.push(`icon: ${icon}`);
  if (color) fm.push(`color: ${color}`);
  if (order != null && order !== '') fm.push(`order: ${order}`);
  fm.push('_organized: true');
  const body = description.trim();
  return `---\n${fm.join('\n')}\n---\n\n# ${name}\n${body ? `\n${body}\n` : ''}`;
}

// The path for a NEW Type document: kebab-case of the name, at the vault root,
// unique against what is already there (criterion 4). Creation follows the same
// rule as note creation — the owner moves it afterwards if they want to.
export function newTypePath(name, takenPaths) {
  const base = slugify(name) || 'type';
  return uniquePath(base, takenPaths);
}

// Where a RENAMED document should live: the kebab-case of the new name, inside
// the directory the document already occupies (criterion 7). A document the
// owner moved out of the vault root stays where they put it.
export function renamedTypePath(currentPath, newName, takenPaths) {
  const dir = currentPath.includes('/') ? currentPath.slice(0, currentPath.lastIndexOf('/') + 1) : '';
  const base = slugify(newName) || 'type';
  const taken = new Set([...takenPaths].filter((p) => p !== currentPath));
  const rel = uniquePath(base, new Set([...taken].map((p) => (p.startsWith(dir) ? p.slice(dir.length) : p))));
  return `${dir}${rel}`;
}

// Files for creating a type. Also covers adopting a type the notes already carry
// with no document behind it: the notes are untouched, they simply gain a
// declaration (criteria 5, 8).
export function filesForCreate(form, takenPaths) {
  const path = newTypePath(form.name, takenPaths);
  /** @type {CommitFile[]} */
  const files = [{ path, content: typeDocContent(form), isNew: true }];
  return { path, files };
}

// Files for editing an existing type.
//
// Without a rename this is a line-level frontmatter update plus the H1 and the
// body, leaving every key the panel does not own untouched (criterion 6).
//
// With a rename it is, in ONE commit (criterion 7): the old document removed,
// the new one written at the renamed path, and `type:` rewritten in every note
// carrying the old name. The rename goes through delete+create because the
// commit path has no rename primitive (adr/0019).
export function filesForEdit({ form, doc, notes, takenPaths }) {
  const renaming = !sameTypeName(form.name, doc.name);
  /** @type {CommitFile[]} */
  const files = [];
  const carriers = renaming
    ? contentOnly(notes).filter((n) => sameTypeName(n.type, doc.name))
    : [];

  if (!renaming) {
    files.push({
      path: doc.path,
      frontmatter: { icon: form.icon || null, color: form.color || null, order: form.order ?? null },
      h1: form.name,
      body: typeDocBody(doc, form),
    });
    return { path: doc.path, files, carriers };
  }

  const path = renamedTypePath(doc.path, form.name, takenPaths);
  if (path !== doc.path) {
    // Delete + create in the same tree: one commit, no intermediate state.
    files.push({ path: doc.path, delete: true });
    files.push({ path, content: typeDocContent({ ...form, description: form.description }), isNew: true });
  } else {
    files.push({
      path: doc.path,
      frontmatter: { icon: form.icon || null, color: form.color || null, order: form.order ?? null },
      h1: form.name,
      body: typeDocBody(doc, form),
    });
  }
  for (const n of carriers) {
    files.push({ path: n.path, retype: { from: doc.name, to: form.name } });
  }
  return { path, files, carriers };
}

// The document's body for an in-place edit: the H1 followed by the description.
// The panel owns the whole body of a Type document — its only content is the
// name and the description — so rewriting it loses nothing.
function typeDocBody(doc, form) {
  const body = (form.description || '').trim();
  return `\n# ${form.name}\n${body ? `\n${body}\n` : ''}`;
}

// Files for deleting a type. The caller must have checked that no note carries
// it: delete is blocked while any does, and notes are never reassigned
// (criteria 9, 10).
export function filesForDelete(doc) {
  /** @type {CommitFile[]} */
  const files = [{ path: doc.path, delete: true }];
  return { files };
}

// The commit message for each action, in the same voice as the rest of the app
// ("Delete note: <title>", "Publish <title>"). A rename names both sides and the
// notes it carried along, since that is the one action that touches other files.
export function messageFor(action, name, { to = null, carriers = 0 } = {}) {
  if (action === 'create') return `Create type: ${name}`;
  if (action === 'delete') return `Delete type: ${name}`;
  if (action === 'rename') {
    const tail = carriers ? ` (${carriers} ${carriers === 1 ? 'note' : 'notes'})` : '';
    return `Rename type ${name} to ${to}${tail}`;
  }
  return `Update type: ${name}`;
}
