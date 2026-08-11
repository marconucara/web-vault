import React from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import { setLocale, setFormatLocale } from '../lib/i18n.js';
import { setPref, usePrefs } from '../lib/prefs.js';
import { useCapabilities } from '../lib/capabilities.js';
import { FORMAT_LOCALES, SUPPORTED_LOCALES, languageLabel, regionLabel } from '../lib/locale.js';
import { formatSample } from '../lib/formats.js';

// Client preferences (adr/0034-client-settings-modal.md).
//
// Everything here is local to this browser and applies immediately. The modal
// owns the storage (lib/prefs.js) and pushes each change into the translation
// layer, which deliberately persists nothing of its own (adr/0047-*.md).
//
// The commit-disabled notice at the top is NOT a preference and is not
// presented as one: it is information about the deployment, shown only when
// there is something to say, because this is where someone whose editing has
// vanished will look for the reason. There is never a field to enter the token
// — it is a server-side secret and the client must not accept it.

// "System default" is stored as the ABSENCE of a preference, so this value
// only ever exists inside a <select>, never in localStorage. See lib/prefs.js.
const AUTO = '';

export default function Preferences({ onClose }) {
  const { t, i18n } = useTranslation();
  const prefs = usePrefs();
  const { canWrite, known } = useCapabilities();

  // Only a definite "no" speaks. An unanswered endpoint says nothing, rather
  // than accusing a deployment that turns out to write perfectly well.
  const showNotice = known && !canWrite;

  const onLanguage = (value) => {
    setPref('locale', value || null);
    // Applied through the same setters the boot path uses; an empty value
    // re-resolves from the browser, which is what "System default" means.
    setLocale(value || navigatorLanguage());
  };

  const onFormat = (value) => {
    setPref('formatLocale', value || null);
    // `setFormatLocale` falls back to the browser (then the interface language)
    // when handed something it cannot use, so `null` restores exactly the
    // resolution a browser with no stored preference would get.
    setFormatLocale(value || null);
  };

  return (
    <>
      <div className="props-backdrop" onClick={onClose} />
      <aside className="props-panel preferences" role="dialog" aria-label={t('preferences.title')}>
        <header className="props-head">
          <span className="props-title">
            <Icon name="settings" size={15} />
            {t('preferences.title')}
          </span>
          <button className="props-close" onClick={onClose} title={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="props-body">
          {showNotice && (
            <div className="pf-notice" role="status">
              <Icon name="alert" size={15} />
              <div>
                <strong>{t('preferences.readOnlyTitle')}</strong>
                <p>{t('preferences.readOnlyBody')}</p>
              </div>
            </div>
          )}

          <label className="pf-field">
            <span className="pf-label">{t('preferences.language')}</span>
            <select
              className="pf-select"
              value={prefs.locale ?? AUTO}
              onChange={(e) => onLanguage(e.target.value)}
            >
              <option value={AUTO}>{t('preferences.auto')}</option>
              {/* Driven by the shipped catalogues, so adding one is a JSON file
                  and a line in lib/i18n.js — never a change here. */}
              {SUPPORTED_LOCALES.map((code) => (
                <option key={code} value={code}>{languageLabel(code)}</option>
              ))}
            </select>
          </label>

          <label className="pf-field">
            <span className="pf-label">{t('preferences.dateFormat')}</span>
            <select
              className="pf-select"
              value={prefs.formatLocale ?? AUTO}
              onChange={(e) => onFormat(e.target.value)}
            >
              <option value={AUTO}>{t('preferences.auto')}</option>
              {/* Region names are read in the interface language, so this list
                  re-labels when the language changes — while the stored format
                  preference above stays exactly where it was. */}
              {FORMAT_LOCALES.map((tag) => (
                <option key={tag} value={tag}>{formatOptionLabel(tag, i18n.language)}</option>
              ))}
            </select>
          </label>

          <div className="pf-field pf-field-row">
            <span className="pf-label">{t('preferences.showInbox')}</span>
            <button
              type="button"
              className={'tv-toggle' + (prefs.showInbox !== false ? ' on' : '')}
              role="switch"
              aria-checked={prefs.showInbox !== false}
              aria-label={t('preferences.showInbox')}
              onClick={() => setPref('showInbox', prefs.showInbox === false ? null : false)}
            >
              <span className="tv-knob" />
            </button>
          </div>
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

/**
 * The label of one format choice: the region named in the language being read,
 * then what a date and time actually look like under that tag —
 * `United Kingdom — 11 Aug 2026, 14:30`.
 *
 * The two halves are in different languages on purpose. The name only has to
 * identify the entry for someone already reading this interface; the sample is
 * the thing being chosen, so it must be rendered by the entry's own tag. A tag
 * whose region cannot be named falls back to showing the tag.
 * @param {string} tag
 * @param {string} displayIn
 */
export function formatOptionLabel(tag, displayIn) {
  return `${regionLabel(tag, displayIn) || tag} — ${formatSample(tag)}`;
}

/** The browser's own first choice, used to restore "System default". */
function navigatorLanguage() {
  if (typeof navigator === 'undefined') return null;
  return navigator.languages?.[0] || navigator.language || null;
}
