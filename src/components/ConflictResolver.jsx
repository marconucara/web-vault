import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import ConflictMerge from './ConflictMerge.jsx';

// Resolution surface for notes that changed elsewhere while they were being
// edited here (adr/0050-*.md).
//
// It opens only when a commit was REFUSED, so nothing has been written and every
// draft is intact. That is why it can afford to interrupt: the user asked to
// save, the save did not happen, and the choice is theirs to make.
//
// Two panels, not a merge. The left one holds the local text and is editable —
// it is what gets committed. The right one is what the branch holds now, read
// only. Nothing is merged automatically and nothing is discarded: the user edits
// the left panel until it says what they want, note by note, and commits.
//
// The note list is always there, even for a single note, and always the width of
// the app's own sidebar. What is being resolved, and how much is left, is a
// property of the batch — not something the layout should reveal only once it
// happens to be plural.
export default function ConflictResolver({ drifted, local, onResolve, onCancel }) {
  const { t } = useTranslation();

  // The editable left-hand text, per path. Seeded with what the user wrote, so
  // doing nothing and committing keeps their own version.
  const [texts, setTexts] = useState(() =>
    Object.fromEntries(drifted.map((d) => [d.path, local[d.path] ?? '']))
  );
  // Always land on a note: the list orients, it is not a gate to get past. The
  // one it lands on counts as seen, so a single note needs no extra click.
  const [openPath, setOpenPath] = useState(() => drifted[0]?.path ?? null);
  const [reviewed, setReviewed] = useState(() => new Set(drifted[0] ? [drifted[0].path] : []));

  const current = drifted.find((d) => d.path === openPath) || null;
  const allReviewed = drifted.every((d) => reviewed.has(d.path));

  const open = (path) => {
    // Opening a note is what "reviewed" means: it has been seen, and its text is
    // whatever the user left in the panel.
    setOpenPath(path);
    setReviewed((prev) => new Set(prev).add(path));
  };

  const commit = () => {
    // Each resolution is committed against the SHA that was shown, so the retry
    // is not immediately refused by the same drift it just resolved.
    onResolve(
      drifted.map((d) => ({ path: d.path, body: texts[d.path] ?? '', baseSha: d.remoteSha }))
    );
  };

  return (
    <div className="conflict-modal" role="dialog" aria-modal="true" aria-label={t('conflict.title')}>
        <header className="conflict-head">
          <span className="conflict-title">
            <Icon name="alert" size={15} />
            {t('conflict.title')}
          </span>
          {/* Same action as the footer's: closing without saving is the only
              non-destructive way out, so the two must not differ. */}
          <button
            className="props-close tt"
            onClick={onCancel}
            data-tip={t('conflict.cancel')}
            aria-label={t('conflict.cancel')}
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="conflict-main">
          {/* One scrolling column: the explanation is the head of the list, not
              a separate pane above it, so there is a single thing to scroll. */}
          <aside className="conflict-side">
            <p className="conflict-lead">
              {t('conflict.lead', { count: drifted.length })}
              <span className="conflict-reassure">{t('conflict.reassure')}</span>
            </p>
            <ul className="conflict-list">
              {drifted.map((d) => (
                <li key={d.path}>
                  <button
                    className={`conflict-item${d.path === openPath ? ' is-open' : ''}`}
                    onClick={() => open(d.path)}
                    title={d.path}
                  >
                    <Icon name={reviewed.has(d.path) ? 'check' : 'file-text'} size={14} />
                    <span className="conflict-item-path">{d.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {current && (
            <div className="conflict-body">
              <div className="conflict-panes">
              <div className="conflict-pane-heads">
                <span className="conflict-pane-head">
                  {t('conflict.mine')}
                  <em>{t('conflict.mineHint')}</em>
                </span>
                <span className="conflict-pane-head">
                  {t('conflict.theirs')}
                  <em>{t('conflict.theirsHint')}</em>
                </span>
              </div>
              <ConflictMerge
                key={current.path}
                value={texts[current.path] ?? ''}
                remote={current.remote}
                onChange={(v) => setTexts((prev) => ({ ...prev, [current.path]: v }))}
              />
            </div>
            </div>
          )}
        </div>

        <footer className="conflict-actions">
          <button className="link-btn" onClick={onCancel}>
            {t('conflict.cancel')}
          </button>
          <span className="spacer" />
          <button className="sp-commit" onClick={commit} disabled={!allReviewed}>
            {t('conflict.commitResolved')}
          </button>
        </footer>
    </div>
  );
}
