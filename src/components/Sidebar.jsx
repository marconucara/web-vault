import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import BrandMark from './BrandMark.jsx';
import { writeActionProps } from '../lib/writeAction.js';

// `types` here is the VISIBLE list (adr/0046): the manager gets the full one, so
// a hidden type can be found and switched back on.
export default function Sidebar({ views, types, typeMeta, counts = /** @type {Record<string, number>} */ ({}), selection, showInbox = true, onSelect, onNewType, onEditType, onManageVisibility, writeState = /** @type {'on' | 'off' | 'pending'} */ ('pending') }) {
  const { t } = useTranslation();
  // Named for the state, not for the fix: what a commit action says when the
  // deployment has confirmed it cannot write. The reason lives in preferences,
  // where the full notice already is (adr/0034 criterion 12).
  const offTip = t('preferences.readOnlyTitle');
  const isSel = (kind, id) => selection.kind === kind && selection.id === id;
  const Count = ({ n }) =>
    n != null ? <span className="count-badge">{n}</span> : null;

  return (
    <nav className="sidebar">
      <div className="brand">
        <BrandMark size={40} />
        <span>WebVault</span>
      </div>

      <div className="group-label">{t('sidebar.viewsGroup')}</div>
      <button
        className={'nav-item' + (selection.kind === 'all' ? ' active' : '')}
        onClick={() => onSelect({ kind: 'all' })}
      >
        <Icon name="filter" size={15} />
        <span className="nav-label">{t('views.allNotes')}</span>
        <Count n={counts.all} />
      </button>
      {/* Opt-out for vaults that do not use `_organized` (adr/0034 criterion 7),
          which is what made 0033's always-on rule provisional. Only the row goes:
          an Inbox list already open keeps working, exactly as a hidden type's
          list does (adr/0046) — navigating away is what makes it unreachable,
          which is the point of having hidden it. */}
      {showInbox && (
        <button
          className={'nav-item' + (selection.kind === 'inbox' ? ' active' : '')}
          onClick={() => onSelect({ kind: 'inbox' })}
        >
          <Icon name="inbox" size={15} />
          <span className="nav-label">{t('views.inbox')}</span>
          <Count n={counts.inbox} />
        </button>
      )}
      <button
        className={'nav-item' + (selection.kind === 'shared' ? ' active' : '')}
        onClick={() => onSelect({ kind: 'shared' })}
      >
        <Icon name="share" size={15} />
        <span className="nav-label">{t('views.shared')}</span>
        <Count n={counts.shared} />
      </button>
      {views.length > 0 && <div className="nav-sep" />}
      {views.map((v) => (
        <button
          key={v.id}
          className={'nav-item' + (isSel('view', v.id) ? ' active' : '')}
          onClick={() => onSelect({ kind: 'view', id: v.id })}
        >
          <Icon name="filter" size={15} />
          <span className="nav-label">{v.name || v.id}</span>
          <Count n={counts[`view:${v.id}`]} />
        </button>
      ))}

      <div className="group-label group-label-row">
        <span>{t('sidebar.typesGroup')}</span>
        {/* Both actions in one box, so `space-between` puts the label at one end
            and the pair at the other — with three direct children it would
            spread the eye into the middle of the row instead. Visibility first,
            then create: the order Tolaria uses. */}
        {/* Both actions are always rendered, inert until write access is
            confirmed (adr/0034 criteria 11-12). They used to be withheld, which
            made this heading grow when the answer landed and pushed every type
            row below it down. */}
        <span className="group-actions">
          <button
            {...writeActionProps(writeState, onManageVisibility, t('sidebar.showOrHideTypes'), offTip, 'group-action')}
          >
            <Icon name="toggle-left" size={14} />
          </button>
          <button
            {...writeActionProps(writeState, onNewType, t('sidebar.newType'), offTip, 'group-action')}
          >
            <Icon name="plus" size={14} />
          </button>
        </span>
      </div>
      {/* The map variable is `name`, not `t`: `t` is the translation function in
          this scope and shadowing it here would silently break every label. */}
      {types.map((name) => {
        const meta = typeMeta[name] || {};
        return (
          <div key={name} className={'nav-item nav-item-row' + (isSel('type', name) ? ' active' : '')}>
            <button className="nav-main" onClick={() => onSelect({ kind: 'type', id: name })}>
              <Icon name={meta.icon} color={meta.color} size={15} />
              <span className="nav-label">{name}</span>
            </button>
            {/* Edit sits before the badge so the count keeps the right edge it
                holds on every other row; the button occupies the gap the label
                leaves, and is only visible on hover. */}
            <button
              {...writeActionProps(writeState, () => onEditType(name), t('sidebar.editType', { name }), offTip, 'nav-edit')}
            >
              <Icon name="edit" size={13} />
            </button>
            <Count n={counts[`type:${name}`]} />
          </div>
        );
      })}
    </nav>
  );
}
