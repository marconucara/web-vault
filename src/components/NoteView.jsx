import React, { useEffect, useState, Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { wikilinkTargets } from '../lib/wikilinks.js';
import { idTitle } from '../content.js';
import { usePending, setEdit, effectiveBody } from '../lib/pending.js';
import { setDraftBody } from '../lib/drafts.js';
import Editor from './Editor.jsx';
import ShareSheet from './ShareSheet.jsx';
import Icon from './Icon.jsx';
import PropertiesPanel from './PropertiesPanel.jsx';
import ChunkBoundary from './ChunkBoundary.jsx';

const BlockEditor = lazy(() => import('./BlockEditor.jsx'));
const MapView = lazy(() => import('./MapView.jsx'));

// Placeholder shown while the block editor chunk loads: skeleton bars (not text)
// approximating the note's title + paragraphs.
function EditorSkeleton() {
  const lines = ['92%', '85%', '96%', '60%', '88%', '78%', '90%'];
  return (
    <div className="editor-skeleton" aria-hidden="true">
      <div className="sk-line sk-h" />
      {lines.map((w, i) => (
        <div key={i} className="sk-line" style={{ width: w }} />
      ))}
    </div>
  );
}

// Test config: the block editor (BlockNote) is ALWAYS on for every note
// (view+edit together). "Raw" toggle to view/edit the markdown source
// (CodeMirror). The react-markdown read rendering is still used for the public
// share pages.
export default function NoteView({ note, titleIndex, onBack = null }) {
  const [raw, setRaw] = useState(false);
  const [mapView, setMapView] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const pending = usePending();
  const { t } = useTranslation();

  useEffect(() => {
    setRaw(false);
    setMapView(false);
  }, [note?.id]);

  if (!note) {
    return (
      <div className="noteview empty">
        <div className="empty-note">
          <Icon name="inbox" size={40} />
          <p>{t('noteView.emptyState')}</p>
        </div>
      </div>
    );
  }

  const isDraft = !!note.draft;
  // Drafts live in their own store (their body is the source of truth); existing
  // notes take the pending draft over the build-time body.
  const body = isDraft ? note.body : effectiveBody(pending, note);
  const onBodyChange = isDraft ? (v) => setDraftBody(note.id, v) : (v) => setEdit(note, v);
  const modified = isDraft || !!pending[note.path];
  // A draft still on its empty-heading template: seed a focused H1 in the editor.
  const newNote = isDraft && /^\s*#\s*$/.test(note.body || '');
  const status = note.frontmatter.status ?? note.frontmatter.Status;

  /** @type {[string, { text: string, id: string | null }[]][]} */
  const rels = [];
  for (const [key, val] of Object.entries(note.frontmatter)) {
    if (key.startsWith('_')) continue;
    const targets = wikilinkTargets(val, titleIndex, idTitle);
    if (targets.length) rels.push([key, targets]);
  }

  return (
    <article className={`noteview${mapView ? ' mapmode' : ''}`}>
      <div className="note-header">
        {onBack && (
          <button className="back" onClick={onBack}>← {t('noteView.back')}</button>
        )}
        {modified && (
          <span className="mod-flag" title={t('noteView.uncommittedChanges')}>
            ● {isDraft ? t('noteView.flagNew') : t('noteView.flagChanged')}
          </span>
        )}
        <div className="note-header-actions">
          <button
            className={`note-hbtn tt ${raw ? 'active' : ''}`}
            onClick={() => setRaw((v) => !v)}
            data-tip={raw ? t('noteView.visualEditor') : t('noteView.editSourceTip')}
            aria-label={raw ? t('noteView.visualEditor') : t('noteView.editSource')}
          >
            <Icon name={raw ? 'edit' : 'text'} size={16} />
          </button>
          <button
            className={`note-hbtn tt ${mapView ? 'active' : ''}`}
            onClick={() => setMapView((v) => !v)}
            data-tip={t('noteView.mapView')}
            aria-label={t('noteView.mapView')}
          >
            <Icon name="map" size={16} />
          </button>
          <button
            className={`note-hbtn tt ${propsOpen ? 'active' : ''}`}
            onClick={() => setPropsOpen((v) => !v)}
            data-tip={t('noteView.properties')}
            aria-label={t('noteView.properties')}
          >
            <Icon name="panel-right" size={16} />
          </button>
        </div>
      </div>
      {mapView ? (
        <ChunkBoundary>
          <Suspense fallback={<div className="mapview"><div className="mapview-map" /></div>}>
            <MapView body={body} />
          </Suspense>
        </ChunkBoundary>
      ) : (
      <div className="note-inner">
        <div className="meta">
          {note.type && <span className="badge">{note.type}</span>}
          {status && <span className="badge status">{String(status)}</span>}
          {rels.map(([key, targets]) => (
            <span key={key} className="rel">
              <span className="rel-key">{key}:</span>
              {targets.map((t, i) => (
                t.id
                  ? <a key={i} className="chip" href={`#/n/${encodeURIComponent(t.id)}`}>{t.text}</a>
                  : <span key={i} className="chip dead">{t.text}</span>
              ))}
            </span>
          ))}
          {!isDraft && <ShareSheet note={note} />}
        </div>
        {raw ? (
          <Editor value={body} onChange={onBodyChange} />
        ) : (
          <ChunkBoundary>
            <Suspense fallback={<EditorSkeleton />}>
              <BlockEditor key={note.id} noteId={note.id} value={body} onChange={onBodyChange} newNote={newNote} />
            </Suspense>
          </ChunkBoundary>
        )}
      </div>
      )}
      {propsOpen && (
        <>
          <div className="props-backdrop" onClick={() => setPropsOpen(false)} />
          <PropertiesPanel note={note} onClose={() => setPropsOpen(false)} />
        </>
      )}
    </article>
  );
}
