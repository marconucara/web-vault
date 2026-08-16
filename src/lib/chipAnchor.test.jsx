// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// React only flushes act() synchronously when it is told it is under test;
// without this the mount below would be asserted before it had rendered.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The chips resolve their target through the vault index; state it directly so
// each case says which target exists and which does not.
vi.mock('../content.js', () => ({
  titleIndex: { 'some note': 'notes/some-note' },
  idTitle: { 'notes/some-note': 'Some Note' },
  notes: [],
  views: [],
  build: null,
  maps: {},
  notesById: {},
  typeMeta: {},
}));

const { WikilinkChip, MedialinkChip } = await import('./blocknoteSchema.jsx');

const render = (Chip, props) => renderToStaticMarkup(React.createElement(Chip, props));

describe('wikilink chip', () => {
  // The href is what the browser's own context menu, middle click and
  // long-press "Open in new tab" hang off — no handler test can observe it.
  it('renders a resolved target as an anchor carrying the note route', () => {
    const html = render(WikilinkChip, { target: 'Some Note', alias: '' });
    expect(html).toContain('<a');
    expect(html).toContain(`href="#/n/${encodeURIComponent('notes/some-note')}"`);
    expect(html).toContain('Some Note');
  });

  it('leaves a dead target as an inert span', () => {
    const html = render(WikilinkChip, { target: 'No Such Note', alias: '' });
    expect(html).toContain('<span');
    expect(html).not.toContain('<a');
    expect(html).toContain('dead');
  });

  // A target carrying a heading anchor is a live chip, not a dead span, and the
  // anchor rides along verbatim (adr/0044-what-the-url-addresses.md).
  it('renders a target carrying an anchor as an anchor into the heading', () => {
    const html = render(WikilinkChip, { target: 'Some Note#convenzioni', alias: '' });
    expect(html).toContain('<a');
    expect(html).toContain(`href="#/n/${encodeURIComponent('notes/some-note')}#convenzioni"`);
  });

  // A vault written in Obsidian carries the heading text, which its link picker
  // inserts; it has to reach the same heading as the slug form.
  it('reaches the heading when the target names it by its text', () => {
    const html = render(WikilinkChip, { target: 'Some Note#Le Convenzioni', alias: '' });
    expect(html).toContain(`href="#/n/${encodeURIComponent('notes/some-note')}#le-convenzioni"`);
  });

  // The label rule is untouched: alias, else the note title, else the target.
  it('shows the alias on a target carrying an anchor', () => {
    const html = render(WikilinkChip, { target: 'Some Note#convenzioni', alias: 'Le regole' });
    expect(html).toContain('Le regole');
  });

  it('leaves a dead target dead even when it carries an anchor', () => {
    const html = render(WikilinkChip, { target: 'No Such Note#heading', alias: '' });
    expect(html).not.toContain('<a');
    expect(html).toContain('dead');
  });

  // The old tooltip named a gesture that no longer applies (and never existed on
  // touch); it names the target now.
  it('does not tell the user to Cmd/Ctrl+click', () => {
    const html = render(WikilinkChip, { target: 'Some Note', alias: '' });
    expect(html).not.toMatch(/Cmd|Ctrl/i);
  });
});

// Mounting the chip for real is the only way to see what the two listeners do
// together; renderToStaticMarkup shows the href but never fires a handler.
describe('chip gestures, as the browser delivers them', () => {
  let container = null;
  let root = null;
  const opened = [];

  const mount = (Chip, props) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(React.createElement(Chip, props)));
    return container.querySelector('a');
  };

  // A real MouseEvent, so `button` and the modifier flags reach the handler the
  // same way they would from a user's actual click.
  const fire = (el, type, init) =>
    act(() => {
      el.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
    });

  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    root = null;
    container = null;
    opened.length = 0;
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  const spyOnOpen = () =>
    vi.spyOn(window, 'open').mockImplementation((...args) => {
      opened.push(args);
      return null;
    });

  it('opens one tab — not two — when the middle button reaches both listeners', () => {
    spyOnOpen();
    const el = mount(WikilinkChip, { target: 'Some Note', alias: '' });
    // The spec says a browser sends the middle button to auxclick only, but this
    // states what happens if one sends it to both: still a single tab.
    fire(el, 'click', { button: 1 });
    fire(el, 'auxclick', { button: 1 });
    expect(opened).toHaveLength(1);
    expect(opened[0][0]).toBe(`#/n/${encodeURIComponent('notes/some-note')}`);
  });

  it('navigates in place on a plain click, without opening a tab', () => {
    spyOnOpen();
    const el = mount(WikilinkChip, { target: 'Some Note', alias: '' });
    fire(el, 'click', { button: 0 });
    expect(opened).toHaveLength(0);
    expect(window.location.hash).toBe(`#/n/${encodeURIComponent('notes/some-note')}`);
  });

  it('opens a new tab on Cmd+click and leaves the current page alone', () => {
    spyOnOpen();
    const el = mount(WikilinkChip, { target: 'Some Note', alias: '' });
    fire(el, 'click', { button: 0, metaKey: true });
    expect(opened).toHaveLength(1);
    expect(window.location.hash).toBe('');
  });

  // Exit criterion 4: the browser's own "Open in new tab" must survive.
  it('does not pre-empt the browser on a right click', () => {
    spyOnOpen();
    const el = mount(WikilinkChip, { target: 'Some Note', alias: '' });
    fire(el, 'auxclick', { button: 2 });
    expect(opened).toHaveLength(0);
    expect(window.location.hash).toBe('');
  });

  it('opens a media chip in a new tab even on a plain click', () => {
    spyOnOpen();
    const el = mount(MedialinkChip, { name: 'clip', url: 'media/clip.mp4', kind: 'video' });
    fire(el, 'click', { button: 0 });
    expect(opened).toHaveLength(1);
    expect(opened[0][0]).toBe('media/clip.mp4');
    expect(window.location.hash).toBe('');
  });
});

describe('media chip', () => {
  it('renders as an anchor to the url, opening in a new tab', () => {
    const html = render(MedialinkChip, { name: 'clip', url: 'media/clip.mp4', kind: 'video' });
    expect(html).toContain('href="media/clip.mp4"');
    expect(html).toContain('target="_blank"');
  });

  it('stays a span when there is no url', () => {
    const html = render(MedialinkChip, { name: 'clip', url: '', kind: 'file' });
    expect(html).not.toContain('<a');
  });
});
