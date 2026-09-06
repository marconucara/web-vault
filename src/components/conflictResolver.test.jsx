// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// What the resolution surface guarantees (adr/0050-*.md). The refusal itself is
// covered by functions/commit.test.js; this file asserts the properties that
// make the surface safe to put in front of someone who just failed to save:
// their text is never replaced behind their back, and what leaves the modal is
// what they were shown and chose.
vi.mock('react-i18next', () => ({
  // Keys, not prose: the assertions must not depend on copy that translators
  // are free to change.
  useTranslation: () => ({ t: (k, o) => (o?.count != null ? `${k}:${o.count}` : k) }),
}));
vi.mock('./Icon.jsx', () => ({ default: ({ name }) => <i data-icon={name} /> }));
// The merge view is CodeMirror and owns its own DOM; what this file tests is the
// resolver around it — which note is open, what text is held per note, and what
// leaves on save. The stand-in exposes those as plain inputs.
vi.mock('./ConflictMerge.jsx', () => ({
  default: ({ value, remote, onChange }) => (
    <div>
      <textarea
        className="mock-mine"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <textarea className="mock-theirs" value={remote} readOnly />
    </div>
  ),
}));

// Opts React into act() support; without it every interaction logs a warning
// that buries real output.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { default: ConflictResolver } = await import('./ConflictResolver.jsx');

async function mount(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
  });
  return {
    host,
    unmount: () => act(() => root.unmount()),
    click: async (el) => {
      await act(async () => {
        el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      });
    },
    type: async (el, value) => {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        ).set;
        setter.call(el, value);
        el.dispatchEvent(new window.Event('input', { bubbles: true }));
      });
    },
  };
}

const drift = (path, remote, remoteSha = `sha-${path}`) => ({ path, remote, remoteSha });

const items = (host) => [...host.querySelectorAll('.conflict-item')];
const panes = (host) => [
  host.querySelector('.mock-mine'),
  host.querySelector('.mock-theirs'),
];
const commitBtn = (host) => host.querySelector('.sp-commit');

describe('the conflict resolution surface', () => {
  it('lists the note even when only one drifted', async () => {
    // The list is not a plural-only affordance: what is being resolved should
    // not depend on how many there happen to be.
    const { host, unmount } = await mount(
      <ConflictResolver
        drifted={[drift('a.md', 'remote a')]}
        local={{ 'a.md': 'mine a' }}
        onResolve={() => {}}
        onCancel={() => {}}
      />
    );
    try {
      expect(items(host)).toHaveLength(1);
      expect(items(host)[0].textContent).toContain('a.md');
    } finally {
      unmount();
    }
  });

  it('opens on the local text, not the remote one', async () => {
    // The user's own work is what they are looking at; the remote version sits
    // beside it, read only. Doing nothing keeps their version.
    const { host, unmount } = await mount(
      <ConflictResolver
        drifted={[drift('a.md', 'remote a')]}
        local={{ 'a.md': 'mine a' }}
        onResolve={() => {}}
        onCancel={() => {}}
      />
    );
    try {
      const [mine, theirs] = panes(host);
      expect(mine.value).toBe('mine a');
      expect(mine.readOnly).toBe(false);
      expect(theirs.value).toBe('remote a');
      expect(theirs.readOnly).toBe(true);
    } finally {
      unmount();
    }
  });

  it('commits the local text, against the SHA it was shown', async () => {
    // The base advances to what the server had: a retry must not be refused by
    // the very drift the user just resolved.
    const onResolve = vi.fn();
    const { host, unmount, click } = await mount(
      <ConflictResolver
        drifted={[drift('a.md', 'remote a', 'blobREMOTE')]}
        local={{ 'a.md': 'mine a' }}
        onResolve={onResolve}
        onCancel={() => {}}
      />
    );
    try {
      await click(commitBtn(host));
      expect(onResolve).toHaveBeenCalledWith([
        { path: 'a.md', body: 'mine a', baseSha: 'blobREMOTE' },
      ]);
    } finally {
      unmount();
    }
  });

  it('keeps one note\'s text out of another\'s', async () => {
    const onResolve = vi.fn();
    const { host, unmount, click, type } = await mount(
      <ConflictResolver
        drifted={[drift('a.md', 'remote a'), drift('b.md', 'remote b')]}
        local={{ 'a.md': 'mine a', 'b.md': 'mine b' }}
        onResolve={onResolve}
        onCancel={() => {}}
      />
    );
    try {
      await type(panes(host)[0], 'resolved a');
      await click(items(host)[1]);
      // b.md opens on its own text, untouched by what was typed into a.md.
      expect(panes(host)[0].value).toBe('mine b');
      expect(panes(host)[1].value).toBe('remote b');

      await click(commitBtn(host));
      expect(onResolve).toHaveBeenCalledWith([
        { path: 'a.md', body: 'resolved a', baseSha: 'sha-a.md' },
        { path: 'b.md', body: 'mine b', baseSha: 'sha-b.md' },
      ]);
    } finally {
      unmount();
    }
  });

  it('will not commit until every drifted note has been looked at', async () => {
    // With several notes, committing blind would defeat the point: the refusal
    // exists so each change gets seen.
    const { host, unmount, click } = await mount(
      <ConflictResolver
        drifted={[drift('a.md', 'ra'), drift('b.md', 'rb'), drift('c.md', 'rc')]}
        local={{ 'a.md': 'ma', 'b.md': 'mb', 'c.md': 'mc' }}
        onResolve={() => {}}
        onCancel={() => {}}
      />
    );
    try {
      expect(commitBtn(host).disabled).toBe(true); // a.md is open, b and c are not
      await click(items(host)[1]);
      expect(commitBtn(host).disabled).toBe(true);
      await click(items(host)[2]);
      expect(commitBtn(host).disabled).toBe(false);
    } finally {
      unmount();
    }
  });

  it('keeps each note\'s edits separate while switching between them', async () => {
    const onResolve = vi.fn();
    const { host, unmount, click, type } = await mount(
      <ConflictResolver
        drifted={[drift('a.md', 'ra'), drift('b.md', 'rb')]}
        local={{ 'a.md': 'ma', 'b.md': 'mb' }}
        onResolve={onResolve}
        onCancel={() => {}}
      />
    );
    try {
      // Type into a.md, move to b.md, come back: the edit is still there.
      await type(panes(host)[0], 'a resolved');
      await click(items(host)[1]);
      expect(panes(host)[0].value).toBe('mb');
      await click(items(host)[0]);
      expect(panes(host)[0].value).toBe('a resolved');

      await click(commitBtn(host));
      expect(onResolve).toHaveBeenCalledWith([
        { path: 'a.md', body: 'a resolved', baseSha: 'sha-a.md' },
        { path: 'b.md', body: 'mb', baseSha: 'sha-b.md' },
      ]);
    } finally {
      unmount();
    }
  });

  it('leaves everything alone when dismissed', async () => {
    const onCancel = vi.fn();
    const onResolve = vi.fn();
    const { host, unmount, click } = await mount(
      <ConflictResolver
        drifted={[drift('a.md', 'ra')]}
        local={{ 'a.md': 'ma' }}
        onResolve={onResolve}
        onCancel={onCancel}
      />
    );
    try {
      await click(host.querySelector('.conflict-actions .link-btn'));
      expect(onCancel).toHaveBeenCalled();
      expect(onResolve).not.toHaveBeenCalled();
    } finally {
      unmount();
    }
  });
});
