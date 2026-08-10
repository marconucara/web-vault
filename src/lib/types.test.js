import { describe, expect, it } from 'vitest';
import {
  canonicalName,
  titleCase,
  contentOnly,
  countNotesOfType,
  declaredTypes,
  deriveTypes,
  orderTypes,
  sameTypeName,
  typeDocMeta,
  typeNameTaken,
  usedTypes,
} from './types.js';

// Shorthand builders: a Type document (H1 becomes `title` at build time) and a
// content note carrying a type.
const typeDoc = (title, frontmatter = {}, path = `${title}.md`) => ({
  id: path.replace(/\.md$/, ''),
  path,
  title,
  type: 'Type',
  frontmatter,
});
const note = (title, type, path = `${title}.md`) => ({
  id: path.replace(/\.md$/, ''),
  path,
  title,
  type,
  frontmatter: type ? { type } : {},
});

describe('type derivation (ADR 0045)', () => {
  it('unions declared and used types, so a type with no notes is still listed', () => {
    const notes = [
      typeDoc('Person', { icon: 'user' }),
      typeDoc('Recipe', { icon: 'book' }), // declared, nothing attached
      note('Ada', 'Person'),
      note('Scratch', 'Idea'), // used, no document behind it
    ];
    const { names, declared } = deriveTypes(notes);
    expect(names).toEqual(['Idea', 'Person', 'Recipe']);
    // Criterion 1: declared-with-no-notes is present, and counts zero.
    expect(countNotesOfType(notes, 'Recipe')).toBe(0);
    expect(countNotesOfType(notes, 'Person')).toBe(1);
    // A used type is listed but not declared — that is what makes create adopt it.
    expect(declared.has('Recipe')).toBe(true);
    expect(declared.has('Idea')).toBe(false);
  });

  it('skips a Type document with no H1 rather than listing an empty name', () => {
    const notes = [typeDoc('', { icon: 'user' }, 'untitled.md'), note('Ada', 'Person')];
    const { names } = deriveTypes(notes);
    expect(names).toEqual(['Person']);
    expect(declaredTypes(notes).size).toBe(0);
  });

  it('orders by `order:` ascending, then alphabetically for the rest', () => {
    const meta = {
      Zebra: { order: 1 },
      Apple: { order: 2 },
      Mango: { order: null },
      Beta: { order: null },
    };
    // Criterion 2: ordered types first in their own order, unordered after,
    // alphabetically among themselves.
    expect(orderTypes(Object.keys(meta), meta)).toEqual(['Zebra', 'Apple', 'Beta', 'Mango']);
  });

  it('breaks ties in `order:` alphabetically', () => {
    const meta = { Pear: { order: 1 }, Apple: { order: 1 } };
    expect(orderTypes(Object.keys(meta), meta)).toEqual(['Apple', 'Pear']);
  });

  it('reads icon, color and order under their underscore aliases too', () => {
    expect(typeDocMeta(typeDoc('A', { icon: 'user', color: 'red', order: 3 }))).toMatchObject({
      icon: 'user',
      color: 'red',
      order: 3,
    });
    expect(typeDocMeta(typeDoc('B', { _icon: 'book', _color: 'blue', _order: 4 }))).toMatchObject({
      icon: 'book',
      color: 'blue',
      order: 4,
    });
    // `order:` arrives as a string from some vaults; a non-numeric one orders nothing.
    expect(typeDocMeta(typeDoc('C', { order: '7' })).order).toBe(7);
    expect(typeDocMeta(typeDoc('D', { order: 'first' })).order).toBe(null);
  });

  it('keeps Type documents out of the content notes and the used set', () => {
    const notes = [typeDoc('Person'), note('Ada', 'Person')];
    // Criterion 12: Type documents never appear in the lists.
    expect(contentOnly(notes).map((n) => n.title)).toEqual(['Ada']);
    // ...nor does the literal name `Type` become a type.
    expect([...usedTypes(notes).keys()]).toEqual(['person']);
  });
});

describe('type names differing only in case are one type', () => {
  it('collapses `note`, `Note` and `NOTE` into a single entry', () => {
    const notes = [
      note('A', 'Note', 'a'),
      note('B', 'note', 'b'),
      note('C', 'NOTE', 'c'),
    ];
    const { names } = deriveTypes(notes);
    // The bug this fixes: three sidebar rows that all read the same, each
    // holding a third of the notes.
    expect(names).toHaveLength(1);
    expect(countNotesOfType(notes, names[0])).toBe(3);
  });

  it('shows the spelling the Type document declares', () => {
    const notes = [typeDoc('Note', { icon: 'file-text' }), note('A', 'note', 'a'), note('B', 'NOTE', 'b')];
    const { names, meta } = deriveTypes(notes);
    // The H1 IS the type's name, so it settles the display form...
    expect(names).toEqual(['Note']);
    // ...and its metadata applies to the notes spelled differently.
    expect(meta.Note.icon).toBe('file-text');
    expect(countNotesOfType(notes, 'Note')).toBe(2);
  });

  it('falls back to title case when no document declares the type', () => {
    // Whatever the notes wrote, the label is the type name in title case: it
    // must not depend on which spelling happens to be the most common.
    expect(canonicalName(['note', 'Note', 'note'])).toBe('Note');
    expect(canonicalName(['NOTE'])).toBe('Note');
    expect(canonicalName(['nOtE', 'note'])).toBe('Note');
  });

  it('title-cases every word without disturbing separators', () => {
    expect(titleCase('meeting note')).toBe('Meeting Note');
    expect(titleCase('TO-DO')).toBe('To-Do');
    expect(titleCase('book_review')).toBe('Book_Review');
    // Accents and apostrophes stay inside their word rather than splitting it.
    expect(titleCase("l'idée")).toBe("L'idée");
    expect(titleCase('città')).toBe('Città');
    // A digit does not start a new word.
    expect(titleCase('mp3 file')).toBe('Mp3 File');
  });

  it('keeps the declared spelling verbatim, however it is capitalised', () => {
    // A vault that deliberately declares `iPhone` or `to-do` keeps it.
    expect(canonicalName(['iphone'], 'iPhone')).toBe('iPhone');
    expect(canonicalName(['TODO'], 'to-do')).toBe('to-do');
  });

  it('does not merge names that genuinely differ', () => {
    const notes = [note('A', 'Note', 'a'), note('B', 'Notes', 'b')];
    expect(deriveTypes(notes).names).toEqual(['Note', 'Notes']);
  });

  it('lets a declared type absorb a differently-cased used one', () => {
    // `Person` is declared; `person` is only used. One row, not two.
    const notes = [typeDoc('Person'), note('Ada', 'person', 'ada')];
    const { names, declared } = deriveTypes(notes);
    expect(names).toEqual(['Person']);
    expect([...declared]).toEqual(['Person']);
  });
});

describe('type name uniqueness (ADR 0045, criterion 8)', () => {
  const declared = new Set(['Person', 'Recipe']);

  it('rejects a name an existing Type document already declares', () => {
    expect(typeNameTaken('Person', declared)).toBe(true);
    // Case and surrounding whitespace must not open a second document for what
    // the sidebar shows as one type.
    expect(typeNameTaken('  person ', declared)).toBe(true);
  });

  it('accepts a name only the notes carry, so creating adopts that type', () => {
    // 'Idea' is in use but undeclared: creating it is the point, not a collision.
    expect(typeNameTaken('Idea', declared)).toBe(false);
  });

  it('does not treat a type being renamed as colliding with itself', () => {
    expect(typeNameTaken('Person', declared, 'Person')).toBe(false);
    // ...but a rename onto another existing document still collides.
    expect(typeNameTaken('Recipe', declared, 'Person')).toBe(true);
  });

  it('compares names ignoring case and surrounding whitespace', () => {
    expect(sameTypeName('Person', ' person ')).toBe(true);
    expect(sameTypeName('Person', 'People')).toBe(false);
  });
});
