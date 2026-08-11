import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from '../lib/i18n.js';
import { clockTime, numericDate, useFormatLocale } from '../lib/formats.js';
import { build } from '../content.js';
import { OUTCOME, checkForUpdate, releaseUrl, useUpgrade } from '../lib/upgrade.js';
import { loadCapabilities, useCapabilities } from '../lib/capabilities.js';
import { pollForVersion, requestUpgrade } from '../lib/upgradeAction.js';
import Icon from './Icon.jsx';

// The WebVault version this site was built with, plus a passive marker when a
// newer one is published (adr/0037-*.md, adr/0038-*.md).
//
// The click means different things in the two states, by design: with nothing
// to report it re-runs the check, and with an update known it opens the panel —
// where re-checking would be pointless, since the answer is already on screen.

// A check that answers in 80ms would otherwise flash a spinner too briefly to
// register, leaving the adopter where they started: unsure whether the click
// did anything. Holding the pending state to a floor makes the fast path — the
// common one, since the answer is usually cached — read as a check that ran
// rather than as a glitch. Long enough to see, short enough not to feel stalled.
const PENDING_MIN_MS = 450;
// The up-to-date answer is a confirmation, not a status: it clears itself and
// leaves the resting indicator behind (adr/0038-*.md AC9). A standing "you are
// current" badge would be lit ~always and would say nothing.
const CONFIRM_MS = 2600;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Relative under an hour, absolute beyond it — the ADR left this open. Under an
// hour "12 minutes ago" is the useful form and a clock time makes the reader do
// arithmetic; beyond it the arithmetic stops being worth it and a time (or a
// date) is what people actually want to know.
//
// `t` and `locale` are parameters with defaults rather than hook reads, because
// this is exported and exercised directly as a pure function.
export function lastCheckedLabel(at, now = Date.now(), { t = i18next.t, locale = undefined } = {}) {
  if (!at) return t('version.notCheckedYet');
  const ms = Math.max(0, now - at);
  if (ms < 60 * 1000) return t('version.checkedJustNow');
  if (ms < 60 * 60 * 1000) {
    return t('version.checkedMinutesAgo', { count: Math.round(ms / 60000) });
  }
  const time = clockTime(at, locale);
  const sameDay = new Date(now).toDateString() === new Date(at).toDateString();
  return sameDay
    ? t('version.checkedAtTime', { time })
    : t('version.checkedOnDate', { date: numericDate(at, locale), time });
}

export default function VersionIndicator() {
  const { running, latest, available, checkedAt } = useUpgrade();
  const { canWrite } = useCapabilities();
  const { t } = useTranslation();
  const formatLocale = useFormatLocale();
  const checkedLabel = (at) => lastCheckedLabel(at, Date.now(), { t, locale: formatLocale });
  const [open, setOpen] = useState(false);
  // 'idle' | 'working' | 'building' | 'live' | 'done' | 'noop' | 'error'
  const [phase, setPhase] = useState('idle');
  const [note, setNote] = useState('');
  // The manual check's own visible state, separate from `phase` (which belongs
  // to the upgrade action): 'idle' | 'pending' | 'confirmed' | 'failed'.
  const [check, setCheck] = useState('idle');
  const ref = useRef(null);
  const poll = useRef(null);
  const confirmTimer = useRef(null);
  const alive = useRef(true);

  // A poll outliving the component would keep fetching against a panel nobody
  // is looking at.
  useEffect(() => () => poll.current?.cancel(), []);

  // The confirmation clears on a timer, so both it and any in-flight check have
  // to stop caring once this unmounts.
  useEffect(() => () => {
    alive.current = false;
    clearTimeout(confirmTimer.current);
  }, []);

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
        setNote(res.reason || t('version.nothingToUpdate'));
        return;
      }
      // Locally there is no rebuild to wait for: the pin is on disk and the
      // adopter reinstalls when they choose. Waiting would hang on a version
      // this dev server will never report.
      if (res?.local) {
        setPhase('done');
        setNote(t('version.pinUpdated'));
        return;
      }
      setPhase('building');
      poll.current = pollForVersion(latest);
      const { live } = await poll.current.promise;
      // Not an upgrade failure: the commit landed either way. The rebuild is
      // just taking longer than we are willing to watch, and saying so beats
      // implying it failed.
      setPhase(live ? 'live' : 'done');
      if (!live) setNote(t('version.stillBuilding'));
    } catch (e) {
      setPhase('error');
      setNote(e?.message || t('version.upgradeFailed'));
    }
  };

  // The manual re-check, and the case this whole indicator exists to serve: an
  // adopter who is already current clicking to make sure. It must be visible
  // from click to answer (adr/0038-*.md AC9) — a check that silently finds
  // nothing is indistinguishable from a button that does nothing, which is
  // exactly what this replaced.
  //
  // All three paths land here identically: fetched, refused by the throttle
  // (the store answers from the last check), or failed. The refusal is not
  // called out — see checkForUpdate.
  const runCheck = async () => {
    if (check === 'pending') return;
    clearTimeout(confirmTimer.current);
    setCheck('pending');
    // Both are started before awaiting either: the floor runs alongside the
    // fetch rather than after it, so a slow check is not further delayed by it.
    const [outcome] = await Promise.all([
      checkForUpdate({ force: true }),
      wait(PENDING_MIN_MS),
    ]);
    if (!alive.current) return;
    if (outcome === OUTCOME.failed) {
      // Not an error to act on (AC6): the absence of the confirmation IS the
      // message. Saying "up to date" here would assert what the check failed to
      // establish.
      setCheck('failed');
      confirmTimer.current = setTimeout(() => alive.current && setCheck('idle'), CONFIRM_MS);
      return;
    }
    setCheck('confirmed');
    confirmTimer.current = setTimeout(() => alive.current && setCheck('idle'), CONFIRM_MS);
  };

  const onClick = () => {
    // With an update known, the answer is already on screen: the click opens
    // the panel instead, and re-checking would tell the adopter nothing new.
    if (available) setOpen((v) => !v);
    else runCheck();
  };

  // Leads with the answer, not with the version: the version is rendered right
  // beside the tooltip, so repeating it spends the first half of the line on
  // something already on screen. Last-check time is of the last SUCCESSFUL
  // check (AC11) — a failed attempt must not age the timestamp into looking
  // fresh.
  const tip =
    check === 'pending'
      ? t('version.checking')
      : check === 'failed'
        ? t('version.checkFailed')
        : available
          ? t('version.availableTip', { version: latest, checked: checkedLabel(checkedAt) })
          : t('version.upToDateTip', { checked: checkedLabel(checkedAt) });

  return (
    <span className="sb-version-wrap" ref={ref}>
      {open && available && (
        <div className="versionpanel">
          <div className="vp-head">{t('version.panelHead', { version: latest })}</div>
          <div className="vp-body">{t('version.panelBody', { version: running })}</div>
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
                {t('version.viewOnGitHub')}
              </a>
            ) : phase === 'live' ? (
              // The new version is served, but THIS page is still the old
              // bundle: only a reload picks it up.
              <button type="button" className="vp-action" onClick={() => window.location.reload()}>
                {t('version.reloadToFinish')}
              </button>
            ) : phase === 'building' || phase === 'working' ? (
              <span className="vp-status">
                {phase === 'working' ? t('version.starting') : t('version.updating')}
              </span>
            ) : phase === 'done' || phase === 'noop' ? null : (
              <button type="button" className="vp-action" onClick={onUpgrade}>
                {phase === 'error' ? t('version.tryAgain') : t('version.updateTo', { version: latest })}
              </button>
            )}
          </div>
        </div>
      )}
      {/* The in-app tooltip (`.tt` + `data-tip`), not the native `title`:
          consistent with the rest of the app, and it opens upward because this
          sits in the status bar at the bottom of the viewport, where a
          downward one would be cut off (adr/0038-*.md AC11). */}
      <button
        type="button"
        className={`sb-version tt tt-up${available ? ' has-update' : ''}${
          check === 'confirmed' ? ' is-confirmed' : ''
        }`}
        onClick={onClick}
        data-tip={tip}
        // The label replaces the visible text for a screen reader rather than
        // sitting beside it, so it keeps the version the tooltip can leave out.
        aria-label={t('version.indicatorLabel', { version: running, tip })}
      >
        {available && <span className="sb-version-dot" aria-hidden="true" />}
        v{running}
        {/* Exactly one of these renders: the check has one visible state at a
            time, and the outcome replaces the pending state rather than
            joining it. */}
        {check === 'pending' ? (
          <span className="sb-version-spin" aria-hidden="true" />
        ) : check === 'confirmed' ? (
          <Icon name="check" size={12} />
        ) : check === 'failed' ? (
          <span className="sb-version-failed">{t('version.checkFailedShort')}</span>
        ) : null}
      </button>
    </span>
  );
}
