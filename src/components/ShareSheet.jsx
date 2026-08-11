import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import { usePending, discardMany } from '../lib/pending.js';
import { useShares, getShare, setShare, setUnshared, markActivated, removeShare } from '../lib/shares.js';
import { commitFiles } from '../lib/commit.js';

function newShareId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  return Promise.resolve();
}

// Polls the static page /shared/<id>/ until it is REALLY published by the
// build. `res.ok` is not enough: for a still-nonexistent path Cloudflare may
// respond 200 with a fallback, so we check that the response contains the real
// share page marker (<meta name="x-web-vault-shared">, added in build-shared.mjs).
// Cache-bust + no-store.
const SHARED_MARKER = 'x-web-vault-shared';
async function waitForShared(url, token, { timeoutMs = 240000, intervalMs = 4000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (token.cancelled) return false;
    try {
      const res = await fetch(`${url}?_=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        if (text.includes(SHARED_MARKER)) return true;
      }
    } catch {
      // network error or page not yet available: retry
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// idle | publishing | activating | active | slow | error
export default function ShareSheet({ note }) {
  const pending = usePending();
  const shares = useShares();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmUnshare, setConfirmUnshare] = useState(false);
  const { t } = useTranslation();
  const ref = useRef(null);
  const cancelRef = useRef({ cancelled: false });

  const frontmatterId = note.frontmatter.share_id || null;
  const record = shares[note.path] || null;
  // If there is an in-flight unshare, the note is already "not shared" in the UI.
  const shareId = record?.unshared ? null : (frontmatterId || record?.shareId || null);
  const shareUrl = shareId ? `${window.location.origin}/shared/${shareId}/` : null;
  const modified = !!pending[note.path];

  // Activation polling (used both after the commit and on resume).
  async function runPolling(path, id, token) {
    const url = `${window.location.origin}/shared/${id}/`;
    const live = await waitForShared(url, token);
    if (token.cancelled) return;
    if (live) {
      markActivated(path);
      setPhase('active');
      setCopied(true);
      copyText(url).catch(() => {}); // may fail without a user gesture: the Copy button is there
    } else {
      setPhase('slow');
    }
  }

  // On note change: reset + possible RESUME of the publishing state.
  useEffect(() => {
    cancelRef.current.cancelled = true;
    const token = { cancelled: false };
    cancelRef.current = token;
    setError(null);
    setCopied(false);
    setConfirmUnshare(false);

    const rec = getShare(note.path);
    const fmId = note.frontmatter.share_id || null;

    if (rec?.unshared) {
      // In-flight unshare: when the build removes share_id from the frontmatter,
      // clean up the record (self-heal). Meanwhile it stays "not shared".
      if (!fmId) removeShare(note.path);
      setOpen(false);
      setPhase('idle');
    } else if (rec && fmId && fmId === rec.shareId) {
      // The build caught up: from here it is a normal shared note.
      removeShare(note.path);
      setOpen(false);
      setPhase('idle');
    } else if (rec && !rec.activated) {
      // Publishing still pending: reopen the modal and resume polling.
      setPhase('activating');
      setOpen(true);
      runPolling(note.path, rec.shareId, token);
    } else if (rec && rec.activated) {
      // Already active (link live) but frontmatter not yet updated by the build.
      setPhase('active');
      setOpen(false);
    } else {
      setOpen(false);
      setPhase('idle');
    }
    return () => { token.cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Note shared from frontmatter (build): when you open the sheet it shows "active".
  const effPhase = phase === 'idle' && shareId ? 'active' : phase;
  const activating = effPhase === 'activating' || effPhase === 'publishing';

  const onPublish = async () => {
    const token = cancelRef.current;
    const id = newShareId();
    setError(null);
    setPhase('publishing');
    setOpen(true);
    // Register right away: if you navigate away during the commit, a second
    // share_id is not regenerated and it resumes when you come back.
    setShare(note.path, id, false);
    const entry = { path: note.path, shareId: id };
    if (pending[note.path]) entry.body = pending[note.path].body;
    try {
      await commitFiles({ message: `Publish ${note.title}`, files: [entry] });
      if (token.cancelled) return;
      if (pending[note.path]) discardMany([note.path]);
      setPhase('activating');
      runPolling(note.path, id, token);
    } catch (e) {
      if (token.cancelled) return;
      removeShare(note.path);
      setError(e.message || t('share.publishFailed'));
      setPhase('error');
    }
  };

  const onCopy = () => {
    copyText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const onUnshare = async () => {
    const token = cancelRef.current;
    setConfirmUnshare(false);
    setError(null);
    setPhase('unsharing');
    try {
      await commitFiles({
        message: `Unshare ${note.title}`,
        files: [{ path: note.path, unshare: true }],
      });
      if (token.cancelled) return;
      setUnshared(note.path); // UI: immediately not shared (frontmatter aligns at build)
      setPhase('idle');
      setOpen(false);
    } catch (e) {
      if (token.cancelled) return;
      setError(e.message || t('share.unshareFailed'));
      setPhase('error');
    }
  };

  return (
    <span className="share" ref={ref}>
      <button
        className={`badge share-btn ${open ? 'active' : ''} ${shareId ? 'shared' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={shareId ? t('share.manageLink') : t('share.shareThisNote')}
      >
        {shareId && <span className="share-dot" title={t('share.alreadyShared')} />}
        <Icon name={activating ? 'clock' : 'share'} size={13} />
        {t('share.share')}
      </button>

      {open && (
        <div className="sharesheet">
          {effPhase === 'active' || effPhase === 'activating' || effPhase === 'slow' ? (
            <>
              <div className={`ss-status ${effPhase === 'active' ? 'ok' : 'wait'}`}>
                {effPhase === 'active' ? (
                  <><Icon name="check" size={13} /> {t('share.linkActive')}</>
                ) : effPhase === 'slow' ? (
                  <><Icon name="clock" size={13} /> {t('share.slow')}</>
                ) : (
                  <><span className="spin" /> {t('share.makingPublic')}</>
                )}
              </div>
              <input className="ss-url" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
              {effPhase !== 'active' && (
                <p className="ss-hint">{t('share.copyHint')}</p>
              )}
              <div className="ss-actions">
                <button className="ss-copy" onClick={onCopy}>
                  <Icon name={copied ? 'check' : 'share'} size={13} />
                  {copied ? t('share.copied') : t('share.copyLink')}
                </button>
                {effPhase === 'active' && (
                  <a className="ss-open" href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <Icon name="external" size={13} /> {t('common.open')}
                  </a>
                )}
              </div>
              {effPhase !== 'activating' && (
                confirmUnshare ? (
                  <div className="ss-confirm">
                    <span>{t('share.unshareWarning')}</span>
                    <div className="ss-confirm-actions">
                      <button className="ss-danger" onClick={onUnshare}>{t('share.unshare')}</button>
                      <button className="ss-cancel" onClick={() => setConfirmUnshare(false)}>{t('share.no')}</button>
                    </div>
                  </div>
                ) : (
                  <button className="ss-unshare" onClick={() => setConfirmUnshare(true)}>
                    {t('share.unshare')}
                  </button>
                )
              )}
            </>
          ) : effPhase === 'publishing' || effPhase === 'unsharing' ? (
            <div className="ss-status wait">
              <span className="spin" />
              {effPhase === 'publishing' ? t('share.publishing') : t('share.unsharing')}
            </div>
          ) : effPhase === 'error' ? (
            <>
              <div className="ss-error"><Icon name="x" size={13} /> {error}</div>
              <div className="ss-actions">
                <button className="ss-copy" onClick={onPublish}>{t('common.retry')}</button>
              </div>
            </>
          ) : (
            <>
              <p className="ss-intro">
                {t('share.intro')}
              </p>
              {modified && (
                <p className="ss-note">{t('share.includesUnsaved')}</p>
              )}
              <button className="ss-publish" onClick={onPublish}>
                <Icon name="share" size={13} /> {t('share.share')}
              </button>
            </>
          )}
        </div>
      )}
    </span>
  );
}
