import React from 'react';
import { createRoot } from 'react-dom/client';
import { initI18n } from './lib/i18n.js';
import { getPrefs } from './lib/prefs.js';
import App from './App.jsx';
import './styles.css';

// Resolve the UI language before the first render, so the interface never shows
// one language and then swaps (adr/0047-ui-language-i18n-layer.md).
//
// The stored preferences come from the preferences modal (adr/0034-*.md), which
// owns them; the translation layer keeps no storage of its own. Either value may
// be absent — that is how "System default" is expressed — and resolution
// then falls to the browser's own preferences, with English as the floor.
const prefs = getPrefs();
initI18n({ locale: prefs.locale, formatLocale: prefs.formatLocale });

createRoot(document.getElementById('root')).render(<App />);
