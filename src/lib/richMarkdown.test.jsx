// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor } from '@blocknote/core';
import { schema, injectCustomBlocks } from './blocknoteSchema.jsx';
import { parseMapCardLine } from './mdLinks.js';
import { parseInline } from './inlineText.js';
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

// BlockNote's HTML step lifts every non-list child out of its `<li>`, keeping
// the depth only in an attribute the markdown step never reads, so the export
// walks the block tree itself. The indent is what holds the block inside the
// item, so these are about the document's structure, not only its bytes.
describe('a block nested under a list item keeps its indent (ADR 0015)', () => {
  const rt = async (body) => (await roundTripBody(body)).replace(/\n+$/, '');

  it.each([
    ['a paragraph', '- item\n\n  more prose'],
    ['a blockquote', '- item\n\n  > quoted'],
    ['a heading', '- item\n\n  # nope'],
    ['a table', '- item\n\n  | a | b |\n  |---|---|\n  | 1 | 2 |'],
    ['a code fence', '- item\n\n  ```\n  x\n  ```'],
    ['two paragraphs in one item', '- item\n\n  first\n\n  second'],
    ['a child two levels down', '- a\n  - b\n\n    prose'],
    ['a child three levels down', '- a\n  - b\n    - c\n\n      prose'],
  ])('round-trips %s unchanged', async (_name, body) => {
    expect(await rt(body)).toBe(body);
  });

  // Children line up with the item's text column, so the indent is the width of
  // the marker actually emitted — two for a bullet, three for `1. `, four for
  // `10. `. A fixed two-space indent passes the bullet cases and fails these.
  it.each([
    ['an ordered item', '1. one\n\n   prose'],
    ['a two-digit ordinal', '10. ten\n\n    prose'],
  ])('indents a child of %s to the marker width', async (_name, body) => {
    expect(await rt(body)).toBe(body);
  });

  // A run of items is exported in one call so the exporter counts the ordinals;
  // exporting item by item restarts every list at 1.
  it('keeps ordinals across a run', async () => {
    expect(await rt('1. one\n2. two\n3. three')).toBe('1. one\n2. two\n3. three');
  });

  it('keeps ordinals when a nested block interrupts the run', async () => {
    const body = '1. one\n\n   prose\n\n2. two';
    expect(await rt(body)).toBe(body);
  });

  // Two lists of different types are separated by a blank line in the exporter's
  // output, so one emitted line no longer pairs with one item. Pairing them
  // regardless dropped the second list outright — content loss, not a rewrite.
  it.each([
    ['a bullet list followed by an ordered one', '- a\n\n1. b'],
    ['three alternating lists', '- a\n\n1. b\n\n- c'],
    ['a nested block before the type changes', '- a\n\n  prose\n\n1. b'],
  ])('does not lose %s', async (_name, body) => {
    expect(await rt(body)).toBe(body);
  });

  // The one child type the exporter already indented: it must not regress.
  it.each([
    ['a nested list', '- a\n  - b'],
    ['a tight list', '- one\n- two'],
    ['a top-level table', '| a | b |\n|---|---|\n| 1 | 2 |'],
    ['a mixed document', '# H\n\npara\n\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |'],
  ])('leaves %s unchanged', async (_name, body) => {
    expect(await rt(body)).toBe(body);
  });

  it.each([
    '- item\n\n  more prose',
    '1. one\n\n   prose\n\n2. two',
    '- a\n\n1. b',
  ])('is idempotent — a second round-trip of %j is a no-op', async (body) => {
    const once = await rt(body);
    expect(await rt(once)).toBe(once);
  });

  // A checklist item needs its own handling: the markdown parser counts the
  // item's content column including the `[ ] ` marker, so a child written at the
  // idiomatic column 2 is read as a sibling and leaves the item. The same child
  // under a plain bullet nests correctly, which is what makes these worth
  // pinning separately from the cases above.
  it.each([
    ['a paragraph', '- [ ] todo\n\n  note'],
    ['a paragraph under a checked item', '- [x] done\n\n  note'],
    ['a blockquote', '- [ ] todo\n\n  > q'],
    ['a code fence', '- [ ] todo\n\n  ```\n  x\n  ```'],
    ['a child between two items', '- [ ] a\n\n  note\n\n- [ ] b'],
  ])('keeps %s inside a checklist item', async (_name, body) => {
    expect(await rt(body)).toBe(body);
  });

  it.each([
    ['a plain checklist', '- [ ] a\n- [x] b'],
    ['a block that follows the list', '- [ ] a\n\nafter'],
  ])('leaves %s unchanged', async (_name, body) => {
    expect(await rt(body)).toBe(body);
  });

  it('is idempotent for a checklist child', async () => {
    const once = await rt('- [ ] todo\n\n  note');
    expect(await rt(once)).toBe(once);
  });
});

// A note that documents the wikilink syntax writes `[[` in a code span, and the
// link passes used to read that as the start of a link: the character classes
// admitted newlines, so an unmatched `[[` matched through to the next `]]`
// anywhere later in the note and swallowed the blocks in between into one inline
// token. The tokens decode symmetrically, so the body still round-trips — the
// loss is in what the editor shows, and it becomes permanent as soon as the user
// edits the mangled block. That is why these assert the BLOCK STRUCTURE and not
// only the bytes.
describe('the link passes leave code alone (ADR 0015, ADR 0008)', () => {
  const rt = async (body) => (await roundTripBody(body)).replace(/\n+$/, '');
  const types = async (body) => (await bodyToBlocks(body)).map((b) => b.type);
  // The text of a block as the editor shows it, code spans included: what the
  // encoded blob used to destroy.
  const text = (block) =>
    (Array.isArray(block.content) ? block.content : []).map((s) => s.text ?? '').join('');

  // Shape 1: the reported case. An unmatched `[[` in a code span with a real
  // wikilink further down — four blocks became two, the second heading gone.
  it('keeps every block when a code span holds an unmatched wikilink opener', async () => {
    const body = [
      '### Wikilinks',
      '',
      'Type `[[` to trigger autocomplete.',
      '',
      '### Tasks',
      '',
      'See [[welcome]] for more.',
    ].join('\n');
    const blocks = await bodyToBlocks(body);
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'heading', 'paragraph']);
    expect(text(blocks[2])).toBe('Tasks');
    expect(await rt(body)).toBe(body);
  });

  // Shape 2: the same-line variant. The structure held, but the code span's
  // closing backtick was encoded into the token, so the span never closed.
  it('keeps the code span closed when the wikilink follows it on the same line', async () => {
    const body = 'Type `[[` then [[welcome]].';
    const [block] = await bodyToBlocks(body);
    expect(spanStyles(block)).toEqual([{}, { code: true }, {}]);
    expect(text(block)).toBe('Type [[ then ‹welcome›.');
    expect(await rt(body)).toBe(body);
  });

  // Shape 3: a complete wikilink inside a fence is content, not a link — the
  // wikilink pass runs before preProcessFences, so it had to learn fences itself.
  it('leaves a wikilink inside a fenced block literal', async () => {
    const body = '```\nUse [[some note]] to link.\n```';
    const [block] = await bodyToBlocks(body);
    expect(block.type).toBe('codeBlock');
    expect(text(block)).toBe('Use [[some note]] to link.');
    expect(await rt(body)).toBe(body);
  });

  it.each([
    ['a bare opener before a real link on one line', 'Write `[[` before [[target]] here.'],
    ['a complete wikilink in a code span', 'Write `[[note]]` to link.'],
    ['an aliased wikilink in code beside a real one', 'Write `[[a|b]]` for [[target|alias]].'],
    ['a code span containing `]]`', 'Close with `]]` then [[target]] after.'],
    ['a lone opener with no closer anywhere', 'Type `[[` and nothing else.'],
    ['an aliased wikilink inside a fence', '```\nUse [[a|b]] here.\n```'],
    ['a labelled fence holding a wikilink', '```md\nSee [[welcome]].\n```'],
    // A target carrying a heading anchor is parsed only where the href is built,
    // never written back, and the `#` rides inside the token percent-encoded.
    ['a wikilink target carrying an anchor', 'See [[folder/nota#heading]] below.'],
    ['an aliased wikilink target carrying an anchor', 'See [[folder/nota#heading|Alias]].'],
    // The media pass shares the shape of the problem, so it gets the same cases.
    ['a media link in a code span', 'Write `[c](attachments/a.mp4)` to embed.'],
    ['a media link inside a fence', '```\n[c](attachments/a.mp4)\n```'],
    ['an unmatched `[` in code before a real media link', 'Type `[` then [c](attachments/a.mp4).'],
  ])('round-trips %s unchanged', async (_name, body) => {
    expect(await rt(body)).toBe(body);
  });

  // An unmatched `[` in code used to let the media pass run away across blocks
  // in the same way; the structure is the assertion that catches it.
  it('keeps every block when a code span holds an unmatched link opener', async () => {
    const body = 'Type `[` here.\n\n## Next\n\nSee [c](attachments/a.mp4) below.';
    expect(await types(body)).toEqual(['paragraph', 'heading', 'paragraph']);
    expect(await rt(body)).toBe(body);
  });

  // Links outside code must still be protected — the narrowing must not turn
  // into a blanket opt-out.
  it('still tokenises links outside code', async () => {
    const body = 'See [[target|alias]] and [c](attachments/a.mp4).';
    const protectedBody = preProcessMediaLinks(preProcessWikilinks(body));
    expect(protectedBody).toContain('‹target%7Calias›');
    expect(protectedBody).toContain('⟦%5Bc%5D(attachments%2Fa.mp4)⟧');
    expect(await rt(body)).toBe(body);
  });

  // preProcessWikilinks is only safe because postProcessWikilinks is its exact
  // inverse: the pre pass rewrites an untouched note, and only a faithful
  // inverse makes it commit byte-identical. Same for the media pass. Break
  // either half and these fail.
  it.each([
    ['wikilinks', preProcessWikilinks, postProcessWikilinks],
    ['media links', preProcessMediaLinks, postProcessMediaLinks],
  ])('the %s post pass is the exact inverse of the pre pass', (_name, pre, post) => {
    for (const body of [
      'See [[target]] and [[a|b]] here.',
      'Type `[[` then [[welcome]].',
      '```\nUse [[a|b]] here.\n```',
      'A [c](attachments/a.mp4) and `[c](attachments/b.mp4)` span.',
      'Plain prose with no links at all.',
    ]) {
      expect(post(pre(body))).toBe(body);
    }
  });

  it.each([
    '### A\n\nType `[[` here.\n\n### B\n\nSee [[welcome]].',
    'Write `[[note]]` to link.',
    '```\nUse [[some note]] to link.\n```',
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

// A wikilink inside a table cell used to survive neither direction: the cell's
// content is a `tableContent` object rather than an inline array, so the token
// was never turned into a chip and stayed on screen as ‹portafoglio%2F…›; and
// the alias pipe, restored before the row was compacted, split the cell in two.
describe('wikilinks inside a table (ADR 0015, ADR 0008)', () => {
  const body = [
    '| A | B |',
    '|---|---|',
    '| x | See [[folder/target]] |',
    '| y | **Bold** (see [[folder/target|Alias]]) |',
    '',
  ].join('\n');

  it('renders the cells as wikilink chips, not as raw tokens', async () => {
    const blocks = injectCustomBlocks(await bodyToBlocks(body));
    const table = blocks.find((b) => b.type === 'table');
    const cells = table.content.rows.map((row) =>
      row.cells.map((c) => (Array.isArray(c) ? c : c.content))
    );
    const inline = cells.flat(2);
    expect(inline.filter((it) => it.type === 'wikilink').map((it) => it.props)).toEqual([
      { target: 'folder/target', alias: '' },
      { target: 'folder/target', alias: 'Alias' },
    ]);
    expect(JSON.stringify(inline)).not.toContain('‹');
  });

  it('round-trips both the plain and the aliased form', async () => {
    await expect(roundTripBody(body).then(normalizeHarness)).resolves.toBe(
      normalizeHarness(body)
    );
  });
});

// adr/0049-*.md AC 8: a place card line carries two author fields now, and one
// of them may contain markdown — so the round-trip has to be exercised on the
// shapes that were previously impossible to write.
describe('a place card line survives the editor untouched (ADR 0049 AC 8)', () => {
  const url = 'https://www.google.com/maps/search/Il+Ciolo+Gagliano+del+Capo';

  it.each([
    ['a title and a description', `- [Ciolo](${url}) ~30 min. Fiordo con ciottoli`],
    ['a title only', `- [Ciolo](${url})`],
    ['a description only', `- ${url} ~30 min.`],
    ['neither', `- ${url}`],
    ['markdown in the description', `- [Ciolo](${url}) ~30 min, **spettacolare** ma \`scomodo\``],
    ['an ordered marker', `1. [Ciolo](${url}) nota`],
    ['a paragraph, not a list item', `[Ciolo](${url}) nota`],
  ])('round-trips %s', async (_case, body) => {
    await expect(roundTripBody(body).then(normalizeHarness)).resolves.toBe(
      normalizeHarness(body)
    );
  });

  it('round-trips a list of places with mixed shapes', async () => {
    const body = [
      '## Salento',
      '',
      `- [Ciolo](${url}) ~30 min. Fiordo, **spettacolare**`,
      `- ${url}`,
      `- [Otranto](${url}) centro storico`,
    ].join('\n');
    await expect(roundTripBody(body).then(normalizeHarness)).resolves.toBe(
      normalizeHarness(body)
    );
  });
});

// The rule is positional and nothing else: a paragraph or list item that STARTS
// with a Google Maps link is a place card, whatever the description that follows
// contains. It used to depend on the description too — a token whose payload
// still held markdown punctuation came back split across styled spans, the
// promotion required a single span, and the reader was shown the raw ⟬…⟭ token
// instead of the card.
describe('what becomes a place card (ADR 0028 AC 3, ADR 0049)', () => {
  const u = 'https://www.google.com/maps/search/Il+Ciolo';
  const cardsIn = async (body) => {
    const blocks = injectCustomBlocks(await bodyToBlocks(body));
    return JSON.stringify(blocks);
  };
  const count = (json) => (json.match(/"mapcard"/g) || []).length;

  it.each([
    ['a bare link in a bullet', `- ${u}`],
    ['an ordered item', `1. ${u}`],
    ['a paragraph', `${u}`],
    ['an autolink', `<${u}> desc`],
    ['a `*` bullet marker', `* [C](${u}) desc`],
    ['strong in the description', `- [C](${u}) a **b** c`],
    ['emphasis in the description', `- [C](${u}) a *b* c`],
    ['inline code in the description', '- [C](' + u + ') a `b` c'],
    ['strikethrough in the description', `- [C](${u}) a ~~b~~ c`],
    ['another link in the description', `- [C](${u}) see [x](https://e.com)`],
    ['an underscore in the description', `- [C](${u}) snake_case_x`],
    ['a place nested under a plain item', `- outer\n  - [C](${u}) **b**`],
  ])('promotes %s', async (_case, body) => {
    const json = await cardsIn(body);
    expect(count(json)).toBe(1);
    // The failure this guards is a token shown as text, so assert it directly.
    expect(json).not.toContain('⟬');
  });

  it('promotes every item of a list of places', async () => {
    const json = await cardsIn(`- [A](${u}) **x**\n- [B](${u}) *y*\n- ${u}`);
    expect(count(json)).toBe(3);
  });

  // "Only if it STARTS the block" — a link buried in prose stays a plain link.
  it.each([
    ['a link mid-sentence', `Meet at ${u} later`],
    ['a bullet whose text starts before the link', `- go to ${u}`],
    ['a heading', `## ${u}`],
  ])('leaves %s alone', async (_case, body) => {
    expect(count(await cardsIn(body))).toBe(0);
  });

  it.each([
    ['strong', `- [C](${u}) a **b** c`],
    ['emphasis', `- [C](${u}) a *b* c`],
    ['strikethrough', `- [C](${u}) a ~~b~~ c`],
    ['a link', `- [C](${u}) see [x](https://e.com)`],
    ['an underscore', `- [C](${u}) snake_case_x`],
    ['an exclamation mark', `- [C](${u}) wow!`],
    ['a place nested under a plain item', `- outer\n  - [C](${u}) **b**`],
  ])('round-trips a description containing %s', async (_case, body) => {
    await expect(roundTripBody(body).then(normalizeHarness)).resolves.toBe(
      normalizeHarness(body)
    );
  });
});

// The parser consumes `**`/`*`/`` ` ``/`~~` into a span's `styles` on the way
// in, so a card promoted from several styled spans must have those markers
// RE-EMITTED into its token. Without that the vault file still round-trips
// correctly — the exporter re-applies the styles on the way out — but the card
// renders from the token, so the emphasis the author wrote is silently flat on
// screen and comes back only after a fresh keystroke. Reported against 0049 AC 7.
describe("a place card's description keeps its markup (ADR 0049 AC 7)", () => {
  const u = 'https://www.google.com/maps/search/Il+Ciolo';
  const tokenOf = async (body) => {
    const blocks = injectCustomBlocks(await bodyToBlocks(body));
    const m = JSON.stringify(blocks).match(/"token":"([^"]*)"/);
    return m ? decodeURIComponent(m[1]) : null;
  };

  it.each([
    ['strong', 'a **b** c'],
    ['emphasis', 'a *b* c'],
    ['inline code', 'a `b` c'],
    ['strikethrough', 'a ~~b~~ c'],
    ['strong wrapping code', 'a **`b`** c'],
    ['two runs', '**x** and **y**'],
    ['markup at the start', '**x** rest'],
    ['markup at the end', 'rest **x**'],
  ])('carries %s through to the card', async (_case, desc) => {
    const line = `- [C](${u}) ${desc}`;
    expect(await tokenOf(line)).toBe(line);
  });

  it('renders the emphasis rather than showing it as text', async () => {
    const token = await tokenOf(`- [C](${u}) a **b** c`);
    const parsed = parseMapCardLine(token);
    expect(parseInline(parsed.desc).map((t) => t.type)).toEqual(['text', 'strong', 'text']);
  });
});
