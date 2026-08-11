import React from 'react';
import { useTranslation } from 'react-i18next';

// The fallback is a function component so it can use the translation hook: the
// boundary itself must stay a class (only classes catch render errors), and a
// class cannot subscribe to a locale change.
function ChunkError() {
  const { t } = useTranslation();
  return (
    <div className="chunk-error" role="alert">
      <p>{t('chunkError.title')}</p>
      <p className="chunk-error-hint">{t('chunkError.hint')}</p>
      <button type="button" onClick={() => window.location.reload()}>
        {t('chunkError.reload')}
      </button>
    </div>
  );
}

// Error boundary for the lazily-loaded chunks (map view, block editor).
//
// A deploy publishes freshly content-hashed chunks and drops the previous ones.
// A tab that was already open still holds the OLD entry bundle in memory, with
// the old chunk names compiled into it, so the next `import()` it makes asks the
// server for a file that no longer exists: 404, rejected promise, and — with no
// boundary — React unmounts the tree to a blank screen. Correct cache headers on
// the HTML entry (see scripts/build-headers.mjs) stop the NEXT navigation from
// starting out stale, but they cannot rescue a tab that is already running the
// previous build. Only catching it here can.
//
// The recovery is deliberately a manual reload, not an automatic one: reloading
// under the user replaces the page, and the editor's unsaved draft lives in the
// tree we would be discarding.
//
// Copy: this is about the VAULT'S CONTENT having moved on, not about a new
// web-vault release. The upgrade notice (adr/0038-in-app-upgrade-notice.md)
// already owns "a new version is available" bottom-left; reusing that wording
// here would make two unrelated events look like the same one. Proactive
// detection of the same situation belongs to adr/0030-background-freshness-detection.md,
// which this does not implement — this is only the reactive backstop.
export default class ChunkBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Keep the real reason in the console; the surface above stays plain.
    console.error('[chunk] failed to load a deferred part of the app', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <ChunkError />;
  }
}
