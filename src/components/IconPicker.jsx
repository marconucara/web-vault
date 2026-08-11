import React, { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { iconNames } from 'lucide-react/dynamic';
import Icon from './Icon.jsx';

// Icon picker for the type panel (adr/0045, criterion 11).
//
// The catalogue is the whole lucide set — naming a type is exactly when choice
// matters — but every preview is rendered through `Icon`, the same component the
// sidebar uses. That matters because `Icon` resolves a name through a local
// line-style set FIRST, and about half of those names also exist in lucide
// (`tag`, `user`, `check`, …). Previewing lucide directly would show a glyph the
// app then would not paint. Going through `Icon` makes the preview true by
// construction, whichever layer ends up winning, without narrowing the choice.

const ALL = [...iconNames].sort();
const PAGE = 120; // enough to fill the grid; searching narrows it fast

export default function IconPicker({ value, color, onChange }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const deferred = useDeferredValue(query);

  const matches = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return ALL;
    // Names that start with the query first, then the ones merely containing it:
    // typing "cal" should lead with `calendar`, not `medical-cross`.
    const starts = [];
    const contains = [];
    for (const n of ALL) {
      const i = n.indexOf(q);
      if (i === 0) starts.push(n);
      else if (i > 0) contains.push(n);
    }
    return [...starts, ...contains];
  }, [deferred]);

  const shown = expanded ? matches : matches.slice(0, PAGE);

  return (
    <div className="icon-picker">
      <div className="ip-search">
        <Icon name="search" size={14} />
        <input
          className="ip-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setExpanded(false);
          }}
          placeholder={t('iconPicker.searchPlaceholder', { count: ALL.length })}
          aria-label={t('iconPicker.searchLabel')}
        />
        {value && (
          <button type="button" className="ip-clear tt" onClick={() => onChange('')} data-tip={t('iconPicker.noIcon')} aria-label={t('iconPicker.noIcon')}>
            <Icon name="x" size={13} />
          </button>
        )}
      </div>

      {matches.length === 0 ? (
        <p className="ip-empty">{t('iconPicker.noMatch', { query: deferred.trim() })}</p>
      ) : (
        <>
          <div className="ip-grid" role="listbox" aria-label={t('iconPicker.icons')}>
            {shown.map((n) => (
              <button
                key={n}
                type="button"
                role="option"
                aria-selected={value === n}
                className={'ip-cell' + (value === n ? ' sel' : '')}
                // Native `title`: this grid renders the whole lucide catalogue,
                // so a `::after` per cell is hundreds of pseudo-elements on the
                // heaviest surface in the app (see CONVENTIONS.md, Tooltips).
                title={n}
                onClick={() => onChange(n)}
              >
                {/* Rendered through Icon, so what you see is what the app paints. */}
                <Icon name={n} color={value === n ? color || undefined : undefined} size={17} />
              </button>
            ))}
          </div>
          {!expanded && matches.length > shown.length && (
            <button type="button" className="ip-more" onClick={() => setExpanded(true)}>
              {t('iconPicker.showAll', { count: matches.length })}
            </button>
          )}
        </>
      )}
    </div>
  );
}
