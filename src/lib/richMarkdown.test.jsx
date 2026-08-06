// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor } from '@blocknote/core';
import { schema } from './blocknoteSchema.jsx';
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

// A block's content is a union (inline spans, or a table's rows): narrow it to
// the span list so a test can assert on the styles each span carries.
const spanStyles = (block) =>
  (Array.isArray(block.content) ? block.content : []).map((s) => s.styles);

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

// An emphasis run that contains an inline code span used to come back with its
// delimiters around the wrong text, and in the worst cases with the emphasis on
// the code span dropped outright — `**bold with `code`**` returned as
// `**bold with** `code``, losing formatting rather than merely churning syntax.
//
// Two things had to hold for that to be fixable. The parse must keep `code`
// alongside the emphasis marks (TipTap's `code` mark excludes every other mark
// by default, so the bold was gone before anything was serialised), and the
// export must bracket the whole run once instead of every span in turn.
describe('emphasis around an inline code span (ADR 0015)', () => {
  const rt = async (body) => (await roundTripBody(body)).replace(/\n+$/, '');

  // The shapes that motivated this: emphasis wrapping a code span in the
  // middle, at the closing edge, and at the opening edge of the run.
  it.each([
    'A **policy that leaves `/shared/*` public** here.',
    'A **bold with `code` inside** it.',
    'A **bold with `code`** at the end.',
    'Start **`code` then bold** end.',
    'A **`code`** end.',
  ])('round-trips %j unchanged', async (body) => {
    expect(await rt(body)).toBe(body);
  });

  // The parse is where the loss used to happen, so assert on the styles and not
  // only on the exported string: a code span inside a bold run must carry both.
  it('keeps code and emphasis on the same span through the parse', async () => {
    const blocks = await bodyToBlocks('A **bold with `code` inside** it.');
    const styles = spanStyles(blocks[0]);
    expect(styles).toEqual([
      {},
      { bold: true },
      { bold: true, code: true },
      { bold: true },
      {},
    ]);
  });

  it.each([
    ['single-delimiter emphasis', 'A *ital with `code` inside* it.'],
    ['strikethrough', 'A ~~struck with `code`~~ end.'],
    ['several code spans in one run', 'A **b `c1` m `c2` e** z.'],
    ['nested emphasis', 'A ***bold ital `c` mix*** end.'],
    ['a link inside the run', 'A **bold [link](http://x.com) here** end.'],
  ])('handles %s', async (_label, body) => {
    expect(await rt(body)).toBe(body);
  });

  // The stitch must not merge runs the author wrote as separate ones. These are
  // the cases that make the fix a real distinction rather than a blanket join.
  it.each([
    'A **bold** `code` end.',
    'A **bold**`code` end.',
    'A **bold with `code`** and **more `x`** end.',
    'A **bold** `code` and **bold2** `x` end.',
    'A **bold** [plain](http://x.com) **more** end.',
    'A `code with **stars** inside` end.',
    'Literal `a ** b` span.',
  ])('leaves genuinely separate runs alone: %j', async (body) => {
    expect(await rt(body)).toBe(body);
  });

  it('holds inside a list item, a quote and a table cell', async () => {
    for (const body of ['- **item `c` here** text', '> **quote `c` here** text', '| **a `c` b** | x |']) {
      expect(await rt(body)).toBe(body);
    }
  });

  it('is idempotent — a second round-trip is a no-op', async () => {
    const once = await rt('A **bold with `code` inside** it.');
    expect(await rt(once)).toBe(once);
  });
});

// A code block keeps only its language, so how the fence was written — the
// marker kind and length, the absence of an info string, the indent that nests
// it under a list item — survives the parse only by riding on that one field.
describe('a code fence round-trips as it was written (ADR 0015)', () => {
  const rt = async (body) => (await roundTripBody(body)).replace(/\n+$/, '');

  it.each([
    // The info string: `text` is the exporter's default for an unlabelled
    // block, so these two shapes are the pair the marking has to keep apart.
    ['bare', '```\nSee [[welcome]] here\n```'],
    ['explicit text', '```text\nSee [[welcome]] here\n```'],
    ['a real language', '```js\nconst a = 1;\n```'],
    ['an info string with spaces', '```js title="a b.js"\nconst a = 1;\n```'],
    // The marker: the exporter always emits three backticks.
    ['a longer marker', '````\nplain\n````'],
    ['a longer marker with a language', '````js\nlet a = 1;\n````'],
    ['a tilde fence', '~~~\nplain\n~~~'],
    ['a tilde fence with a language', '~~~js\nlet a = 1;\n~~~'],
    // The indent: a nested block is exported flattened to column zero.
    ['a fence inside a list item', '- item\n\n  ```\n  plain\n  ```'],
    ['a labelled fence inside a list item', '- item\n\n  ```js\n  let a = 1;\n  ```'],
    ['a fence inside an ordered item', '1. one\n\n   ```\n   x\n   ```'],
    ['a fence two levels deep', '- a\n  - b\n\n    ```\n    x\n    ```'],
    ['a nested fence followed by prose', '- item\n\n  ```\n  x\n  ```\n\nafter prose'],
    // Content shapes that must not be mistaken for structure.
    ['a blank line inside the block', '```\nline one\n\nline two\n```'],
    ['two adjacent fences', '```\none\n```\n\n```\ntwo\n```'],
  ])('round-trips %s unchanged', async (_name, body) => {
    expect(await rt(body)).toBe(body);
  });

  it('keeps the language prop the author declared', async () => {
    const [bare] = await bodyToBlocks('```\nplain\n```');
    const [explicit] = await bodyToBlocks('```text\nplain\n```');
    // Same block type, told apart only by the sentinel riding on the bare one.
    expect(bare.type).toBe('codeBlock');
    expect(bare.props.language).not.toBe(explicit.props.language);
    // The sentinel is an implementation detail of the round trip: it must never
    // reach the vault.
    expect(await rt('```\nplain\n```')).not.toMatch(/wv-fence/);
  });

  // A shorter marker inside a longer fence is content, not a close: if it were
  // treated as one, the fence state would invert and the marking would land on
  // the wrong lines.
  it('leaves a fence marker inside another fence alone', async () => {
    const body = '````\n```\nnested\n```\n````';
    expect(await rt(body)).toBe(body);
  });

  // The exporter lengthens the marker when the content holds a backtick run;
  // the carried length must not shorten it back and close the block early.
  it('does not shorten a marker the exporter had to lengthen', async () => {
    const body = '````\n```\nnested\n```\n````';
    const out = await rt(body);
    expect(out.split('\n')[0]).toBe('````');
  });

  it.each([
    '```\nplain\n```',
    '~~~js\nlet a = 1;\n~~~',
    '- item\n\n  ```\n  plain\n  ```',
  ])('is idempotent — a second round-trip of %j is a no-op', async (body) => {
    const once = await rt(body);
    expect(await rt(once)).toBe(once);
  });
});

// Relaxing the `code` mark's exclusion is an editor-wide change, not only a
// serialisation one: the same mark backs the formatting toolbar and paste. These
// pin the behaviour that relaxation is supposed to enable, so a future revert of
// the schema override fails here and not only on the round-trip assertions.
describe('code alongside emphasis in the editor (ADR 0015)', () => {
  it('lets the toolbar apply code over a bold selection, keeping both', () => {
    const ed = BlockNoteEditor.create({ schema });
    ed.replaceBlocks(ed.document, [
      { type: 'paragraph', content: [{ type: 'text', text: 'hello world', styles: {} }] },
    ]);
    ed._tiptapEditor.commands.selectAll();
    ed.toggleStyles({ bold: true });
    ed.toggleStyles({ code: true });
    expect(ed.document[0].content[0].styles).toEqual({ bold: true, code: true });
  });

  it('keeps both marks when rich HTML carrying bold code is pasted', async () => {
    const ed = BlockNoteEditor.create({ schema });
    const blocks = await ed.tryParseHTMLToBlocks(
      '<p>A <strong>bold with <code>code</code> inside</strong> it.</p>'
    );
    expect(spanStyles(blocks[0])).toEqual([
      {},
      { bold: true },
      { bold: true, code: true },
      { bold: true },
      {},
    ]);
  });
});
