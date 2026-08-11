import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import VersionIndicator from './VersionIndicator.jsx';
import { discard, discardAll, discardMany } from '../lib/pending.js';
import { useDrafts, discardDraft, discardDrafts } from '../lib/drafts.js';
import { useLocalNotes, markCreated } from '../lib/localNotes.js';
import { deriveTitle, draftPath, draftFileContent } from '../lib/noteFile.js';
import { commitFiles } from '../lib/commit.js';
import { build, notes } from '../content.js';

// Thin full-width status bar (VS Code / Tolaria style): a single indicator in
// the bottom right. Green "In sync" when there is nothing to commit; otherwise
// a clickable "N notes changed" that opens a panel with a recap of the changes,
// the selection of which to commit, and the commit action.
export default function StatusBar({ pending, onOpen, onOpenPreferences = null }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [deselected, setDeselected] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  const { t } = useTranslation();

  const drafts = useDrafts();
  const created = useLocalNotes();

  // One list mixing new notes (drafts) and body edits of existing notes. Each
  // entry has a stable `key`: the draft id for new notes, the path for edits.
  const draftItems = Object.values(drafts).map((d) => ({
    key: d.id,
    kind: 'new',
    id: d.id,
    title: deriveTitle(d.body) || t('common.untitled'),
    draft: d,
  }));
  const editItems = Object.values(pending).map((it) => ({
    key: it.path,
    kind: 'edit',
    id: it.id,
    title: it.title,
    path: it.path,
    body: it.body,
  }));
  /** @type {any[]} */
  const items = [...draftItems, ...editItems];
  const n = items.length;
  const inSync = n === 0;

  // Close the panel when there are no more changes.
  useEffect(() => {
    if (inSync && open) setOpen(false);
  }, [inSync, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = items.filter((it) => !deselected.has(it.key));
  const k = selected.length;

  const toggleSel = (key) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const doCommit = async () => {
    if (!k || committing) return;
    setError(null);
    setCommitting(true);
    // New notes get their filename from the H1 now (Tolaria convention), in the
    // vault root, kept unique against existing files, optimistic creations, and
    // sibling drafts.
    const taken = new Set([...notes.map((nn) => nn.path), ...Object.values(created).map((c) => c.path)]);
    const files = [];
    const editPaths = [];
    const newOnes = []; // { draftId, path, draft }
    for (const it of selected) {
      if (it.kind === 'edit') {
        files.push({ path: it.path, body: it.body });
        editPaths.push(it.path);
      } else {
        const path = draftPath(it.draft, taken);
        taken.add(path);
        files.push({ path, content: draftFileContent(it.draft), isNew: true });
        newOnes.push({ draftId: it.id, path, draft: it.draft });
      }
    }
    try {
      await commitFiles({ message: message.trim(), files });
      // Optimistic: drop the committed body edits (their base content reappears
      // on the next build). New notes instead become optimistic "created" notes
      // kept locally (real id/path) until the build catches up, so they don't
      // vanish; the open draft URL is redirected to the real one by App.
      discardMany(editPaths);
      const now = Date.now();
      for (const o of newOnes) {
        markCreated({
          id: o.path.replace(/\.md$/, ''),
          path: o.path,
          fromDraftId: o.draftId,
          title: deriveTitle(o.draft.body) || t('common.untitled'),
          type: o.draft.type || null,
          frontmatter: o.draft.frontmatter || (o.draft.type ? { type: o.draft.type } : {}),
          body: o.draft.body,
          mtime: now,
          ctime: now,
        });
      }
      discardDrafts(newOnes.map((o) => o.draftId));
      setMessage('');
      setToast(t('statusBar.committed', { count: files.length }));
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      setError(e.message || t('statusBar.commitFailed'));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="statusbar" ref={ref}>
      {open && !inSync && (
        <div className="statuspanel">
          <div className="sp-head">
            <span>{t('statusBar.uncommittedChanges')}</span>
            <button className="link-btn" onClick={() => discardAll()}>{t('statusBar.discardAll')}</button>
          </div>
          <ul className="sp-list">
            {items.map((it) => (
              <li key={it.key}>
                <input
                  type="checkbox"
                  checked={!deselected.has(it.key)}
                  onChange={() => toggleSel(it.key)}
                  title={t('statusBar.includeInCommit')}
                />
                <button
                  className="sp-title"
                  onClick={() => { onOpen?.(it.id); setOpen(false); }}
                  title={it.kind === 'new' ? t('statusBar.newNote') : it.path}
                >
                  {it.title}
                  {it.kind === 'new' && <span className="sp-tag">{t('statusBar.tagNew')}</span>}
                </button>
                <button
                  className="sp-discard"
                  onClick={() => (it.kind === 'new' ? discardDraft(it.id) : discard(it.path))}
                  title={it.kind === 'new' ? t('statusBar.discardNewNote') : t('statusBar.discardChanges')}
                >
                  <Icon name="trash" size={14} />
                </button>
              </li>
            ))}
          </ul>
          <input
            className="sp-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('statusBar.commitMessage')}
          />
          {error && <div className="sp-error"><Icon name="x" size={13} /> {error}</div>}
          <div className="sp-actions">
            <button className="sp-commit" onClick={doCommit} disabled={!k || committing}>
              <Icon name="git-commit" size={14} />
              {committing ? t('statusBar.committing') : k ? t('statusBar.commitCount', { count: k }) : t('statusBar.commit')}
            </button>
          </div>
        </div>
      )}

      {/* Two distinct identities sit side by side here: the WebVault release
          this site was built with, and the commit of the vault's own content.
          They are deliberately separate elements with their own tooltips — the
          version is not a property of that commit, and only the commit has
          somewhere to link to. */}
      <VersionIndicator />
      {build?.short && (() => {
        const tip = t(build.dirty ? 'statusBar.buildTipDirty' : 'statusBar.buildTip', {
          short: build.short,
          builtAt: build.builtAt,
        });
        return (
          // The in-app tooltip (`.tt` + `data-tip`), not the native `title`, so
          // this matches the version indicator it sits next to; `tt-up` because
          // the status bar is at the bottom of the viewport, `tt-multi` because
          // the tip is two lines. The visible text is only the short SHA, so the
          // label carries the same tip to a screen reader.
          <a
            className="sb-build tt tt-up tt-multi"
            href={build.repo ? `https://github.com/${build.repo}/commit/${build.sha}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            data-tip={tip}
            aria-label={tip}
          >
            <Icon name="git-commit" size={12} />
            <span className="sb-build-sha">{build.short}{build.dirty ? '+' : ''}</span>
          </a>
        );
      })()}
      <div className="statusbar-spacer" />
      {toast && <span className="sb-toast"><Icon name="check" size={13} /> {toast}</span>}
      {inSync ? (
        <span className="status-item sync" title={t('statusBar.allCommitted')}>
          <Icon name="check" size={13} /> {t('statusBar.inSync')}
        </span>
      ) : (
        <button
          className={`status-item dirty ${open ? 'active' : ''}`}
          onClick={() => setOpen((v) => !v)}
          title={t('statusBar.viewChanges')}
        >
          <span className="dot" />
          {t('statusBar.notesChanged', { count: n })}
        </button>
      )}
      {/* Last, at the very edge: preferences are the least-used control here and
          the one whose position should never move the two that report state. */}
      {onOpenPreferences && (
        <button
          className="status-item sb-prefs"
          onClick={onOpenPreferences}
          title={t('preferences.open')}
          aria-label={t('preferences.open')}
        >
          <Icon name="settings" size={13} />
        </button>
      )}
    </div>
  );
}
