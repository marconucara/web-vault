import React, { useEffect, useRef, useState } from 'react';
import { build } from '../content.js';
import { checkForUpdate, releaseUrl, useUpgrade } from '../lib/upgrade.js';

// The WebVault version this site was built with, plus a passive marker when a
// newer one is published (adr/0037-*.md, adr/0038-*.md).
//
// The click means different things in the two states, by design: with nothing
// to report it re-runs the check, and with an update known it opens the panel —
// where re-checking would be pointless, since the answer is already on screen.
export default function VersionIndicator() {
  const { running, latest, available } = useUpgrade();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // One automatic check per page open, itself rate limited to once an hour by
  // the persisted timestamp.
  useEffect(() => {
    checkForUpdate();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // A build predating the version field has nothing to show and nothing to
  // compare (adr/0037-*.md); render nothing rather than an empty chip.
  if (!running) return null;

  const onClick = () => {
    if (available) setOpen((v) => !v);
    // Manual re-check. Refused inside a minute of the last one, silently: the
    // rate limit is not the adopter's problem to solve.
    else checkForUpdate({ force: true });
  };

  return (
    <span className="sb-version-wrap" ref={ref}>
      {open && available && (
        <div className="versionpanel">
          <div className="vp-head">WebVault {latest} is available</div>
          <div className="vp-body">You are running {running}.</div>
          {/* Dismissing means closing this panel — click-outside or Escape —
              not hiding the dot. Suppressing the marker would have to persist
              to be worth anything, and a persisted suppression outlives the
              moment it was clicked in: the adopter loses the one signal that an
              upgrade is waiting, with no way to bring it back. */}
          <div className="vp-actions">
            <a
              className="vp-link"
              href={releaseUrl(latest)}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </div>
        </div>
      )}
      <button
        type="button"
        className={`sb-version${available ? ' has-update' : ''}`}
        onClick={onClick}
        title={
          available
            ? `WebVault ${running} — ${latest} is available`
            : `WebVault ${running} — click to check for updates`
        }
      >
        {available && <span className="sb-version-dot" aria-hidden="true" />}
        v{running}
      </button>
    </span>
  );
}
