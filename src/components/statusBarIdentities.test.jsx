// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Integration: the status bar wires up two identities that are easy to conflate
// — the WebVault release the site was built with, and the commit of the
// adopter's own vault content. The indicator's own states live in
// versionIndicator.test.jsx; this file asserts they meet correctly in the bar. They come from different sources (adr/0037-*.md) and must not read
// as one value. Stub `content.js` so each case states exactly what the build
// baked. See adr/0012-build-version-chip.md for the commit chip itself.
const buildInfo = {
  sha: 'abcdef1234567890',
  short: 'abcdef1',
  dirty: false,
  builtAt: '2026-08-06T00:00:00.000Z',
  repo: 'someone/their-vault',
  frameworkVersion: '1.2.3',
};

let current;
vi.mock('../content.js', () => ({
  get build() {
    return current;
  },
  notes: [],
}));

const { default: StatusBar } = await import('./StatusBar.jsx');

const render = (build) => {
  current = build;
  return renderToStaticMarkup(<StatusBar pending={[]} onOpen={() => {}} />);
};

beforeEach(() => {
  current = buildInfo;
});
afterEach(() => vi.restoreAllMocks());

describe('status bar identities', () => {
  it('shows the framework version alongside the vault commit', () => {
    const html = render(buildInfo);
    expect(html).toContain('v1.2.3');
    expect(html).toContain('abcdef1');
  });

  it('keeps the two identities separate, not one compound value', () => {
    const html = render(buildInfo);
    // The version is its own element and stays outside the commit anchor: it is
    // not a property of that commit and has nowhere to link to.
    expect(html).toMatch(/class="sb-version[^"]*"[^>]*>v1\.2\.3</);
    const anchor = html.match(/<a class="sb-build[^"]*"[\s\S]*?<\/a>/)[0];
    expect(anchor).not.toContain('1.2.3');
    // Each carries its own tooltip naming what it is. Both are now the in-app
    // tooltip (`data-tip`); neither uses the native `title`.
    expect(html).toContain('WebVault 1.2.3');
    expect(anchor).toContain('Content built from commit abcdef1');
  });

  it('links the commit chip to the vault repo, never to the version', () => {
    const html = render(buildInfo);
    expect(html).toContain('https://github.com/someone/their-vault/commit/abcdef1234567890');
  });

  it('renders the commit chip alone when the build predates the version field', () => {
    // A site built by an older framework has no frameworkVersion. It must
    // degrade to the previous behaviour, not render an empty or "vundefined"
    // indicator.
    const { frameworkVersion, ...older } = buildInfo;
    const html = render(older);
    expect(html).toContain('abcdef1');
    expect(html).not.toContain('sb-version');
    expect(html).not.toContain('undefined');
  });

  it('marks a dirty local build on the commit, not on the version', () => {
    const html = render({ ...buildInfo, dirty: true });
    expect(html).toContain('abcdef1+');
    expect(html).toMatch(/class="sb-version[^"]*"[^>]*>v1\.2\.3</);
  });

  // The chip used to carry a native `title`, which gave the status bar two
  // different tooltips side by side: the browser's here, the app's on the
  // version indicator next to it. See adr/0012-build-version-chip.md.
  describe('the commit chip tooltip', () => {
    const anchorOf = (html) => html.match(/<a class="sb-build[^"]*"[\s\S]*?<\/a>/)[0];

    it('uses the in-app tooltip rather than the browser default', () => {
      const anchor = anchorOf(render(buildInfo));
      expect(anchor).toContain('data-tip="');
      expect(anchor).not.toContain('title="');
    });

    it('opens upward and allows more than one line, like the version does', () => {
      // Without tt-up the bubble hangs below an element already at the bottom
      // of the viewport; without tt-multi the two lines collapse into one,
      // since `content: attr()` folds a newline like any other whitespace.
      const anchor = anchorOf(render(buildInfo));
      expect(anchor).toMatch(/class="sb-build tt tt-up tt-multi"/);
    });

    it('keeps both lines of the tip, and the commit reaches a screen reader', () => {
      // The chip shows only the short SHA, so the accessible name — not the
      // visible text — is what carries the commit and the build time.
      const anchor = anchorOf(render(buildInfo));
      const tip = 'Content built from commit abcdef1\n2026-08-06T00:00:00.000Z';
      expect(anchor).toContain(`data-tip="${tip}"`);
      expect(anchor).toContain(`aria-label="${tip}"`);
    });

    it('says so in the tip when the build had uncommitted changes', () => {
      const anchor = anchorOf(render({ ...buildInfo, dirty: true }));
      expect(anchor).toContain('Content built from commit abcdef1 (uncommitted local changes)');
    });
  });
});
