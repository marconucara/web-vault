import { describe, expect, it } from 'vitest';
import {
  filesForCreate,
  filesForDelete,
  filesForEdit,
  filesForVisibility,
  messageFor,
  newTypePath,
  renamedTypePath,
  typeDocContent,
} from './typeCommit.js';

const note = (title, type, path = `${title.toLowerCase()}.md`) => ({
  id: path.replace(/\.md$/, ''),
  path,
  title,
  type,
  frontmatter: { type },
});

describe('Type document content (ADR 0045, criterion 4)', () => {
  it('writes type, presentation keys, the Tolaria marker, the H1 and the description', () => {
    const out = typeDocContent({
      name: 'Person',
      description: 'People I know.',
      icon: 'user',
      color: 'blue',
      order: 2,
    });
    expect(out).toBe(
      '---\ntype: Type\nicon: user\ncolor: blue\norder: 2\n_organized: true\n---\n\n# Person\n\nPeople I know.\n'
    );
  });

  it('omits the keys with no value rather than writing them empty', () => {
    const out = typeDocContent({ name: 'Person' });
    expect(out).toBe('---\ntype: Type\n_organized: true\n---\n\n# Person\n');
    expect(out).not.toContain('icon:');
    expect(out).not.toContain('order:');
  });
});

describe('paths (ADR 0045, criteria 4 and 7)', () => {
  it('creates at the vault root, kebab-cased and unique on collision', () => {
    expect(newTypePath('Person', new Set())).toBe('person.md');
    expect(newTypePath('Città Natale', new Set())).toBe('citta-natale.md');
    expect(newTypePath('Person', new Set(['person.md']))).toBe('person-2.md');
  });

  it('renames inside the directory the document already lives in', () => {
    // Criterion 7: a document the owner moved out of the root stays where it is.
    expect(renamedTypePath('meta/types/person.md', 'Human', new Set())).toBe('meta/types/human.md');
    expect(renamedTypePath('person.md', 'Human', new Set())).toBe('human.md');
  });

  it('does not collide with the document being renamed itself', () => {
    // Its own current path must not push the new name to `-2`.
    expect(renamedTypePath('person.md', 'Person Two', new Set(['person.md']))).toBe('person-two.md');
  });
});

describe('editing and renaming (ADR 0045, criteria 6 and 7)', () => {
  const doc = { name: 'Person', path: 'person.md' };
  const notes = [
    note('Ada', 'Person'),
    note('Grace', 'Person'),
    note('Rome', 'Place'),
    { id: 'person-type', path: 'person.md', title: 'Person', type: 'Type', frontmatter: {} },
  ];

  it('edits in place with a line-level frontmatter update, touching one file', () => {
    const { files } = filesForEdit({
      form: { name: 'Person', description: 'Updated.', icon: 'users', color: 'red', order: 1 },
      doc,
      notes,
      takenPaths: new Set(['person.md']),
    });
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('person.md');
    // Criterion 6: keys are set line-level, never a whole re-serialized block.
    expect(files[0].frontmatter).toEqual({ icon: 'users', color: 'red', order: 1 });
    expect(files[0].h1).toBe('Person');
    expect(files[0].content).toBeUndefined();
  });

  it('clears a key the form emptied instead of leaving the old value', () => {
    const { files } = filesForEdit({
      form: { name: 'Person', description: '', icon: '', color: null, order: null },
      doc,
      notes,
      takenPaths: new Set(['person.md']),
    });
    expect(files[0].frontmatter).toEqual({ icon: null, color: null, order: null });
  });

  it('renames the document and every note carrying the type, in one commit', () => {
    const { files, carriers, path } = filesForEdit({
      form: { name: 'Human', description: 'People.', icon: 'user' },
      doc,
      notes,
      takenPaths: new Set(['person.md', 'ada.md', 'grace.md', 'rome.md']),
    });
    expect(path).toBe('human.md');
    // Criterion 7: old removed + new written + `type:` rewritten in the carriers.
    expect(files).toContainEqual({ path: 'person.md', delete: true });
    expect(files.find((f) => f.path === 'human.md')?.isNew).toBe(true);
    expect(carriers.map((c) => c.title)).toEqual(['Ada', 'Grace']);
    expect(files).toContainEqual({ path: 'ada.md', retype: { from: 'Person', to: 'Human' } });
    expect(files).toContainEqual({ path: 'grace.md', retype: { from: 'Person', to: 'Human' } });
    // A note of another type is never touched.
    expect(files.some((f) => f.path === 'rome.md')).toBe(false);
  });

  it('does not rewrite the notes when the title-cased label is saved back', () => {
    // The sidebar labels an undeclared type in title case, so the panel prefills
    // `Note` while the notes carry `note`. Saving that must NOT be read as a
    // rename: adopting a type gives it a document, it does not touch the notes.
    const carriers = [note('A', 'note', 'a.md'), note('B', 'NOTE', 'b.md')];
    const { files } = filesForEdit({
      form: { name: 'Note', description: '', icon: 'file-text' },
      doc: { name: 'note', path: 'note.md' },
      notes: carriers,
      takenPaths: new Set(['note.md', 'a.md', 'b.md']),
    });
    expect(files.some((f) => f.retype)).toBe(false);
    expect(files.some((f) => f.delete)).toBe(false);
  });

  it('treats a case-only rename as an edit of the same document', () => {
    // 'person' vs 'Person' is the same type, so nothing is deleted or recreated.
    const { files } = filesForEdit({
      form: { name: 'person', description: '', icon: 'user' },
      doc,
      notes,
      takenPaths: new Set(['person.md']),
    });
    expect(files.some((f) => f.delete)).toBe(false);
  });
});

describe('create and delete (ADR 0045, criteria 4, 5, 10)', () => {
  it('creates a document without touching any note', () => {
    const { files, path } = filesForCreate(
      { name: 'Recipe', description: 'Things I cook.', icon: 'book' },
      new Set(['person.md'])
    );
    expect(path).toBe('recipe.md');
    expect(files).toHaveLength(1);
    expect(files[0].isNew).toBe(true);
    expect(files[0].content).toContain('# Recipe');
  });

  it('deletes only the Type document', () => {
    const { files } = filesForDelete({ name: 'Recipe', path: 'recipe.md' });
    // Criterion 9: notes are never reassigned, so nothing else is in the commit.
    expect(files).toEqual([{ path: 'recipe.md', delete: true }]);
  });
});

describe('commit messages', () => {
  it('names the action and, for a rename, both sides and the notes carried', () => {
    expect(messageFor('create', 'Recipe')).toBe('Create type: Recipe');
    expect(messageFor('delete', 'Recipe')).toBe('Delete type: Recipe');
    expect(messageFor('update', 'Person')).toBe('Update type: Person');
    expect(messageFor('rename', 'Person', { to: 'Human', carriers: 2 })).toBe(
      'Rename type Person to Human (2 notes)'
    );
    expect(messageFor('rename', 'Person', { to: 'Human', carriers: 1 })).toBe(
      'Rename type Person to Human (1 note)'
    );
  });
});

describe('Type visibility payloads (ADR 0046, criteria 6-7)', () => {
  it('hides by writing visible: false', () => {
    const { files } = filesForVisibility({ path: 'type.md', visible: false });
    expect(files).toEqual([{ path: 'type.md', frontmatter: { visible: false } }]);
  });

  it('shows by REMOVING the key, not by writing visible: true', () => {
    // null is the commit endpoint's removal signal (adr/0022). Writing
    // `visible: true` would litter every file a reader ever toggled.
    const { files } = filesForVisibility({ path: 'type.md', visible: true });
    expect(files).toEqual([{ path: 'type.md', frontmatter: { visible: null } }]);
  });

  it('does not touch the H1 or the body', () => {
    // The distinction from filesForEdit, which owns both. A toggle owns one key,
    // so a hand-written description must come back untouched.
    for (const visible of [true, false]) {
      const [file] = filesForVisibility({ path: 'type.md', visible }).files;
      expect(file).not.toHaveProperty('h1');
      expect(file).not.toHaveProperty('body');
      expect(file).not.toHaveProperty('content');
      expect(Object.keys(file.frontmatter)).toEqual(['visible']);
    }
  });

  it('writes visible: false into a document created for a hidden type', () => {
    // Adoption: toggling a type only the notes carry creates its document.
    const out = typeDocContent({ name: 'Idea', visible: false });
    expect(out).toContain('visible: false');
  });

  it('omits the key entirely for a visible type', () => {
    // A document created the ordinary way stays byte-identical to pre-0046.
    expect(typeDocContent({ name: 'Idea' })).not.toContain('visible');
    expect(typeDocContent({ name: 'Idea', visible: true })).not.toContain('visible');
  });
});
