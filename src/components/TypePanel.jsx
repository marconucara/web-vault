import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import IconPicker from './IconPicker.jsx';
import { commitFiles } from '../lib/commit.js';
import { markCreated, applyLocalEdit, dropLocal } from '../lib/localNotes.js';
import { markDeleted } from '../lib/deleted.js';
import { sameTypeName, typeNameTaken } from '../lib/types.js';
import {
  filesForCreate,
  filesForDelete,
  filesForEdit,
  messageFor,
  typeDocContent,
} from '../lib/typeCommit.js';

// Create/edit panel for a note type (adr/0045-manage-types-from-the-ui.md).
// One form serves both: creating writes a new Type document, editing updates the
// one behind the selected type. A type the notes carry with no document behind
// it opens here too, with its name filled and the rest defaulted — saving gives
// it a document rather than colliding with it (criteria 5, 8).

const COLORS = [
  { key: 'typePanel.colorBlue', value: '#3b82f6' },
  { key: 'typePanel.colorGreen', value: '#22c55e' },
  { key: 'typePanel.colorAmber', value: '#f59e0b' },
  { key: 'typePanel.colorRed', value: '#ef4444' },
  { key: 'typePanel.colorPurple', value: '#a855f7' },
  { key: 'typePanel.colorPink', value: '#ec4899' },
  { key: 'typePanel.colorTeal', value: '#14b8a6' },
  { key: 'typePanel.colorSlate', value: '#64748b' },
];

export default function TypePanel({
  mode, // 'create' | 'edit'
  typeName, // the type being edited (null when creating)
  meta, // its metadata, when a document declares it
  doc, // the Type document note, when one exists
  declared, // Set of declared type names, for the uniqueness check
  notes, // live notes, to count the carriers and rewrite them on rename
  onClose,
  onRenamed, // (newName) => void, so the sidebar selection follows the rename
  onDeleted,
}) {
  const { t } = useTranslation();
  const editing = mode === 'edit';
  const [name, setName] = useState(typeName || '');
  const [description, setDescription] = useState(() => docDescription(doc));
  const [icon, setIcon] = useState(meta?.icon || '');
  const [color, setColor] = useState(meta?.color || '');
  const [order, setOrder] = useState(meta?.order ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Notes standing in the way of a delete, and following a rename (criteria 7, 9).
  const carriers = useMemo(
    () => notes.filter((n) => n.type !== 'Type' && sameTypeName(n.type, typeName)),
    [notes, typeName]
  );

  const trimmed = name.trim();
  // Uniqueness is against DECLARED types only, excluding the one being edited:
  // adopting a type the notes already use is the point, not a collision.
  const taken = typeNameTaken(trimmed, declared, editing ? typeName : null);
  const nameError = !trimmed
    ? t('typePanel.nameRequired')
    : taken
      ? t('typePanel.nameTaken', { name: trimmed })
      : null;
  const canSave = !nameError && !busy;

  const save = async () => {
    if (!canSave) return;
    setError(null);
    setBusy(true);
    const form = { name: trimmed, description, icon, color, order: order === '' ? null : Number(order) };
    const takenPaths = new Set(notes.map((n) => n.path));
    try {
      if (!editing || !doc) {
        // Creating, including adopting a type only the notes carry.
        const { path, files } = filesForCreate(form, takenPaths);
        await commitFiles({ message: messageFor('create', form.name), files });
        markCreated(typeNoteFor(path, form));
      } else {
        const renaming = !sameTypeName(form.name, typeName);
        const { path, files } = filesForEdit({ form, doc: { name: typeName, path: doc.path }, notes, takenPaths });
        await commitFiles({
          message: renaming
            ? messageFor('rename', typeName, { to: form.name, carriers: carriers.length })
            : messageFor('update', form.name),
          files,
        });
        if (renaming) {
          // The document moved: the old one is gone, the new one is a creation,
          // and every carrying note now reads the new type. All of it has to be
          // visible before the next build (criteria 13-14).
          if (path !== doc.path) {
            markDeleted(doc.path);
            markCreated(typeNoteFor(path, form));
          } else {
            applyLocalEdit(doc, typeDocPatch(doc, form));
          }
          for (const n of carriers) {
            applyLocalEdit(n, { type: form.name, frontmatter: { ...n.frontmatter, type: form.name } });
          }
          onRenamed?.(form.name);
        } else {
          applyLocalEdit(doc, typeDocPatch(doc, form));
        }
      }
      onClose?.();
    } catch (e) {
      setError(e.message || t('typePanel.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || carriers.length || !doc) return;
    setError(null);
    setBusy(true);
    try {
      await commitFiles({ message: messageFor('delete', typeName), files: filesForDelete({ path: doc.path }).files });
      markDeleted(doc.path);
      dropLocal([doc.id]);
      onDeleted?.();
      onClose?.();
    } catch (e) {
      setError(e.message || t('properties.deleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="props-backdrop" onClick={onClose} />
      <aside
        className="props-panel type-panel"
        role="dialog"
        aria-label={editing ? t('typePanel.editTitle') : t('typePanel.newTitle')}
      >
        <header className="props-head">
          <span className="props-title">
            <Icon name={icon || 'tag'} color={color || undefined} size={15} />
            {editing ? t('typePanel.editTitle') : t('typePanel.newTitle')}
          </span>
          <button className="props-close" onClick={onClose} title={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="props-body">
          <label className="tp-field">
            <span className="tp-label">{t('typePanel.name')}</span>
            <input
              ref={nameRef}
              className="tp-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('typePanel.namePlaceholder')}
              aria-invalid={!!nameError}
            />
            {name.trim() && nameError && <span className="tp-error">{nameError}</span>}
          </label>

          <label className="tp-field">
            <span className="tp-label">{t('typePanel.description')}</span>
            <textarea
              className="tp-input tp-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('typePanel.descriptionPlaceholder')}
            />
            <span className="tp-hint">{t('typePanel.descriptionHint')}</span>
          </label>

          <div className="tp-field">
            <span className="tp-label">{t('typePanel.icon')}</span>
            <IconPicker value={icon} color={color} onChange={setIcon} />
          </div>

          <div className="tp-field">
            <span className="tp-label">{t('typePanel.colour')}</span>
            <div className="tp-swatches">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={'tp-swatch' + (color === c.value ? ' sel' : '')}
                  style={{ background: c.value }}
                  title={t(c.key)}
                  aria-label={t(c.key)}
                  aria-pressed={color === c.value}
                  onClick={() => setColor(color === c.value ? '' : c.value)}
                />
              ))}
            </div>
          </div>

          <label className="tp-field">
            <span className="tp-label">{t('typePanel.order')}</span>
            <input
              className="tp-input tp-order"
              value={order}
              onChange={(e) => setOrder(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              placeholder={t('typePanel.orderPlaceholder')}
            />
            <span className="tp-hint">{t('typePanel.orderHint')}</span>
          </label>

          {error && <div className="tp-error tp-error-block">{error}</div>}
        </div>

        <footer className="tp-foot">
          {editing && (
            <div className="tp-delete">
              {carriers.length > 0 ? (
                // Criterion 9: blocked while notes carry it, and it says how many.
                <span className="tp-blocked" title={t('typePanel.blockedTip')}>
                  <Icon name="trash" size={14} />
                  {t('typePanel.inUse', { count: carriers.length })}
                </span>
              ) : confirmingDelete ? (
                <>
                  <button className="tp-btn danger" onClick={remove} disabled={busy}>
                    {t('typePanel.deleteType')}
                  </button>
                  <button className="tp-btn ghost" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                    {t('common.cancel')}
                  </button>
                </>
              ) : (
                <button className="tp-btn ghost danger-text" onClick={() => setConfirmingDelete(true)} disabled={busy || !doc}>
                  <Icon name="trash" size={14} /> {t('common.delete')}
                </button>
              )}
            </div>
          )}
          <div className="tp-actions">
            <button className="tp-btn ghost" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
            <button className="tp-btn primary" onClick={save} disabled={!canSave}>
              {busy ? t('typePanel.saving') : editing ? t('common.save') : t('typePanel.createType')}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

// The description is the document's body below the H1 — the one field with no
// consumer inside the app, authored and displayed only here.
function docDescription(doc) {
  if (!doc?.body) return '';
  return doc.body.replace(/^\s*#[ \t]+.*(\r?\n)?/, '').trim();
}

// A local copy of a just-written Type document, so the sidebar reflects it
// before the next build.
function typeNoteFor(path, form) {
  const now = Date.now();
  return {
    id: path.replace(/\.md$/, ''),
    path,
    title: form.name,
    type: 'Type',
    frontmatter: {
      type: 'Type',
      ...(form.icon ? { icon: form.icon } : {}),
      ...(form.color ? { color: form.color } : {}),
      ...(form.order != null ? { order: form.order } : {}),
      _organized: true,
    },
    body: typeDocContent(form).split(/\n---\n/).slice(1).join('\n---\n'),
    mtime: now,
    ctime: now,
  };
}

// The in-place patch for an edited document: the panel's keys plus the body it
// owns. Keys the panel does not know about are not here — they live in the file
// and the commit endpoint leaves them alone (criterion 6).
function typeDocPatch(doc, form) {
  const fm = { ...(doc.frontmatter || {}) };
  if (form.icon) fm.icon = form.icon;
  else delete fm.icon;
  if (form.color) fm.color = form.color;
  else delete fm.color;
  if (form.order != null) fm.order = form.order;
  else delete fm.order;
  return {
    title: form.name,
    frontmatter: fm,
    body: `\n# ${form.name}\n${form.description.trim() ? `\n${form.description.trim()}\n` : ''}`,
  };
}
