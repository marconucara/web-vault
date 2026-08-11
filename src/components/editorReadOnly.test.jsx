// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

// The note body is read-only until write access is confirmed (adr/0034
// criterion 10).
//
// Mounted for real rather than rendered to a string: both editors build their
// DOM only in a live document — CodeMirror renders an empty shell under SSR —
// so a `renderToStaticMarkup` assertion here would pass against an editor that
// ignores the prop entirely. That is exactly what happened while writing this
// file, and it is why the test mounts.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// React only accepts `act` from an environment that declares itself one;
// without this every mount below logs a warning into the gate's output.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom ships no `matchMedia`, and the editor reads it to follow the system
// theme. Light, so the theme plays no part in what is asserted below.
if (typeof window.matchMedia !== 'function') {
  // Only the three members the editor touches; cast because the real interface
  // carries a dozen more that no code path here reaches.
  window.matchMedia = () => /** @type {MediaQueryList} */ (/** @type {unknown} */ ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

async function mount(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
    await sleep(60);
  });
  return { host, unmount: () => act(() => root.unmount()) };
}

const { default: Editor } = await import('./Editor.jsx');

describe('the markdown source editor', () => {
  it('accepts typing when the deployment can write', async () => {
    const { host, unmount } = await mount(
      <Editor value={'# A note\n\nSome text.\n'} onChange={() => {}} readOnly={false} />
    );
    expect(host.querySelector('.cm-content')?.getAttribute('contenteditable')).toBe('true');
    unmount();
  });

  it('refuses typing when it cannot', async () => {
    const { host, unmount } = await mount(
      <Editor value={'# A note\n\nSome text.\n'} onChange={() => {}} readOnly={true} />
    );
    // `editable={false}` drops contenteditable altogether, taking the caret and
    // the focus ring with it — `readOnly` would have kept both, inviting an
    // edit that cannot land.
    expect(host.querySelector('.cm-content')?.getAttribute('contenteditable')).not.toBe('true');
    unmount();
  });

  it('still shows the text it will not let you change', async () => {
    const { host, unmount } = await mount(
      <Editor value={'# A note\n\nSome text.\n'} onChange={() => {}} readOnly={true} />
    );
    expect(host.textContent).toContain('Some text.');
    unmount();
  });

  it('renders the same lines either way', async () => {
    // The property the anchor scroll depends on: relaxing read-only into
    // writable must not change what is laid out, or the heading someone
    // followed a link to moves under them (adr/0044).
    const ro = await mount(<Editor value={'# A\n\nB\n\n## C\n'} onChange={() => {}} readOnly={true} />);
    const rw = await mount(<Editor value={'# A\n\nB\n\n## C\n'} onChange={() => {}} readOnly={false} />);
    const lines = (h) => h.querySelectorAll('.cm-line').length;
    expect(lines(ro.host)).toBe(lines(rw.host));
    ro.unmount();
    rw.unmount();
  });
});
