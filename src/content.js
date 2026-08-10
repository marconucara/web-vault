import data from 'virtual:web-vault-content';

export const notes = data.notes;
export const views = data.views;
export const titleIndex = data.titleIndex;
export const idTitle = data.idTitle;
export const build = data.build || null;
// Google Maps links resolved at build time: { [url]: { title, lat, lng } }.
export const maps = data.maps || {};
export const notesById = Object.fromEntries(notes.map((n) => [n.id, n]));

// Type metadata and the type list are NOT exported from here any more: they are
// derived at render time from the live note set — the bundle composed with the
// app's optimistic overlay — so a type created, renamed or deleted from the UI
// shows up before the next build. See lib/types.js and App.jsx
// (adr/0045-manage-types-from-the-ui.md, criteria 13-14). Deriving them here,
// from the bundle alone, would silently ignore that overlay.

// Content notes: excludes the Type documents. Build-time only; the live
// equivalent is `contentOnly(liveNotes)` in App.jsx.
export const contentNotes = notes.filter((n) => n.type !== 'Type');
