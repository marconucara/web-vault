import React from 'react';
import Icon from './Icon.jsx';
import BrandMark from './BrandMark.jsx';

// `types` here is the VISIBLE list (adr/0046): the manager gets the full one, so
// a hidden type can be found and switched back on.
export default function Sidebar({ views, types, typeMeta, counts = /** @type {Record<string, number>} */ ({}), selection, onSelect, onNewType, onEditType, onManageVisibility }) {
  const isSel = (kind, id) => selection.kind === kind && selection.id === id;
  const Count = ({ n }) =>
    n != null ? <span className="count-badge">{n}</span> : null;

  return (
    <nav className="sidebar">
      <div className="brand">
        <BrandMark size={40} />
        <span>WebVault</span>
      </div>

      <div className="group-label">Views</div>
      <button
        className={'nav-item' + (selection.kind === 'all' ? ' active' : '')}
        onClick={() => onSelect({ kind: 'all' })}
      >
        <Icon name="filter" size={15} />
        <span className="nav-label">All notes</span>
        <Count n={counts.all} />
      </button>
      <button
        className={'nav-item' + (selection.kind === 'inbox' ? ' active' : '')}
        onClick={() => onSelect({ kind: 'inbox' })}
      >
        <Icon name="inbox" size={15} />
        <span className="nav-label">Inbox</span>
        <Count n={counts.inbox} />
      </button>
      <button
        className={'nav-item' + (selection.kind === 'shared' ? ' active' : '')}
        onClick={() => onSelect({ kind: 'shared' })}
      >
        <Icon name="share" size={15} />
        <span className="nav-label">Shared</span>
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
        <span>Types</span>
        {/* Both actions in one box, so `space-between` puts the label at one end
            and the pair at the other — with three direct children it would
            spread the eye into the middle of the row instead. Visibility first,
            then create: the order Tolaria uses. */}
        <span className="group-actions">
          {onManageVisibility && (
            <button
              className="group-action"
              onClick={onManageVisibility}
              title="Show or hide types"
              aria-label="Show or hide types"
            >
              <Icon name="toggle-left" size={14} />
            </button>
          )}
          {onNewType && (
            <button className="group-action" onClick={onNewType} title="New type" aria-label="New type">
              <Icon name="plus" size={14} />
            </button>
          )}
        </span>
      </div>
      {types.map((t) => {
        const meta = typeMeta[t] || {};
        return (
          <div key={t} className={'nav-item nav-item-row' + (isSel('type', t) ? ' active' : '')}>
            <button className="nav-main" onClick={() => onSelect({ kind: 'type', id: t })}>
              <Icon name={meta.icon} color={meta.color} size={15} />
              <span className="nav-label">{t}</span>
            </button>
            {/* Edit sits before the badge so the count keeps the right edge it
                holds on every other row; the button occupies the gap the label
                leaves, and is only visible on hover. */}
            {onEditType && (
              <button
                className="nav-edit"
                onClick={() => onEditType(t)}
                title={`Edit ${t}`}
                aria-label={`Edit ${t}`}
              >
                <Icon name="edit" size={13} />
              </button>
            )}
            <Count n={counts[`type:${t}`]} />
          </div>
        );
      })}
    </nav>
  );
}
