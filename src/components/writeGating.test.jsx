// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Commit actions are always PRESENT and go inert until write access is
// confirmed (adr/0034, criteria 11-12 as revised at r5).
//
// The three-state property is the point, and it is the one a `!canWrite` test
// would miss: "not asked yet" and "asked, cannot write" both render inert, so a
// cold load never offers an action that would fail. What separates them is the
// tooltip — only a settled `off` has something true to say.
//
// The property these tests exist to hold is that NOTHING unmounts with the
// answer: a control that arrives late reflows every row below it, which is the
// bug r5 reverses. Assert presence in all three states, not just behaviour in
// one.

vi.mock('../content.js', () => ({ build: null, notes: [], titleIndex: {}, idTitle: {}, maps: {} }));

const { default: Sidebar } = await import('./Sidebar.jsx');
const { default: NoteList } = await import('./NoteList.jsx');

const sidebar = (props) =>
  renderToStaticMarkup(
    <Sidebar
      views={[]}
      types={['Person']}
      typeMeta={{ Person: { icon: 'user', color: null, order: 0, visible: true, path: 'person.md' } }}
      counts={{ all: 1, inbox: 1, shared: 0 }}
      selection={{ kind: 'all' }}
      onSelect={() => {}}
      {...props}
    />
  );

const noteList = (props) =>
  renderToStaticMarkup(
    <NoteList title="All notes" notes={[]} openId={null} onOpen={() => {}} typeMeta={{}} {...props} />
  );

describe('commit actions under each capability state', () => {
  const acts = { onNewType: () => {}, onEditType: () => {}, onManageVisibility: () => {} };

  // The regression this file exists to prevent. Presence must not depend on the
  // answer, in either direction: a control that appears when write access lands
  // pushes every row below it down, which is what criterion 11 forbids.
  it.each(/** @type {const} */ (['on', 'off', 'pending']))('renders every type action when write is %s', (writeState) => {
    const html = sidebar({ ...acts, writeState });
    expect(html).toContain('New type');
    expect(html).toContain('Show or hide types');
    // Interpolated per row — the label names the type it edits.
    expect(html).toContain('Edit Person');
  });

  it.each(/** @type {const} */ (['on', 'off', 'pending']))('renders new note when write is %s', (writeState) => {
    const html = noteList({ onNew: () => {}, writeState });
    expect(html).toContain('New note');
    // Search is not a write action and must not move with the answer either.
    expect(html).toContain('Search');
  });

  it('leaves the actions live when write access is confirmed', () => {
    expect(sidebar({ ...acts, writeState: 'on' })).not.toContain('aria-disabled');
    expect(noteList({ onNew: () => {}, writeState: 'on' })).not.toContain('aria-disabled');
  });

  it.each(/** @type {const} */ (['off', 'pending']))('holds the actions inert when write is %s', (writeState) => {
    expect(sidebar({ ...acts, writeState })).toContain('aria-disabled="true"');
    expect(noteList({ onNew: () => {}, writeState })).toContain('aria-disabled="true"');
  });

  it('never uses the disabled attribute, which would suppress the tooltip', () => {
    // `disabled` emits no hover or focus events, so the control would be mute
    // exactly when it is asked to explain itself (criterion 12).
    for (const writeState of /** @type {const} */ (['on', 'off', 'pending'])) {
      expect(sidebar({ ...acts, writeState })).not.toContain('disabled=""');
      expect(noteList({ onNew: () => {}, writeState })).not.toContain('disabled=""');
    }
  });
});

describe('what an inert action says', () => {
  const acts = { onNewType: () => {}, onEditType: () => {}, onManageVisibility: () => {} };

  it('states that editing is off once the answer is known', () => {
    const html = sidebar({ ...acts, writeState: 'off' });
    expect(html).toContain('Editing is off');
    // The reason stays in preferences; the tooltip names the state only.
    expect(html).not.toContain('GITHUB_TOKEN');
  });

  it('says nothing while the probe is still in flight', () => {
    // There is no settled answer yet, so claiming editing is off would be a
    // statement the app cannot make.
    expect(sidebar({ ...acts, writeState: 'pending' })).not.toContain('Editing is off');
    expect(noteList({ onNew: () => {}, writeState: 'pending' })).not.toContain('Editing is off');
  });

  it('keeps the control its own accessible name in every state', () => {
    // The tip explains the state; overwriting the name with it would leave the
    // control unnamed to a screen reader.
    for (const writeState of /** @type {const} */ (['on', 'off', 'pending'])) {
      expect(sidebar({ ...acts, writeState })).toContain('aria-label="New type"');
    }
  });
});

describe('the note body', () => {
  // The body is content, not a control, so it is never withheld: it renders
  // read-only and relaxes into writing on confirmation (criterion 10). These go
  // through NoteView rather than the editors directly, because the decision
  // being tested is which state NoteView asks for.
  const note = {
    id: 'a-note',
    path: 'a-note.md',
    title: 'A note',
    type: 'Note',
    frontmatter: {},
    body: '# A note\n\nSome text.\n',
    mtime: 0,
    ctime: 0,
  };

  const view = async (canWrite) => {
    vi.resetModules();
    vi.doMock('../lib/capabilities.js', () => ({
      useCapabilities: () => ({ canWrite, known: true }),
      loadCapabilities: () => {},
    }));
    vi.doMock('../content.js', () => ({ build: null, notes: [], titleIndex: {}, idTitle: {}, maps: {} }));
    const { default: NoteView } = await import('./NoteView.jsx');
    return renderToStaticMarkup(<NoteView note={note} titleIndex={{}} />);
  };

  it('renders the note whether or not the deployment can write', async () => {
    // Withholding it would leave the body blank, which is a worse answer to
    // "we cannot save" than showing the text.
    expect(await view(false)).toContain('editor');
    expect(await view(true)).toContain('editor');
  });

  it('shows sharing in both cases, live only when the deployment can write', async () => {
    // Share holds its place like the other commit actions (criteria 11-12).
    // It sits at the end of an inline row, so its absence cost no layout — but
    // an action that vanishes with the answer is the thing those criteria rule
    // out, whether or not this particular one reflows.
    const live = await view(true);
    expect(live).toContain('share-btn');
    expect(live).not.toContain('aria-disabled');

    const inert = await view(false);
    expect(inert).toContain('share-btn');
    expect(inert).toContain('aria-disabled="true"');
    expect(inert).toContain('Editing is off');
  });
});

describe('the Inbox row', () => {
  it('is shown by default', () => {
    expect(sidebar({})).toContain('Inbox');
  });

  it('goes when the preference is off', () => {
    expect(sidebar({ showInbox: false })).not.toContain('Inbox');
  });

  it('leaves an open Inbox list alone — only the row goes', () => {
    // Matching adr/0046 for a hidden type: navigating away is what makes it
    // unreachable, which is the point of having hidden it. The selection is not
    // reset, so the list keeps rendering.
    const html = sidebar({ showInbox: false, selection: { kind: 'inbox' } });
    expect(html).not.toContain('Inbox');
    // Nothing in the sidebar claims a selection that is no longer listed.
    expect(html).not.toContain('nav-item active');
  });
});
