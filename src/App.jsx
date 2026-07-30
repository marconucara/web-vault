import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { notes, contentNotes, views, types, typeMeta, titleIndex, notesById } from './content.js';
import { filterNotes, sortNotes } from './lib/views.js';
import { RESERVED_VIEW_IDS, isInboxNote, isSharedNote } from './lib/builtins.js';
import Sidebar from './components/Sidebar.jsx';
import NoteList from './components/NoteList.jsx';
import NoteView from './components/NoteView.jsx';
import StatusBar from './components/StatusBar.jsx';
import { usePending } from './lib/pending.js';
import { useDrafts, createDraft, draftToNote } from './lib/drafts.js';
import { useDeleted, reconcileDeleted } from './lib/deleted.js';
import { useCreated, reconcileCreated } from './lib/created.js';

// Vault saved views minus those whose id is owned by a built-in view (adr/0033).
const vaultViews = views.filter((v) => !RESERVED_VIEW_IDS.includes(v.id));

function parseHash() {
  const m = window.location.hash.match(/^#\/n\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function useMediaQuery(q) {
  const [match, setMatch] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return match;
}

export default function App() {
  const [selection, setSelection] = useState({ kind: 'all' });
  const [openId, setOpenId] = useState(parseHash);
  const [navOpen, setNavOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 900px)');
  const pending = usePending();
  const draftMap = useDrafts();
  const deleted = useDeleted();
  const created = useCreated();

  // Self-heal the optimistic delete/create sets against the current build (runs
  // once: content.json is fixed per build).
  useEffect(() => {
    reconcileDeleted(new Set(notes.map((n) => n.path)));
    reconcileCreated(new Set(notes.map((n) => n.id)));
  }, []);

  // Notes just created from the web client, kept locally (real id/path) until a
  // build includes them. Drop any the build already has (self-heal covers LS).
  const createdNotes = useMemo(
    () => Object.values(created).filter((n) => !notesById[n.id]),
    [created]
  );

  // Live set for lists: build-time content minus optimistic deletes, plus
  // optimistic creations. Created notes behave like real notes (they have a
  // real path), so views/types/sort include them naturally.
  const liveNotes = useMemo(
    () => [...contentNotes.filter((n) => !deleted[n.path]), ...createdNotes],
    [deleted, createdNotes]
  );

  // Not-yet-committed new notes (drafts), shaped like build-time notes.
  const draftNotes = useMemo(() => Object.values(draftMap).map(draftToNote), [draftMap]);
  const allNotesById = useMemo(() => {
    const base = {};
    for (const n of notes) if (!deleted[n.path]) base[n.id] = n;
    for (const n of createdNotes) base[n.id] = n;
    for (const n of draftNotes) base[n.id] = n;
    return base;
  }, [createdNotes, draftNotes, deleted]);

  // Sidebar counters, composed exactly like each list: drafts count under "All
  // notes" and their matching type, but not inside views (whose filter stays pure).
  const counts = useMemo(() => {
    const c = { all: liveNotes.length + draftNotes.length };
    // Built-in views: drafts are unorganized, so they count under Inbox (like All
    // notes) but never under Shared.
    c.inbox = liveNotes.filter(isInboxNote).length + draftNotes.length;
    c.shared = liveNotes.filter(isSharedNote).length;
    for (const t of types) {
      c[`type:${t}`] =
        liveNotes.filter((n) => n.type === t).length + draftNotes.filter((n) => n.type === t).length;
    }
    for (const v of vaultViews) {
      c[`view:${v.id}`] = filterNotes(liveNotes, v).length;
    }
    return c;
  }, [liveNotes, draftNotes]);

  useEffect(() => {
    const on = () => setOpenId(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const openNote = (id) => { window.location.hash = `#/n/${encodeURIComponent(id)}`; };
  const clearNote = () => { window.location.hash = '#/'; };

  // After a draft is committed it becomes a real "created" note under a new id.
  // If the user was viewing that draft, move them to the definitive URL (replace,
  // so the back button doesn't return to the now-dead draft URL).
  useLayoutEffect(() => {
    if (!openId || !openId.startsWith('draft-')) return;
    const target = Object.values(created).find((n) => n.fromDraftId === openId);
    if (target) {
      history.replaceState(null, '', `#/n/${encodeURIComponent(target.id)}`);
      setOpenId(target.id);
    }
  }, [created, openId]);

  const { list, title } = useMemo(() => {
    // Contextual drafts pinned at the top of the list: all of them under "All
    // notes", the matching type under a type view. Views keep their filter pure.
    let draftsForList = [];
    if (selection.kind === 'all' || selection.kind === 'inbox') draftsForList = draftNotes;
    else if (selection.kind === 'type') draftsForList = draftNotes.filter((n) => n.type === selection.id);

    if (selection.kind === 'view') {
      const v = vaultViews.find((x) => x.id === selection.id);
      return { list: v ? filterNotes(liveNotes, v) : [], title: v?.name || selection.id };
    }
    if (selection.kind === 'inbox') {
      return {
        list: [...draftsForList, ...sortNotes(liveNotes.filter(isInboxNote), 'modified:desc')],
        title: 'Inbox',
      };
    }
    if (selection.kind === 'shared') {
      return { list: sortNotes(liveNotes.filter(isSharedNote), 'modified:desc'), title: 'Shared' };
    }
    if (selection.kind === 'type') {
      return {
        list: [...draftsForList, ...sortNotes(liveNotes.filter((n) => n.type === selection.id), 'title:asc')],
        title: selection.id,
      };
    }
    return { list: [...draftsForList, ...sortNotes(liveNotes, 'modified:desc')], title: 'All notes' };
  }, [selection, draftNotes, liveNotes]);

  const note = openId ? allNotesById[openId] : null;

  const onSelect = (sel) => { setSelection(sel); setNavOpen(false); if (!isDesktop) clearNote(); };

  // New note contextual to the current navigation: the browsed type, or a plain
  // "Note" in views / All notes. Opens it right away, like editing a note.
  const onNew = () => {
    const type = selection.kind === 'type' ? selection.id : 'Note';
    openNote(createDraft({ type }));
    setNavOpen(false);
  };

  const sidebar = (
    <Sidebar views={vaultViews} types={types} typeMeta={typeMeta} counts={counts} selection={selection} onSelect={onSelect} />
  );

  const main = isDesktop ? (
    <div className="app">
      {sidebar}
      <NoteList title={title} notes={list} openId={openId} onOpen={openNote} onNew={onNew} typeMeta={typeMeta} />
      <NoteView note={note} titleIndex={titleIndex} />
    </div>
  ) : (
    // Mobile: one panel at a time, collapsible sidebar.
    <div className="app mobile">
      {navOpen && (
        <div className="drawer-backdrop" onClick={() => setNavOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}
      {note ? (
        <NoteView note={note} titleIndex={titleIndex} onBack={clearNote} />
      ) : (
        <div className="mobile-list">
          <header className="topbar">
            <button className="hamburger" onClick={() => setNavOpen(true)}>☰</button>
            <span className="topbar-title">{title}</span>
          </header>
          <NoteList title={title} notes={list} openId={openId} onOpen={openNote} onNew={onNew} typeMeta={typeMeta} />
        </div>
      )}
    </div>
  );

  return (
    <div className="shell">
      {main}
      <StatusBar pending={pending} onOpen={openNote} />
    </div>
  );
}
