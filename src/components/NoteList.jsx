import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import { lookupTypeMeta } from '../lib/typeMetaContext.jsx';
import { sortNotes } from '../lib/views.js';
import { shortDate, useFormatLocale } from '../lib/formats.js';

// Sortable fields in the dropdown (mapped to the `kind` values of sortNotes in
// lib/views.js). The label is a KEY, resolved at render: a module-level constant
// would freeze the strings at import time, before a locale change can reach them.
const SORT_OPTS = [
  { key: 'modified', labelKey: 'noteList.sortModified' },
  { key: 'created', labelKey: 'noteList.sortCreated' },
  { key: 'title', labelKey: 'noteList.sortTitle' },
  { key: 'status', labelKey: 'noteList.sortStatus' },
];

export default function NoteList({ title, notes, openId, onOpen, onNew, typeMeta }) {
  const { t } = useTranslation();
  const formatLocale = useFormatLocale();
  const fmtDate = (ms) => shortDate(ms, formatLocale);
  // Column-local state: manual sort (null = the selection's natural order) and
  // text search. Both reset when the list changes (title).
  const [sort, setSort] = useState(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Search scope: true = title + content (default), false = title only.
  // Persistent preference: does not reset when the selection changes.
  const [contentScope, setContentScope] = useState(true);
  const sortRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    setSort(null);
    setSortOpen(false);
    setSearchOpen(false);
    setQuery('');
  }, [title]);

  // Close the sort menu on outside click.
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e) => { if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [sortOpen]);

  useEffect(() => { if (searchOpen && searchRef.current) searchRef.current.focus(); }, [searchOpen]);

  const shown = useMemo(() => {
    let out = notes;
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((n) => {
      if ((n.title || '').toLowerCase().includes(q)) return true;
      return contentScope && (n.body || '').toLowerCase().includes(q);
    });
    if (sort) out = sortNotes(out, `${sort.key}:${sort.dir}`);
    return out;
  }, [notes, query, sort, contentScope]);

  const sortKey = sort ? SORT_OPTS.find((o) => o.key === sort.key)?.labelKey : null;
  const sortLabel = sortKey ? t(sortKey) : t('noteList.sort');

  // Row click: asc if not yet sorted by that field, otherwise flip direction.
  const toggleField = (key) => {
    setSort((cur) => (cur && cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setSortOpen(false);
  };

  return (
    <div className="notelist">
      <div className="list-header">
        <span className="list-title">{title}</span>
        <div className="list-actions">
          <div className="sort-wrap" ref={sortRef}>
            <button
              className={'list-btn' + (sort ? ' active' : '')}
              onClick={() => setSortOpen((v) => !v)}
              title={t('noteList.sort')}
            >
              {sort && <span className="sort-dir">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
              <Icon name="sort" size={15} />
              <span className="sort-label">{sortLabel}</span>
            </button>
            {sortOpen && (
              <div className="sort-menu">
                {SORT_OPTS.map((o) => (
                  <div
                    key={o.key}
                    className={'sort-row' + (sort && sort.key === o.key ? ' active' : '')}
                    onClick={() => toggleField(o.key)}
                  >
                    <span className="lbl">{t(o.labelKey)}</span>
                    <span className="sort-dirs">
                      {['asc', 'desc'].map((dir) => (
                        <button
                          key={dir}
                          className={'sort-arrow' + (sort && sort.key === o.key && sort.dir === dir ? ' active' : '')}
                          onClick={(e) => { e.stopPropagation(); setSort({ key: o.key, dir }); setSortOpen(false); }}
                          title={dir === 'asc' ? t('noteList.ascending') : t('noteList.descending')}
                        >
                          {dir === 'asc' ? '↑' : '↓'}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            className={'list-btn icon-only' + (searchOpen ? ' active' : '')}
            onClick={() => setSearchOpen((v) => !v)}
            title={t('noteList.search')}
          >
            <Icon name="search" size={16} />
          </button>
          {onNew && (
            <button
              className="list-btn icon-only"
              onClick={onNew}
              title={t('noteList.newNote')}
              aria-label={t('noteList.newNote')}
            >
              <Icon name="plus" size={16} />
            </button>
          )}
        </div>
        <span className="count-badge">{shown.length}</span>
      </div>

      {searchOpen && (
        <div className="list-search">
          <div className="search-field">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); } }}
              placeholder={t('noteList.searchPlaceholder')}
            />
            <button
              className={'scope-toggle tt' + (contentScope ? ' active' : '')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setContentScope((v) => !v)}
              data-tip={contentScope ? t('noteList.searchContentOn') : t('noteList.searchTitleOnly')}
              aria-label={contentScope ? t('noteList.searchContentOn') : t('noteList.searchTitleOnly')}
            >
              <Icon name="text" size={15} />
            </button>
          </div>
        </div>
      )}

      <ul>
        {shown.map((n) => {
          // Case-insensitive: a note's `type:` may be spelled differently from
          // the Type document that declares it, but it is the same type.
          const meta = lookupTypeMeta(typeMeta, n.type);
          return (
            <li key={n.id}>
              <button
                className={'list-item' + (n.id === openId ? ' active' : '')}
                onClick={() => onOpen(n.id)}
              >
                <div className="item-top">
                  <span className="item-title">{n.title}</span>
                  {n.type && <Icon name={meta.icon} color={meta.color} size={15} />}
                </div>
                {n.snippet && <div className="item-snippet">{n.snippet}</div>}
                <div className="item-dates">
                  <span>{fmtDate(n.mtime)}</span>
                  <span className="created">{t('noteList.createdOn', { date: fmtDate(n.ctime) })}</span>
                </div>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="empty">{t('noteList.empty')}</li>}
      </ul>
    </div>
  );
}
