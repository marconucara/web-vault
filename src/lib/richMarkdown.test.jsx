// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  postProcessMediaLinks,
  postProcessWikilinks,
  preProcessMediaLinks,
  preProcessWikilinks,
  roundTripBody,
  bodyToBlocks,
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

// The fixture is a verbatim copy of the starter template's `welcome.md` — the
// first note most people ever open in the editor, and the one whose degradation
// would be most visible. Keep the two copies in sync: when the template's
// welcome note changes, update `src/lib/__fixtures__/welcome.md` to match.
//
// A hand-authored note soft-wraps its paragraphs and list items across source
// lines. That shape must survive an open-and-save untouched (ADR 0015 AC 1);
// each assertion below pins one way it used to degrade.
describe('round-trip of the starter welcome note (ADR 0015 AC 1)', () => {
  const source = fixture('welcome.md');
  const roundTripped = () => roundTripNote(source);

  it('does not turn source-level soft wraps into hard breaks', async () => {
    expect(await roundTripped()).not.toMatch(/\\$/m);
  });

  it('keeps emphasis spanning a soft wrap unsplit', async () => {
    expect(await roundTripped()).toContain('**public and read-only**');
  });

  it('does not emit a phantom bullet from a wrapped emphasis span', async () => {
    const lines = (await roundTripped()).split('\n');
    // Every `- ` line must be a real item: a task box or a link (the map list),
    // never a stray continuation that a wrapped emphasis run turned into one.
    const stray = lines.filter(
      (l) => /^- /.test(l) && !/^- (\[[ x]\] )?(\*\*|\[)/.test(l)
    );
    expect(stray).toEqual([]);
  });

  it('keeps list-item continuation text inside its item', async () => {
    const out = await roundTripped();
    // The continuation is folded onto the item's line rather than escaping as
    // a sibling paragraph at column 0 — the wrap column is not preserved, the
    // item's membership in the list is.
    expect(out).toContain(
      '- [ ] **🔒 Make it private (⚠️ important).** Until you do this, anyone with the URL can read your vault.'
    );
    expect(out).not.toMatch(/^URL can read your vault/m);
  });

  it('preserves ordered-list numbering across wrapped items', async () => {
    const out = await roundTripped();
    expect(out).toContain('4. **Share a note**');
  });

  it('preserves frontmatter, headings and prose wording', async () => {
    const out = await roundTripped();
    expect(out.startsWith('---\ntype: Note\n---\n')).toBe(true);
    expect(out).toContain('# Welcome to your WebVault 👋');
    expect(out).toContain('## ✅ Finish your setup');
    // Wording and emphasis survive; only the wrap columns may move.
    expect(out.replace(/\s+/g, ' ')).toContain(
      "You deployed this in a few clicks. It's a **starter vault** — a tiny Markdown " +
        'knowledge base with WebVault already wired in. Right now the site is ' +
        '**public and read-only**.'
    );
  });

  it('keeps the map links intact as their own numbered list items', async () => {
    const out = await roundTripped();
    // The numbering is what pairs a place card with its marker on the map, so
    // the ordinal has to survive along with the URL. A bare URL must stay bare:
    // wrapping it in `[text](url)` would put a label on a card that is meant to
    // take its name from the place itself.
    const pins = out.match(/^\d+\. https:\/\/maps\.app\.goo\.gl\/\w+$/gm) || [];
    expect(pins).toHaveLength(3);
    expect(pins[0]).toMatch(/^1\. /);
    expect(pins[2]).toMatch(/^3\. /);
  });

  it('keeps the wikilink intact', async () => {
    expect(await roundTripped()).toContain('[[welcome]]');
  });

  // Every Google Maps URL is a valid pin — a `?q=…` search link resolves to
  // coordinates and renders a card, just a bare one, with no name, address or
  // photo behind it. This asserts nothing about what the resolver accepts; it
  // pins an editorial choice for THIS note, which exists to show place cards at
  // their best and so links to specific places.
  it('showcases place cards with share links', () => {
    expect(source.match(/https:\/\/maps\.app\.goo\.gl\/\w+/g) || []).toHaveLength(3);
  });

  // The editor shows a block's text as one line, so a `\n` left inside it is
  // rendered as a break the author never typed — the source's wrap column
  // leaking into the reading experience.
  it('leaves no literal newline inside a block of prose', async () => {
    const blocks = await bodyToBlocks(splitFrontmatter(source).body);
    const withBreak = [];
    const walk = (list) => {
      for (const b of list) {
        for (const span of b.content || []) {
          if (typeof span?.text === 'string' && span.text.includes('\n')) {
            withBreak.push(`${b.type}: ${JSON.stringify(span.text.slice(0, 60))}`);
          }
        }
        if (b.children?.length) walk(b.children);
      }
    };
    walk(blocks);
    expect(withBreak).toEqual([]);
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
