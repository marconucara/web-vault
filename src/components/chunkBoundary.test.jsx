// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChunkBoundary from './ChunkBoundary.jsx';

// The boundary logs the real error; keep the test output clean.
let errorSpy;
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

// renderToStaticMarkup does not run error boundaries, so exercise the boundary's
// state transition directly and render the failed state.
function failedMarkup() {
  expect(ChunkBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  const boundary = new ChunkBoundary({ children: <div>content</div> });
  boundary.state = { failed: true };
  return renderToStaticMarkup(<>{boundary.render()}</>);
}

describe('ChunkBoundary', () => {
  it('renders its children while nothing has failed', () => {
    const html = renderToStaticMarkup(
      <ChunkBoundary>
        <p>the map</p>
      </ChunkBoundary>,
    );
    expect(html).toContain('the map');
    expect(html).not.toContain('chunk-error');
  });

  it('offers a reload once a chunk fails to load', () => {
    const html = failedMarkup();
    expect(html).toContain('chunk-error');
    expect(html).toMatch(/Reload/);
    expect(html).toContain('role="alert"');
  });

  // The upgrade notice (adr/0038-*.md) owns "a new version is available" and
  // means a new web-vault release. This surface means the VAULT'S CONTENT moved
  // on. If they ever share wording, two unrelated events become indistinguishable.
  it('talks about content, not about a new version', () => {
    const html = failedMarkup();
    expect(html).toMatch(/New content is available/i);
    expect(html).not.toMatch(/new version/i);
    expect(html).not.toMatch(/upgrade/i);
  });

  it('logs the underlying error rather than swallowing it', () => {
    const boundary = new ChunkBoundary({});
    boundary.componentDidCatch(new Error('chunk gone'));
    expect(errorSpy).toHaveBeenCalled();
  });
});
