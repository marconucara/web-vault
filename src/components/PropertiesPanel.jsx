import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import { wikilinkTargets } from '../lib/wikilinks.js';
import { titleIndex, idTitle, build } from '../content.js';
import { useTypeMeta } from '../lib/typeMetaContext.jsx';
import { commitFiles } from '../lib/commit.js';
import { discard } from '../lib/pending.js';
import { discardDraft } from '../lib/drafts.js';
import { markDeleted } from '../lib/deleted.js';
import { longDate, useFormatLocale } from '../lib/formats.js';
import { useCapabilities } from '../lib/capabilities.js';

// Read-only Properties panel, inspired by Tolaria: Type, scalar properties,
// relationships (grouped by key), Info (date/words/size), and History (last git
// commit). No editing in this phase: it shows the frontmatter state and the
// metadata computed at build time. The `_` properties (Tolaria state) are hidden.

// The relationship keys the app knows by name are translated; any other
// frontmatter key is the user's own and is only tidied up, never translated.
const REL_KEYS = {
  belongs_to: 'properties.relBelongsTo',
  related_to: 'properties.relRelatedTo',
  has: 'properties.relHas',
};

function humanize(key, t) {
  if (REL_KEYS[key]) return t(REL_KEYS[key]);
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  // Live type metadata: it changes as soon as the app writes a type.
  const typeMetaForNote = useTypeMeta(note?.type);
  const { t } = useTranslation();
  const { canWrite } = useCapabilities();
  const formatLocale = useFormatLocale();
  const fmtDate = (ms) => longDate(ms, formatLocale);
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
      setDelErr(e.message || t('properties.deleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  const fm = note.frontmatter || {};
  /** @type {[string, unknown][]} */
  const scalars = []; // [key, value] non-relationship, non-`_`, non-`type`
  /** @type {[string, { text: string, id: string | null }[]][]} */
  const rels = []; // [key, targets]
  for (const [key, val] of Object.entries(fm)) {
    if (key.startsWith('_') || key === 'type') continue;
    const targets = wikilinkTargets(val, titleIndex, idTitle);
    if (targets.length) rels.push([key, targets]);
    else if (val != null && val !== '') scalars.push([key, val]);
  }

  const tm = typeMetaForNote;
  const lc = note.lastCommit;
  const commitUrl = lc && build?.repo ? `https://github.com/${build.repo}/commit/${lc.sha}` : null;

  return (
    <aside className="props-panel">
      <header className="props-head">
        <span className="props-title"><Icon name="file-text" size={15} /> {t('properties.title')}</span>
        <button className="props-close" onClick={onClose} title={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
      </header>

      <div className="props-body">
        {/* Properties */}
        <div className="props-group">
          {note.type && (
            <div className="props-row">
              <span className="props-key">{t('properties.type')}</span>
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
              <span className="props-key">{humanize(key, t)}</span>
              <span className="props-val">
                {isUrl(val) ? (
                  <a href={String(val)} target="_blank" rel="noopener noreferrer" className="props-link">
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
                  <span className="props-rel-key">{humanize(key, t)}</span>
                  <div className="props-rel-chips"><Chips targets={targets} /></div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Info */}
        <div className="props-sep" />
        <div className="props-group">
          <div className="props-section-title"><Icon name="clock" size={13} /> {t('properties.info')}</div>
          <div className="props-info">
            <span>{t('properties.modified')}</span><span>{fmtDate(note.mtime)}</span>
            <span>{t('properties.created')}</span><span>{fmtDate(note.ctime)}</span>
            {note.words != null && (<><span>{t('properties.words')}</span><span>{note.words}</span></>)}
            {note.bytes != null && (<><span>{t('properties.size')}</span><span>{fmtBytes(note.bytes)}</span></>)}
          </div>
        </div>

        {/* Last commit (not the full history: only the last one that touched the file) */}
        {lc && (
          <>
            <div className="props-sep" />
            <div className="props-group">
              <div className="props-section-title"><Icon name="git-commit" size={13} /> {t('properties.lastCommit')}</div>
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

        {/* Danger zone: delete the note (a commit that removes the file).
            Withheld unless the deployment has confirmed it can write
            (adr/0034 criteria 11-12) — except for a draft, which is discarded
            locally and commits nothing. A draft made before the token went away
            would otherwise be impossible to get rid of. */}
        {(canWrite || isDraft) && (
        <>
        <div className="props-sep" />
        <div className="props-group">
          {delErr && <div className="props-del-error"><Icon name="x" size={13} /> {delErr}</div>}
          {!confirming ? (
            <button className="props-delete" onClick={() => setConfirming(true)}>
              <Icon name="trash" size={14} /> {t('properties.deleteNote')}
            </button>
          ) : (
            <div className="props-delete-confirm">
              <span className="pdc-text">
                {isDraft ? t('properties.confirmDiscardDraft') : t('properties.confirmDelete')}
              </span>
              <div className="pdc-actions">
                <button className="pdc-cancel" onClick={() => setConfirming(false)} disabled={busy}>
                  {t('common.cancel')}
                </button>
                <button className="pdc-confirm" onClick={doDelete} disabled={busy}>
                  <Icon name="trash" size={13} /> {busy ? t('properties.deleting') : t('common.delete')}
                </button>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </aside>
  );
}
