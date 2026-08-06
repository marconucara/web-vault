// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The indicator's two states are driven by the store; stub it so each case
// states the situation directly rather than driving a fetch.
let upgrade = { running: '0.6.1', latest: '', available: false, checkedAt: 0 };
const checkForUpdate = vi.fn();

vi.mock('../lib/upgrade.js', () => ({
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

const { default: VersionIndicator } = await import('./VersionIndicator.jsx');

const render = () => renderToStaticMarkup(<VersionIndicator />);

beforeEach(() => {
  upgrade = { running: '0.6.1', latest: '', available: false, checkedAt: 0 };
  caps = { canWrite: false, known: true };
  checkForUpdate.mockClear();
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
