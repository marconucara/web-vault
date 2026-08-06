import React, { useEffect, useRef, useState } from 'react';
import { build } from '../content.js';
import { checkForUpdate, releaseUrl, useUpgrade } from '../lib/upgrade.js';
import { loadCapabilities, useCapabilities } from '../lib/capabilities.js';
import { pollForVersion, requestUpgrade } from '../lib/upgradeAction.js';

// The WebVault version this site was built with, plus a passive marker when a
// newer one is published (adr/0037-*.md, adr/0038-*.md).
//
// The click means different things in the two states, by design: with nothing
// to report it re-runs the check, and with an update known it opens the panel —
// where re-checking would be pointless, since the answer is already on screen.
export default function VersionIndicator() {
  const { running, latest, available } = useUpgrade();
  const { canWrite } = useCapabilities();
  const [open, setOpen] = useState(false);
  // 'idle' | 'working' | 'building' | 'live' | 'done' | 'noop' | 'error'
  const [phase, setPhase] = useState('idle');
  const [note, setNote] = useState('');
  const ref = useRef(null);
  const poll = useRef(null);

  // A poll outliving the component would keep fetching against a panel nobody
  // is looking at.
  useEffect(() => () => poll.current?.cancel(), []);

  // One automatic check per page open, itself rate limited to once an hour by
  // the persisted timestamp.
  useEffect(() => {
    checkForUpdate();
    loadCapabilities();
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

  const onUpgrade = async () => {
    if (phase === 'working' || phase === 'building') return;
    setPhase('working');
    setNote('');
    try {
      const res = await requestUpgrade(latest);
      if (res?.noop) {
        setPhase('noop');
        setNote(res.reason || 'nothing to update');
        return;
      }
      // Locally there is no rebuild to wait for: the pin is on disk and the
      // adopter reinstalls when they choose. Waiting would hang on a version
      // this dev server will never report.
      if (res?.local) {
        setPhase('done');
        setNote('The pin is updated. Reinstall to pick it up.');
        return;
      }
      setPhase('building');
      poll.current = pollForVersion(latest);
      const { live } = await poll.current.promise;
      // Not an upgrade failure: the commit landed either way. The rebuild is
      // just taking longer than we are willing to watch, and saying so beats
      // implying it failed.
      setPhase(live ? 'live' : 'done');
      if (!live) setNote('Still building. It will be live shortly.');
    } catch (e) {
      setPhase('error');
      setNote(e?.message || 'The upgrade could not be started.');
    }
  };

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
          {/* Two actions, chosen by what the deployment can actually do
              (adr/0039-*.md). A deployment that can commit can upgrade itself:
              the pin bump is a commit like any other, and the rebuild it
              triggers reinstalls at the new version. One that cannot write is
              offered the release to look at — never an action that would fail
              on click. `canWrite` is false until the probe answers, so the
              safe affordance is what renders first. */}
          {note && <div className="vp-note">{note}</div>}
          <div className="vp-actions">
            {!canWrite ? (
              <a
                className="vp-link"
                href={releaseUrl(latest)}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </a>
            ) : phase === 'live' ? (
              // The new version is served, but THIS page is still the old
              // bundle: only a reload picks it up.
              <button type="button" className="vp-action" onClick={() => window.location.reload()}>
                Reload to finish
              </button>
            ) : phase === 'building' || phase === 'working' ? (
              <span className="vp-status">
                {phase === 'working' ? 'Starting the update…' : 'Updating — this takes a few minutes.'}
              </span>
            ) : phase === 'done' || phase === 'noop' ? null : (
              <button type="button" className="vp-action" onClick={onUpgrade}>
                {phase === 'error' ? 'Try again' : `Update to ${latest}`}
              </button>
            )}
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
