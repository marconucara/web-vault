// Test setup: initialise the UI translation layer, exactly as `main.jsx` does
// for the app (adr/0047-ui-language-i18n-layer.md).
//
// Two reasons this has to exist:
//
//   1. Without it nothing imports `lib/i18n.js`, so the shared i18next instance
//      is never initialised and every `t()` renders its key — component tests
//      would assert against `sidebar.allNotes` instead of "All notes".
//   2. The locales are PINNED rather than detected. Resolution reads the
//      runtime's `navigator`, and node has one: on an Italian machine the suite
//      would render Italian and the gate would fail for a reason that has
//      nothing to do with the change under test. A gate has to give the same
//      answer everywhere (AGENTS.md).
//
// `en-GB` for formatting, not `en`, because that is what the app rendered
// before this layer existed — it keeps the date assertions honest.
import { initI18n } from './lib/i18n.js';

initI18n({ locale: 'en', formatLocale: 'en-GB' });
