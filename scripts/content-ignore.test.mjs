// The watcher must agree with the content walker about which files matter:
// regenerating on a file the walker ignores is wasted work, and ignoring one it
// reads means the dev server serves stale content.
// See plan/done/2026-08-05-dev-server-vault-watch.md.
import { describe, it, expect } from 'vitest';
import { isWalkedNote } from './content-ignore.mjs';

describe('isWalkedNote', () => {
  it('accepts a note at the vault root and in a nested folder', () => {
    expect(isWalkedNote('welcome.md')).toBe(true);
    expect(isWalkedNote('projects/2026/plan.md')).toBe(true);
  });

  it('rejects non-markdown files', () => {
    expect(isWalkedNote('notes/diagram.png')).toBe(false);
    expect(isWalkedNote('data.yml')).toBe(false);
    expect(isWalkedNote('README')).toBe(false);
  });

  it('rejects the agent instruction files the walker skips', () => {
    expect(isWalkedNote('AGENTS.md')).toBe(false);
    expect(isWalkedNote('CLAUDE.md')).toBe(false);
    expect(isWalkedNote('GEMINI.md')).toBe(false);
    // ...but only by exact name: a note that merely mentions one is a note.
    expect(isWalkedNote('about-AGENTS.md')).toBe(true);
  });

  it('rejects anything inside an ignored directory, at any depth', () => {
    expect(isWalkedNote('node_modules/pkg/readme.md')).toBe(false);
    expect(isWalkedNote('attachments/scan.md')).toBe(false);
    expect(isWalkedNote('views/saved.md')).toBe(false);
    expect(isWalkedNote('projects/node_modules/x/doc.md')).toBe(false);
  });

  it('rejects dotted directories and dotted files', () => {
    expect(isWalkedNote('.web/notes/x.md')).toBe(false);
    expect(isWalkedNote('.git/COMMIT_EDITMSG.md')).toBe(false);
    expect(isWalkedNote('notes/.hidden.md')).toBe(false);
    expect(isWalkedNote('.obsidian/workspace.md')).toBe(false);
  });

  it('rejects paths that escape the vault, and empty input', () => {
    expect(isWalkedNote('../outside.md')).toBe(false);
    expect(isWalkedNote('')).toBe(false);
  });

  it('does not mistake a dot inside a name for a dotted segment', () => {
    expect(isWalkedNote('meeting.2026-08-05.md')).toBe(true);
    expect(isWalkedNote('v1.2/notes.md')).toBe(true);
  });
});
