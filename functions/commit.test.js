import { describe, expect, it } from 'vitest';
import {
  applyOps,
  ensureShareId,
  isSafeNotePath,
  isSettableKey,
  reconstructFile,
  removeShareLine,
  retypeLine,
  setFrontmatterKey,
  setH1,
} from './commit.js';

const FM = (...lines) => `---\n${lines.join('\n')}\n---\n`;

describe('frontmatter line operations (ADR 0022)', () => {
  it('replaces the body while keeping the frontmatter block verbatim', () => {
    const raw = `${FM('type: Person', 'weird_key: [a, b]')}\n# Ada\n\nold body\n`;
    const out = reconstructFile(raw, '\n# Ada\n\nnew body\n');
    expect(out).toContain('weird_key: [a, b]');
    expect(out).toContain('new body');
    expect(out).not.toContain('old body');
  });

  it('adds and removes share_id without touching the other keys', () => {
    const fm = FM('type: Person', 'order: 3');
    const shared = ensureShareId(fm, 'abc123');
    expect(shared).toContain('share_id: abc123');
    expect(shared).toContain('order: 3');
    // Already present: left alone rather than duplicated.
    expect(ensureShareId(shared, 'other')).toBe(shared);
    expect(removeShareLine(shared)).toBe(fm);
  });
});

describe('type panel frontmatter keys (ADR 0045, criterion 6)', () => {
  it('sets a key in place when present and appends it when missing', () => {
    const fm = FM('type: Type', 'icon: user');
    // In place: the line is replaced where it already sits.
    expect(setFrontmatterKey(fm, 'icon', 'book')).toBe(FM('type: Type', 'icon: book'));
    // Missing: appended just before the closing delimiter.
    expect(setFrontmatterKey(fm, 'order', 2)).toBe(FM('type: Type', 'icon: user', 'order: 2'));
  });

  it('removes the line on an empty value instead of writing a blank key', () => {
    const fm = FM('type: Type', 'icon: user', 'color: red');
    expect(setFrontmatterKey(fm, 'color', null)).toBe(FM('type: Type', 'icon: user'));
    expect(setFrontmatterKey(fm, 'color', '')).toBe(FM('type: Type', 'icon: user'));
    // Removing an absent key changes nothing.
    expect(setFrontmatterKey(fm, 'order', null)).toBe(fm);
  });

  it('preserves every key the panel does not own, including underscore aliases', () => {
    const fm = FM('type: Type', '_organized: true', 'aliases: [a, b]', 'icon: user');
    const out = setFrontmatterKey(fm, 'icon', 'book');
    expect(out).toContain('_organized: true');
    expect(out).toContain('aliases: [a, b]');
    expect(out).toContain('icon: book');
  });

  it('creates a minimal block when the file has no frontmatter', () => {
    expect(setFrontmatterKey('', 'icon', 'user')).toBe('---\nicon: user\n---\n');
    // ...but does not create one just to remove a key.
    expect(setFrontmatterKey('', 'icon', null)).toBe('');
  });

  it('only allows the keys the panel owns', () => {
    expect(isSettableKey('icon')).toBe(true);
    expect(isSettableKey('order')).toBe(true);
    expect(isSettableKey('share_id')).toBe(false);
    expect(isSettableKey('type')).toBe(false);
  });
});

describe('type rename (ADR 0045, criterion 7)', () => {
  it('rewrites `type:` only when it currently holds the old name', () => {
    expect(retypeLine(FM('type: Person'), 'Person', 'Human')).toBe(FM('type: Human'));
    // A note whose type drifted meanwhile is not reassigned by a stale rename.
    expect(retypeLine(FM('type: Place'), 'Person', 'Human')).toBe(FM('type: Place'));
  });

  it('matches a quoted value and leaves the rest of the block alone', () => {
    const out = retypeLine(FM('type: "Person"', 'order: 1'), 'Person', 'Human');
    expect(out).toBe(FM('type: Human', 'order: 1'));
  });

  it('replaces the H1 that carries the type name, or adds one', () => {
    expect(setH1('# Person\n\nA human being.\n', 'Human')).toBe('# Human\n\nA human being.\n');
    expect(setH1('no heading here\n', 'Human')).toBe('# Human\n\nno heading here\n');
    // Only the first H1 moves; a `#` deeper in the body is left alone.
    expect(setH1('# Person\n\n## Notes\n', 'Human')).toBe('# Human\n\n## Notes\n');
  });
});

describe('applyOps composition', () => {
  it('applies frontmatter keys, a retype and the H1 in one pass', () => {
    const raw = `${FM('type: Type', '_organized: true', 'icon: user')}\n# Person\n\nPeople I know.\n`;
    const out = applyOps(raw, {
      frontmatter: { icon: 'users', color: 'blue', order: 1 },
      h1: 'Human',
    });
    expect(out).toContain('icon: users');
    expect(out).toContain('color: blue');
    expect(out).toContain('order: 1');
    expect(out).toContain('_organized: true'); // untouched
    expect(out).toContain('# Human');
    expect(out).toContain('People I know.'); // body preserved
  });

  it('ignores frontmatter keys outside the settable set', () => {
    const raw = `${FM('type: Type')}\n# Person\n`;
    // Defence in depth: the handler rejects these, and applyOps drops them too.
    expect(applyOps(raw, { frontmatter: { share_id: 'sneaky' } })).not.toContain('sneaky');
  });

  it('rewrites a carrying note without disturbing its body', () => {
    const raw = `${FM('type: Person', 'tags: [friend]')}\n# Ada\n\nMet in 1843.\n`;
    const out = applyOps(raw, { retype: { from: 'Person', to: 'Human' } });
    expect(out).toBe(`${FM('type: Human', 'tags: [friend]')}\n# Ada\n\nMet in 1843.\n`);
  });
});

describe('path safety', () => {
  it('keeps rejecting traversal, hidden dirs and non-markdown paths', () => {
    expect(isSafeNotePath('notes/ada.md')).toBe(true);
    expect(isSafeNotePath('../secret.md')).toBe(false);
    expect(isSafeNotePath('.web/config.md')).toBe(false);
    expect(isSafeNotePath('notes/ada.txt')).toBe(false);
  });
});
