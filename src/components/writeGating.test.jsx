// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Commit actions appear only once write access is CONFIRMED (adr/0034,
// criteria 11-12).
//
// The three-state property is the point, and it is the one a `!canWrite` test
// would miss: "not asked yet" and "asked, cannot write" both withhold, so a
// cold load never shows an action that is about to vanish, and a deployment
// without a token never shows one that would fail.

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
  it('offers type management once write access is confirmed', () => {
    const html = sidebar({
      onNewType: () => {},
      onEditType: () => {},
      onManageVisibility: () => {},
    });
    expect(html).toContain('New type');
    expect(html).toContain('Show or hide types');
  });

  it('withholds type management when the props are not passed', () => {
    // Which is what App does in both the unanswered and the read-only case.
    const html = sidebar({ onNewType: null, onEditType: null, onManageVisibility: null });
    expect(html).not.toContain('New type');
    expect(html).not.toContain('Show or hide types');
  });

  it('removes the action rather than disabling it', () => {
    // A disabled control raises a question the app then has to answer next to
    // each one, where the notice in preferences already answers it once.
    const html = sidebar({ onNewType: null, onEditType: null, onManageVisibility: null });
    expect(html).not.toContain('disabled');
  });

  it('offers new note once write access is confirmed', () => {
    expect(noteList({ onNew: () => {} })).toContain('New note');
  });

  it('withholds new note otherwise, keeping search in place', () => {
    const html = noteList({ onNew: null });
    expect(html).not.toContain('New note');
    // Search is not a write action and must not flicker with the answer.
    expect(html).toContain('Search');
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

  it('offers sharing only when the deployment can write', async () => {
    expect(await view(true)).toContain('share');
    expect(await view(false)).not.toContain('share');
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
