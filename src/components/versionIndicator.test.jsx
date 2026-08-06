// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The indicator's two states are driven by the store; stub it so each case
// states the situation directly rather than driving a fetch.
let upgrade = { running: '0.6.1', latest: '', available: false, checkedAt: 0 };
const OUTCOME = { checked: 'checked', failed: 'failed' };
const checkForUpdate = vi.fn().mockResolvedValue(OUTCOME.checked);

vi.mock('../lib/upgrade.js', () => ({
  OUTCOME,
  useUpgrade: () => upgrade,
  checkForUpdate: (...a) => checkForUpdate(...a),
  releaseUrl: (v) => `https://github.com/marconucara/web-vault/tree/v${v}`,
}));

// Whether the deployment can write decides which action the panel offers, so it
// is stated per case exactly like the upgrade state (adr/0039-*.md).
let caps = { canWrite: false, known: true };
vi.mock('../lib/capabilities.js', () => ({
  useCapabilities: () => caps,
  loadCapabilities: vi.fn(),
}));
vi.mock('../lib/upgradeAction.js', () => ({
  requestUpgrade: vi.fn(),
  pollForVersion: vi.fn(),
}));

// Opts React into act() support for the DOM-driven cases below; without it
// every interaction logs a warning that buries real output.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { default: VersionIndicator, lastCheckedLabel } = await import('./VersionIndicator.jsx');

const render = () => renderToStaticMarkup(<VersionIndicator />);

beforeEach(() => {
  upgrade = { running: '0.6.1', latest: '', available: false, checkedAt: 0 };
  caps = { canWrite: false, known: true };
  checkForUpdate.mockClear();
  checkForUpdate.mockResolvedValue(OUTCOME.checked);
});
afterEach(() => vi.restoreAllMocks());

describe('version indicator', () => {
  it('shows the running version with no dot when up to date', () => {
    const html = render();
    expect(html).toContain('v0.6.1');
    expect(html).not.toContain('sb-version-dot');
    expect(html).not.toContain('has-update');
  });

  it('marks an available update on the indicator', () => {
    upgrade = { running: '0.6.1', latest: '0.7.0', available: true, checkedAt: 1 };
    const html = render();
    expect(html).toContain('sb-version-dot');
    expect(html).toContain('has-update');
    // The indicator itself still states what is RUNNING; the new version is
    // named in the tooltip and in the panel, not in place of it.
    expect(html).toContain('v0.6.1');
    expect(html).toContain('0.7.0 is available');
  });

  it('renders nothing when the build predates the version field', () => {
    // adr/0037-*.md: no frameworkVersion means nothing to show and nothing to
    // compare. An empty chip would be worse than no chip.
    upgrade = { running: '', latest: '0.7.0', available: true, checkedAt: 1 };
    expect(render()).toBe('');
  });

  it('is a button, not a link: the version has nowhere to navigate to', () => {
    const html = render();
    expect(html).toContain('<button');
    expect(html).not.toContain('<a ');
  });

  it('uses the in-app tooltip, not the native title', () => {
    // The other status-bar items still use `title`; this one carries the
    // last-check time and reads as the app's own tooltip (adr/0038-*.md AC11).
    const html = render();
    expect(html).toContain('data-tip');
    expect(html).toContain('class="sb-version tt tt-up"');
    expect(html).not.toContain('title=');
  });

  it('leads the tooltip with the answer, not with the version', () => {
    // The version is rendered right beside the tooltip; repeating it there
    // spends the first half of the line on something already on screen.
    upgrade = { running: '0.6.1', latest: '', available: false, checkedAt: Date.now() - 5 * 60_000 };
    const html = render();
    expect(html).toContain('data-tip="Up to date · checked 5 minutes ago"');
    // A screen reader gets the label INSTEAD of the visible text, so that one
    // still has to name the version.
    expect(html).toContain('aria-label="WebVault 0.6.1 — Up to date');
  });

  it('says so plainly when no check has succeeded yet', () => {
    expect(render()).toContain('not checked yet');
  });

  it('offers no action that suppresses the marker', () => {
    // Dismissing means closing the panel (click-outside or Escape), not hiding
    // the dot. A suppression would have to persist to be worth anything, and a
    // persisted one outlives the moment it was clicked in — the adopter would
    // lose the only signal that an upgrade is waiting, with no way back.
    upgrade = { running: '0.6.1', latest: '0.7.0', available: true, checkedAt: 1 };
    expect(render()).not.toMatch(/dismiss/i);
  });

  it('does not open the panel unprompted when an update exists', () => {
    // The notice is passive (adr/0038-*.md criterion 5): the dot appears, the
    // panel waits for a click.
    upgrade = { running: '0.6.1', latest: '0.7.0', available: true, checkedAt: 1 };
    expect(render()).not.toContain('versionpanel');
  });
});

describe('the last-check label', () => {
  const now = new Date('2026-08-06T15:00:00').getTime();
  const ago = (ms) => lastCheckedLabel(now - ms, now);

  it('is relative under the hour and a clock time beyond it', () => {
    expect(ago(30 * 1000)).toBe('checked just now');
    expect(ago(60 * 1000)).toBe('checked 1 minute ago');
    expect(ago(12 * 60 * 1000)).toBe('checked 12 minutes ago');
    // Past the hour the arithmetic stops being worth doing, so it stops being
    // asked for.
    expect(ago(3 * 60 * 60 * 1000)).toMatch(/^checked at /);
  });

  it('names the day once it is no longer today', () => {
    expect(ago(30 * 60 * 60 * 1000)).toMatch(/^checked .+ at /);
  });

  it('says nothing has been checked rather than inventing a time', () => {
    // A failed check never advances the timestamp, so a fresh install whose
    // only check failed lands here — and must not claim a check happened.
    expect(lastCheckedLabel(0, now)).toBe('not checked yet');
  });
});

// The case the indicator exists for: an adopter who is already current clicks
// to make sure. Driven through the DOM, because the defect this covers was that
// the click produced no rendered change at all (adr/0038-*.md AC9).
describe('the manual check is visible from click to answer', () => {
  let root;
  let container;

  const mount = async () => {
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<VersionIndicator />));
    return container;
  };

  const click = async () => {
    const { act } = await import('react');
    await act(async () => {
      container.querySelector('button.sb-version').click();
    });
  };

  // Advances both the pending floor and the confirmation lifetime.
  const advance = async (ms) => {
    const { act } = await import('react');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(async () => {
    if (root) {
      const { act } = await import('react');
      await act(async () => root.unmount());
    }
    container?.remove();
    root = null;
    vi.useRealTimers();
  });

  it('shows a pending state, then confirms, then clears itself', async () => {
    await mount();
    await click();
    // The answer is already back — the mock resolves immediately — but the
    // pending state is held so a fast check is still legible as a check.
    expect(container.querySelector('.sb-version-spin')).not.toBe(null);
    expect(container.querySelector('.sb-version').getAttribute('data-tip')).toContain('Checking');

    await advance(600);
    expect(container.querySelector('.sb-version-spin')).toBe(null);
    expect(container.querySelector('.sb-version.is-confirmed')).not.toBe(null);

    // Transient: it leaves the resting indicator behind rather than becoming a
    // standing "you are current" badge.
    await advance(3000);
    expect(container.querySelector('.sb-version.is-confirmed')).toBe(null);
    expect(container.querySelector('.sb-version-spin')).toBe(null);
    expect(container.textContent).toContain('v0.6.1');
  });

  it('holds the pending state even when the check answers instantly', async () => {
    // The regression guard for the floor: without it a cached answer would
    // flash a spinner too briefly to register, which is the state this feature
    // was in — indistinguishable from a dead button.
    await mount();
    await click();
    await advance(100);
    expect(container.querySelector('.sb-version-spin')).not.toBe(null);
  });

  it('never confirms up to date when the check failed', async () => {
    // adr/0038-*.md AC6: silent in the sense of "no error to act on", NOT in the
    // sense of asserting an answer the check did not produce.
    checkForUpdate.mockResolvedValue(OUTCOME.failed);
    await mount();
    await click();
    await advance(600);
    expect(container.querySelector('.sb-version.is-confirmed')).toBe(null);
    expect(container.textContent).toContain('couldn’t check');
    expect(container.querySelector('.sb-version').getAttribute('data-tip')).not.toMatch(/up to date/i);
  });

  it('presents a throttled re-check exactly like a completed one', async () => {
    // The store answers a refusal from the last result, so the component cannot
    // tell the difference — and neither can the adopter. AC8.
    await mount();
    await click();
    await advance(600);
    expect(container.querySelector('.sb-version.is-confirmed')).not.toBe(null);
    expect(checkForUpdate).toHaveBeenCalledWith({ force: true });
  });

  // Mounting runs one automatic check of its own (unforced), so the manual ones
  // are counted by their `force` flag rather than by total calls.
  const forcedCalls = () =>
    checkForUpdate.mock.calls.filter(([a]) => a?.force === true).length;

  it('ignores a second click while one check is in flight', async () => {
    await mount();
    await click();
    await click();
    expect(forcedCalls()).toBe(1);
  });

  it('opens the panel instead of re-checking when an update is known', async () => {
    // The answer is already on screen; re-checking would tell nobody anything.
    upgrade = { running: '0.6.1', latest: '0.7.0', available: true, checkedAt: 1 };
    await mount();
    await click();
    expect(forcedCalls()).toBe(0);
    expect(container.querySelector('.versionpanel')).not.toBe(null);
  });
});

// The panel opens on click, which static rendering does not perform; drive it
// through the DOM so the two variants are asserted on what an adopter sees.
describe('the action the panel offers', () => {
  let root;
  let container;

  const open = async () => {
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<VersionIndicator />));
    await act(async () => {
      container.querySelector('button.sb-version').click();
    });
    return container;
  };

  afterEach(async () => {
    if (root) {
      const { act } = await import('react');
      await act(async () => root.unmount());
    }
    container?.remove();
    root = null;
  });

  it('offers only the release link when the deployment cannot write', async () => {
    // No token configured: an upgrade action here would fail on click, so it is
    // not offered at all (adr/0039-*.md).
    upgrade = { running: '0.6.1', latest: '0.7.0', available: true, checkedAt: 1 };
    caps = { canWrite: false, known: true };
    const el = await open();
    expect(el.querySelector('.vp-link')?.textContent).toBe('View on GitHub');
    expect(el.querySelector('.vp-action')).toBe(null);
  });

  it('offers the upgrade action when the deployment can write', async () => {
    upgrade = { running: '0.6.1', latest: '0.7.0', available: true, checkedAt: 1 };
    caps = { canWrite: true, known: true };
    const el = await open();
    expect(el.querySelector('.vp-action')?.textContent).toBe('Update to 0.7.0');
    expect(el.querySelector('.vp-link')).toBe(null);
  });

  it('falls back to the safe affordance before the probe has answered', async () => {
    // `canWrite` is false until the answer lands, so what renders first is the
    // link — never an action that might turn out to be unavailable.
    upgrade = { running: '0.6.1', latest: '0.7.0', available: true, checkedAt: 1 };
    caps = { canWrite: false, known: false };
    const el = await open();
    expect(el.querySelector('.vp-action')).toBe(null);
    expect(el.querySelector('.vp-link')).not.toBe(null);
  });
});
