import data from 'virtual:web-vault-content';

export const notes = data.notes;
export const views = data.views;
export const titleIndex = data.titleIndex;
export const idTitle = data.idTitle;
export const build = data.build || null;
// Google Maps links resolved at build time: { [url]: { title, lat, lng } }.
export const maps = data.maps || {};
export const notesById = Object.fromEntries(notes.map((n) => [n.id, n]));

// Icon and color per type, taken from the Type documents (H1 == type name).
export const typeMeta = Object.fromEntries(
  notes
    .filter((n) => n.type === 'Type')
    .map((n) => {
      const fm = n.frontmatter || {};
      return [n.title, { icon: fm.icon || fm._icon || null, color: fm.color || fm._color || null }];
    })
);

// Content notes: excludes the Type documents.
export const contentNotes = notes.filter((n) => n.type !== 'Type');
export const types = [...new Set(contentNotes.map((n) => n.type).filter(Boolean))].sort();
