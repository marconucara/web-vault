import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import { commitFiles } from '../lib/commit.js';
import { markCreated, applyLocalEdit } from '../lib/localNotes.js';
import { filesForCreate, filesForVisibility, typeDocContent } from '../lib/typeCommit.js';

// The visibility manager (adr/0046-type-visibility.md).
//
// A menu of its own, next to the Types heading, rather than a field in the type
// panel — because hiding a type removes the sidebar row that is the only route
// to that panel. This list is reachable whatever is hidden, since it does not
// live in the list it filters, and it shows hidden types as a state you can read
// instead of an absence you have to remember.
//
// It governs visibility ONLY: name, icon, colour, order, description and delete
// stay with the panel (criterion 5). No note counts (criterion 11) — the row
// answers "shown or hidden", and a count invites a different question.

export default function TypeVisibility({
  types, // every type name, hidden included, in sidebar order
  typeMeta,
  notes, // live notes, to find the document behind a name
  onClose,
}) {
  // Names with a toggle in flight, so a slow commit cannot be double-fired.
  const [busy, setBusy] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const { t } = useTranslation();

  const toggle = async (name) => {
    if (busy[name]) return;
    const meta = typeMeta[name] || {};
    const nowVisible = meta.visible !== false;
    setError(null);
    setBusy((b) => ({ ...b, [name]: true }));
    try {
      const doc = meta.path ? notes.find((n) => n.path === meta.path) : null;
      if (!doc) {
        // A type only the notes carry has no document to hold the key, so
        // toggling it adopts the type first — the same adoption the panel does
        // when such a type is edited (criterion 8, adr/0045 criterion 4).
        const form = { name, description: '', icon: null, color: null, order: null, visible: nowVisible ? false : true };
        const takenPaths = new Set(notes.map((n) => n.path));
        const { path, files } = filesForCreate(form, takenPaths);
        await commitFiles({ message: messageFor(name, !nowVisible), files });
        markCreated(adoptedDoc(path, form));
      } else {
        const { files } = filesForVisibility({ path: doc.path, visible: !nowVisible });
        await commitFiles({ message: messageFor(name, !nowVisible), files });
        applyLocalEdit(doc, { frontmatter: visiblePatch(doc.frontmatter, !nowVisible) });
      }
    } catch (e) {
      setError(e.message || t('typePanel.saveFailed'));
    } finally {
      setBusy((b) => ({ ...b, [name]: false }));
    }
  };

  return (
    <>
      <div className="props-backdrop" onClick={onClose} />
      <aside className="props-panel type-visibility" role="dialog" aria-label={t('typeVisibility.title')}>
        <header className="props-head">
          <span className="props-title">
            <Icon name="eye" size={15} />
            {t('typeVisibility.title')}
          </span>
          <button className="props-close" onClick={onClose} title={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="props-body">
          {types.length === 0 && <p className="tv-empty">{t('typeVisibility.empty')}</p>}
          {/* The map variable is `name`, not `t`: `t` is the translation function
              in this scope and shadowing it would silently break every label. */}
          {types.map((name) => {
            const meta = typeMeta[name] || {};
            const shown = meta.visible !== false;
            const toggleLabel = t(shown ? 'typeVisibility.hide' : 'typeVisibility.show', { name });
            return (
              <div key={name} className={'tv-row' + (shown ? '' : ' hidden')}>
                <Icon name={meta.icon} color={meta.color} size={15} />
                <span className="tv-name">{name}</span>
                <button
                  type="button"
                  className={'tv-toggle' + (shown ? ' on' : '')}
                  role="switch"
                  aria-checked={shown}
                  aria-label={toggleLabel}
                  title={toggleLabel}
                  disabled={!!busy[name]}
                  onClick={() => toggle(name)}
                >
                  <span className="tv-knob" />
                </button>
              </div>
            );
          })}
          {error && <div className="tp-error tp-error-block">{error}</div>}
        </div>

        <footer className="tp-foot">
          <div className="tp-actions">
            <button className="tp-btn primary" onClick={onClose}>{t('common.done')}</button>
          </div>
        </footer>
      </aside>
    </>
  );
}

// Showing REMOVES the key rather than writing `visible: true`, matching what the
// commit does, so the overlay and the file agree on what a visible type looks
// like: one that says nothing (criterion 7).
function visiblePatch(frontmatter, visible) {
  const fm = { ...(frontmatter || {}) };
  if (visible) delete fm.visible;
  else fm.visible = false;
  return fm;
}

// A local copy of a document just created to hold the visibility of a type the
// notes were carrying, so the sidebar reflects it before the next build.
function adoptedDoc(path, form) {
  const now = Date.now();
  return {
    id: path.replace(/\.md$/, ''),
    path,
    title: form.name,
    type: 'Type',
    frontmatter: {
      type: 'Type',
      ...(form.visible === false ? { visible: false } : {}),
      _organized: true,
    },
    body: `\n# ${form.name}\n`,
    mtime: now,
    ctime: now,
  };
}

function messageFor(name, visible) {
  return visible ? `Show type: ${name}` : `Hide type: ${name}`;
}
