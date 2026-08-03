// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  postProcessMediaLinks,
  postProcessWikilinks,
  preProcessMediaLinks,
  preProcessWikilinks,
  roundTripBody,
  roundTripNote,
  splitFrontmatter,
} from './richMarkdown.js';

const fixture = (name) => readFileSync(`src/lib/__fixtures__/${name}`, 'utf8');

const normalizeHarness = (s) => s.replace(/^\n+/, '').replace(/\s+$/, '');

describe('durable markdown round-trip helpers (ADR 0015, ADR 0016)', () => {
  it('preserves frontmatter outside the editable body', () => {
    expect(splitFrontmatter('---\ntype: Note\n---\n\n# Title')).toEqual({
      frontmatter: '---\ntype: Note\n---\n',
      body: '\n# Title',
    });
  });

  it('protects wikilinks and non-image media links through markdown serialization', () => {
    const body = 'See [[Target|Alias]] and [clip](attachments/movie.mp4), but keep ![img](attachments/img.png).';
    const protectedBody = preProcessMediaLinks(preProcessWikilinks(body));
    expect(protectedBody).toContain('‹Target%7CAlias›');
    expect(protectedBody).toContain('⟦%5Bclip%5D(attachments%2Fmovie.mp4)⟧');
    expect(postProcessWikilinks(postProcessMediaLinks(protectedBody))).toBe(body);
  });

  it('round-trips common markdown body constructs under assertions', async () => {
    const body = [
      '# Title',
      '',
      'Paragraph with [[Target]] and **strong** text.',
      '',
      '- one',
      '- two',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '',
    ].join('\n');

    await expect(roundTripBody(body).then(normalizeHarness)).resolves.toBe(normalizeHarness(body));
  });
});

// A hand-authored note soft-wraps its paragraphs and list items across source
// lines. That shape must survive an open-and-save untouched (ADR 0015 AC 1);
// each assertion below pins one way it used to degrade.
describe('round-trip of a soft-wrapped note (ADR 0015 AC 1)', () => {
  const source = fixture('soft-wrapped-note.md');
  const roundTripped = () => roundTripNote(source);

  it('does not turn source-level soft wraps into hard breaks', async () => {
    expect(await roundTripped()).not.toMatch(/\\$/m);
  });

  it('keeps emphasis spanning a soft wrap unsplit', async () => {
    expect(await roundTripped()).toContain('**public and read-only**');
  });

  it('does not emit a phantom bullet from a wrapped emphasis span', async () => {
    const body = (await roundTripped()).split('\n');
    // `- ` may only start a real list item, never a continuation line.
    const stray = body.filter((l) => /^-\s/.test(l) && !/^- (\[ \]|\[x\])?\s*\*\*/.test(l));
    expect(stray).toEqual([]);
  });

  it('keeps list-item continuation text inside its item', async () => {
    const out = await roundTripped();
    // The continuation is folded onto the item's line rather than escaping as
    // a sibling paragraph at column 0 — the wrap column is not preserved, the
    // item's membership in the list is.
    expect(out).toContain(
      '- [ ] **Make it private.** Until you do this, anyone with the URL can read your vault.'
    );
    expect(out).not.toMatch(/^vault\. Gate the site/m);
  });

  it('preserves ordered-list numbering across wrapped items', async () => {
    const out = await roundTripped();
    expect(out).toContain('4. **Share a note**');
  });

  it('preserves frontmatter and every paragraph verbatim', async () => {
    const out = await roundTripped();
    expect(out.startsWith('---\ntype: Note\n---\n')).toBe(true);
    expect(out).toContain(
      "You deployed this in a few clicks. It's a **starter vault** — a tiny Markdown\n" +
        'knowledge base with the web client already wired in. Right now the site is\n' +
        '**public and read-only**. Two unlocks finish the setup.'
    );
  });

  // Soft wraps inside a list item are folded onto one line, so the first save
  // of a hand-wrapped note reflows those items and the diff is not empty.
  // What must hold is that it settles: saving again changes nothing further,
  // so an untouched note stops churning after that first normalization.
  it('is idempotent — a second round-trip is a no-op', async () => {
    const once = await roundTripped();
    expect(await roundTripNote(once)).toBe(once);
  });
});
