import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { notes, views, titleIndex, notesById, build } from './content.js';
import { filterNotes, sortNotes } from './lib/views.js';
import { RESERVED_VIEW_IDS, isInboxNote, isSharedNote } from './lib/builtins.js';
import Sidebar from './components/Sidebar.jsx';
import NoteList from './components/NoteList.jsx';
import NoteView from './components/NoteView.jsx';
import StatusBar from './components/StatusBar.jsx';
import { usePending } from './lib/pending.js';
import { useDrafts, createDraft, draftToNote } from './lib/drafts.js';
import { useDeleted, reconcileDeleted } from './lib/deleted.js';
import { useLocalNotes, reconcileLocal } from './lib/localNotes.js';
import { deriveTypes, contentOnly, sameTypeName } from './lib/types.js';
import { TypeMetaProvider } from './lib/typeMetaContext.jsx';
import TypePanel from './components/TypePanel.jsx';

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
  const [selection, setSelection] = useState(/** @type {{ kind: string, id?: string }} */ ({ kind: 'all' }));
  const [openId, setOpenId] = useState(parseHash);
  const [navOpen, setNavOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 900px)');
  const pending = usePending();
  const draftMap = useDrafts();
  const deleted = useDeleted();
  const local = useLocalNotes();

  // Self-heal the optimistic sets against the current build (runs once:
  // content.json is fixed per build). Modified entries heal on the build's
  // timestamp rather than on the id, which they share with the build by
  // definition (see lib/localNotes.js).
  useEffect(() => {
    reconcileDeleted(new Set(notes.map((n) => n.path)));
    const builtAt = build?.builtAt ? Date.parse(build.builtAt) : null;
    reconcileLocal(new Set(notes.map((n) => n.id)), Number.isFinite(builtAt) ? builtAt : null);
  }, []);

  // Notes written from the web client and not yet superseded by a build: the
  // created ones (absent from the build) and the modified ones (present, but
  // with stale content the local copy overrides).
  const createdNotes = useMemo(
    () => Object.values(local).filter((n) => n.origin !== 'modified' && !notesById[n.id]),
    [local]
  );
  const modifiedById = useMemo(() => {
    const out = {};
    for (const n of Object.values(local)) if (n.origin === 'modified') out[n.id] = n;
    return out;
  }, [local]);

  // Live set: build-time notes minus optimistic deletes, with locally modified
  // notes standing in for their build-time selves, plus optimistic creations.
  // Type documents stay in — the type derivation reads them — and are filtered
  // out of the lists below.
  const liveNotes = useMemo(
    () =>
      [
        ...notes.filter((n) => !deleted[n.path]).map((n) => modifiedById[n.id] || n),
        ...createdNotes,
      ],
    [deleted, createdNotes, modifiedById]
  );

  // Types derived from the live set, so a type created, renamed or deleted from
  // the app is visible before the next build (adr/0045, criteria 13-14).
  const { names: types, meta: typeMeta, declared: declaredTypeNames } = useMemo(
    () => deriveTypes(liveNotes),
    [liveNotes]
  );

  // What the lists show: everything except the Type documents (criterion 12).
  const liveContent = useMemo(() => contentOnly(liveNotes), [liveNotes]);

  // Not-yet-committed new notes (drafts), shaped like build-time notes.
  const draftNotes = useMemo(() => Object.values(draftMap).map(draftToNote), [draftMap]);
  const allNotesById = useMemo(() => {
    const base = {};
    for (const n of notes) if (!deleted[n.path]) base[n.id] = modifiedById[n.id] || n;
    for (const n of createdNotes) base[n.id] = n;
    for (const n of draftNotes) base[n.id] = n;
    return base;
  }, [createdNotes, modifiedById, draftNotes, deleted]);

  // Sidebar counters, composed exactly like each list: drafts count under "All
  // notes" and their matching type, but not inside views (whose filter stays pure).
  const counts = useMemo(() => {
    const c = { all: liveContent.length + draftNotes.length };
    // Built-in views: drafts are unorganized, so they count under Inbox (like All
    // notes) but never under Shared.
    c.inbox = liveContent.filter(isInboxNote).length + draftNotes.length;
    c.shared = liveContent.filter(isSharedNote).length;
    for (const t of types) {
      c[`type:${t}`] =
        liveContent.filter((n) => sameTypeName(n.type, t)).length +
        draftNotes.filter((n) => sameTypeName(n.type, t)).length;
    }
    for (const v of vaultViews) {
      c[`view:${v.id}`] = filterNotes(liveContent, v).length;
    }
    return c;
  }, [liveContent, draftNotes]);

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
    const target = Object.values(local).find((n) => n.fromDraftId === openId);
    if (target) {
      history.replaceState(null, '', `#/n/${encodeURIComponent(target.id)}`);
      setOpenId(target.id);
    }
  }, [local, openId]);

  const { list, title } = useMemo(() => {
    // Contextual drafts pinned at the top of the list: all of them under "All
    // notes", the matching type under a type view. Views keep their filter pure.
    let draftsForList = [];
    if (selection.kind === 'all' || selection.kind === 'inbox') draftsForList = draftNotes;
    else if (selection.kind === 'type')
      draftsForList = draftNotes.filter((n) => sameTypeName(n.type, selection.id));

    if (selection.kind === 'view') {
      const v = vaultViews.find((x) => x.id === selection.id);
      return { list: v ? filterNotes(liveContent, v) : [], title: v?.name || selection.id };
    }
    if (selection.kind === 'inbox') {
      return {
        list: [...draftsForList, ...sortNotes(liveContent.filter(isInboxNote), 'modified:desc')],
        title: 'Inbox',
      };
    }
    if (selection.kind === 'shared') {
      return { list: sortNotes(liveContent.filter(isSharedNote), 'modified:desc'), title: 'Shared' };
    }
    if (selection.kind === 'type') {
      return {
        list: [
          ...draftsForList,
          ...sortNotes(liveContent.filter((n) => sameTypeName(n.type, selection.id)), 'title:asc'),
        ],
        title: selection.id,
      };
    }
    return { list: [...draftsForList, ...sortNotes(liveContent, 'modified:desc')], title: 'All notes' };
  }, [selection, draftNotes, liveContent]);

  const note = openId ? allNotesById[openId] : null;

  const onSelect = (sel) => { setSelection(sel); setNavOpen(false); if (!isDesktop) clearNote(); };

  // New note contextual to the current navigation: the browsed type, or a plain
  // "Note" in views / All notes. Opens it right away, like editing a note.
  const onNew = () => {
    const type = selection.kind === 'type' ? selection.id : 'Note';
    openNote(createDraft({ type }));
    setNavOpen(false);
  };

  // Type management (adr/0045): `{ mode, name }`, or null when the panel is shut.
  const [typePanel, setTypePanel] = useState(/** @type {{ mode: string, name?: string } | null} */ (null));

  // The Type document behind a name, when one declares it. A type only the notes
  // carry has none: the panel opens prefilled with its name and creates it.
  const typeDocFor = (name) => {
    const path = typeMeta[name]?.path;
    return path ? liveNotes.find((n) => n.path === path) || null : null;
  };

  const sidebar = (
    <Sidebar
      views={vaultViews}
      types={types}
      typeMeta={typeMeta}
      counts={counts}
      selection={selection}
      onSelect={onSelect}
      onNewType={() => setTypePanel({ mode: 'create' })}
      onEditType={(name) => setTypePanel({ mode: 'edit', name })}
    />
  );

  const main = isDesktop ? (
    <div className="app">
      {sidebar}
      <NoteList title={title} notes={list} openId={openId} onOpen={openNote} onNew={onNew} typeMeta={typeMeta} />
      <NoteView note={note} titleIndex={titleIndex} onBack={null} />
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
    <TypeMetaProvider value={typeMeta}>
      <div className="shell">
        {main}
        <StatusBar pending={pending} onOpen={openNote} />
        {typePanel && (
          <TypePanel
            mode={typePanel.mode}
            typeName={typePanel.name || null}
            meta={typePanel.name ? typeMeta[typePanel.name] : null}
            doc={typePanel.name ? typeDocFor(typePanel.name) : null}
            declared={declaredTypeNames}
            notes={liveNotes}
            onClose={() => setTypePanel(null)}
            onRenamed={(newName) => {
              // Follow the rename, so the user stays on the type they were in.
              setSelection((s) => (s.kind === 'type' && s.id === typePanel.name ? { kind: 'type', id: newName } : s));
            }}
            onDeleted={() => {
              setSelection((s) => (s.kind === 'type' && s.id === typePanel.name ? { kind: 'all' } : s));
            }}
          />
        )}
      </div>
    </TypeMetaProvider>
  );
}
