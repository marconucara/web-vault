import React from 'react';
import { createRoot } from 'react-dom/client';
import { initI18n } from './lib/i18n.js';
import App from './App.jsx';
import './styles.css';

// Resolve the UI language before the first render, so the interface never shows
// one language and then swaps (adr/0047-ui-language-i18n-layer.md).
//
// Nothing is passed here yet: with no host-supplied locale, resolution falls to
// the browser's own preferences, with English as the floor. This is the seam the
// settings modal (adr/0034-*.md) writes through — it will read its stored
// preferences and pass them as `{ locale, formatLocale }`. Storage stays on that
// side of the line; this layer keeps none.
initI18n();

createRoot(document.getElementById('root')).render(<App />);
