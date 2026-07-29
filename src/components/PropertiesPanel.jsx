import React, { useState } from 'react';
import Icon from './Icon.jsx';
import { wikilinkTargets } from '../lib/wikilinks.js';
import { typeMeta, titleIndex, idTitle, build } from '../content.js';
import { commitFiles } from '../lib/commit.js';
import { discard } from '../lib/pending.js';
import { discardDraft } from '../lib/drafts.js';
import { markDeleted } from '../lib/deleted.js';

// Read-only Properties panel, inspired by Tolaria: Type, scalar properties,
// relationships (grouped by key), Info (date/words/size), and History (last git
// commit). No editing in this phase: it shows the frontmatter state and the
// metadata computed at build time. The `_` properties (Tolaria state) are hidden.

const REL_LABELS = {
  belongs_to: 'Belongs to',
  related_to: 'Related to',
  has: 'Has',
};

function humanize(key) {
  if (REL_LABELS[key]) return REL_LABELS[key];
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isUrl(v) {
  return typeof v === 'string' && /^https?:\/\//i.test(v.trim());
}

function Chips({ targets }) {
  return (
    <>
      {targets.map((t, i) =>
        t.id ? (
          <a key={i} className="chip" href={`#/n/${encodeURIComponent(t.id)}`}>{t.text}</a>
        ) : (
          <span key={i} className="chip dead">{t.text}</span>
        )
      )}
    </>
  );
}

export default function PropertiesPanel({ note, onClose }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [delErr, setDelErr] = useState(null);

  if (!note) return null;

  const isDraft = !!note.draft;

  const doDelete = async () => {
    if (busy) return;
    setDelErr(null);
    // Uncommitted new note: just drop the draft, nothing to commit.
    if (isDraft) {
      discardDraft(note.id);
      window.location.hash = '#/';
      onClose?.();
      return;
    }
    setBusy(true);
    try {
      await commitFiles({ message: `Delete note: ${note.title}`, files: [{ path: note.path, delete: true }] });
      discard(note.path); // drop any pending body edit
      markDeleted(note.path); // hide optimistically until the next build
      window.location.hash = '#/';
      onClose?.();
    } catch (e) {
      setDelErr(e.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const fm = note.frontmatter || {};
  const scalars = []; // [key, value] non-relationship, non-`_`, non-`type`
  const rels = []; // [key, targets]
  for (const [key, val] of Object.entries(fm)) {
    if (key.startsWith('_') || key === 'type') continue;
    const targets = wikilinkTargets(val, titleIndex, idTitle);
    if (targets.length) rels.push([key, targets]);
    else if (val != null && val !== '') scalars.push([key, val]);
  }

  const tm = note.type ? typeMeta[note.type] : null;
  const lc = note.lastCommit;
  const commitUrl = lc && build?.repo ? `https://github.com/${build.repo}/commit/${lc.sha}` : null;

  return (
    <aside className="props-panel">
      <header className="props-head">
        <span className="props-title"><Icon name="file-text" size={15} /> Properties</span>
        <button className="props-close" onClick={onClose} title="Close">
          <Icon name="x" size={16} />
        </button>
      </header>

      <div className="props-body">
        {/* Properties */}
        <div className="props-group">
          {note.type && (
            <div className="props-row">
              <span className="props-key">Type</span>
              <span className="props-val">
                <span className="type-badge" style={tm?.color ? { color: tm.color } : undefined}>
                  <Icon name={tm?.icon || 'file-text'} color={tm?.color} size={14} />
                  {note.type}
                </span>
              </span>
            </div>
          )}
          {scalars.map(([key, val]) => (
            <div className="props-row" key={key}>
              <span className="props-key">{humanize(key)}</span>
              <span className="props-val">
                {isUrl(val) ? (
                  <a href={val} target="_blank" rel="noopener noreferrer" className="props-link">
                    {String(val)} <Icon name="external" size={12} />
                  </a>
                ) : (
                  String(val)
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Relationships */}
        {rels.length > 0 && (
          <>
            <div className="props-sep" />
            <div className="props-group">
              {rels.map(([key, targets]) => (
                <div className="props-rel" key={key}>
                  <span className="props-rel-key">{humanize(key)}</span>
                  <div className="props-rel-chips"><Chips targets={targets} /></div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Info */}
        <div className="props-sep" />
        <div className="props-group">
          <div className="props-section-title"><Icon name="clock" size={13} /> Info</div>
          <div className="props-info">
            <span>Modified</span><span>{fmtDate(note.mtime)}</span>
            <span>Created</span><span>{fmtDate(note.ctime)}</span>
            {note.words != null && (<><span>Words</span><span>{note.words}</span></>)}
            {note.bytes != null && (<><span>Size</span><span>{fmtBytes(note.bytes)}</span></>)}
          </div>
        </div>

        {/* Last commit (not the full history: only the last one that touched the file) */}
        {lc && (
          <>
            <div className="props-sep" />
            <div className="props-group">
              <div className="props-section-title"><Icon name="git-commit" size={13} /> Last commit</div>
              <div className="props-commit">
                {commitUrl ? (
                  <a href={commitUrl} target="_blank" rel="noopener noreferrer" className="props-commit-sha">{lc.sha}</a>
                ) : (
                  <span className="props-commit-sha">{lc.sha}</span>
                )}
                <span className="props-commit-subject" title={lc.subject}>{lc.subject}</span>
              </div>
            </div>
          </>
        )}

        {/* Danger zone: delete the note (a commit that removes the file). */}
        <div className="props-sep" />
        <div className="props-group">
          {delErr && <div className="props-del-error"><Icon name="x" size={13} /> {delErr}</div>}
          {!confirming ? (
            <button className="props-delete" onClick={() => setConfirming(true)}>
              <Icon name="trash" size={14} /> Delete this note
            </button>
          ) : (
            <div className="props-delete-confirm">
              <span className="pdc-text">
                {isDraft ? 'Discard this new note?' : 'Delete this note? This removes the file.'}
              </span>
              <div className="pdc-actions">
                <button className="pdc-cancel" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </button>
                <button className="pdc-confirm" onClick={doDelete} disabled={busy}>
                  <Icon name="trash" size={13} /> {busy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
