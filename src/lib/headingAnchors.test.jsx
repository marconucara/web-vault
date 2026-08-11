// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BlockNoteEditor, defaultBlockSpecs } from '@blocknote/core';
import { blockText, headingSpecWithAnchors, refreshHeadingAnchors, isCopyIconHit, copyHeadingLink } from './headingAnchors.js';
import { schema } from './blocknoteSchema.jsx';
import { loadBodyIntoEditor } from './richMarkdown.js';
import { renderBody } from '../../scripts/shared-render.mjs';
import { readFileSync } from 'node:fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Mounts a real editor on a real body. The ids are produced by BlockNote's own
// render, so a hand-built DOM fixture would prove nothing about them — an
// earlier version of this feature passed exactly such a fixture while being
// completely broken in the app, because ProseMirror discards anything written
// to its DOM from outside.
async function mountEditor(markdown) {
  const editor = BlockNoteEditor.create({ schema });
  const root = document.createElement('div');
  document.body.appendChild(root);
  editor.mount(root);
  await loadBodyIntoEditor(editor, markdown);
  await sleep(50);
  return { editor, root };
}

const headingIds = (root) =>
  [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((el) => el.id);

describe('reading heading text out of a block', () => {
  it('joins the text spans', () => {
    expect(blockText({ content: [
      { type: 'text', text: 'Getting ', styles: {} },
      { type: 'text', text: 'Started', styles: { bold: true } },
    ] })).toBe('Getting Started');
  });

  it('ignores chips, which carry no text', () => {
    expect(blockText({ content: [
      { type: 'text', text: 'See ', styles: {} },
      { type: 'wikilink', props: { target: 'notes/alpha', alias: '' } },
    ] })).toBe('See ');
  });

  it('is empty for a block with no inline content', () => {
    expect(blockText({ type: 'mapcard', content: undefined })).toBe('');
    expect(blockText(null)).toBe('');
  });
});

describe('the heading spec', () => {
  it('reuses the stock spec and overrides only how it renders', () => {
    // What keeps this cheap: the `Mod-Alt-N` shortcuts, the `#` input rules and
    // the slash-menu entries live in `extensions`, not in `render`, so they are
    // carried over untouched rather than reimplemented.
    const base = defaultBlockSpecs.heading;
    const spec = headingSpecWithAnchors(base);
    expect(spec.config).toBe(base.config);
    expect(spec.extensions).toBe(base.extensions);
    expect(spec.implementation.parse).toBe(base.implementation.parse);
    expect(spec.implementation.render).not.toBe(base.implementation.render);
  });
});

describe('anchors in the running editor', () => {
  it('puts a slug on every heading', async () => {
    const { root } = await mountEditor('# Note List\n\n### Search\n\ntext\n');
    expect(headingIds(root)).toEqual(['note-list', 'search']);
  });

  it('keeps the ids across repaints', async () => {
    // The regression that shipped broken: ids applied to the DOM from outside
    // were discarded within a frame, because ProseMirror recreates a block's
    // elements on every render. Coming from `render` itself, they survive.
    const { editor, root } = await mountEditor('# Note List\n\n### Search\n');
    await sleep(150);
    editor.insertBlocks(
      [{ type: 'paragraph', content: [{ type: 'text', text: 'more', styles: {} }] }],
      editor.document[editor.document.length - 1],
      'after'
    );
    await sleep(150);
    expect(document.getElementById('search')).not.toBe(null);
    expect(headingIds(root)).toEqual(['note-list', 'search']);
  });

  it('moves the anchor when the heading is renamed', async () => {
    // Typing does not re-run `render`, so this is the path the editor drives
    // from its change event (refreshHeadingAnchors), not the spec.
    const { editor, root } = await mountEditor('## Setup\n');
    expect(headingIds(root)).toEqual(['setup']);
    editor.updateBlock(editor.document[0], {
      content: [{ type: 'text', text: 'Installation', styles: {} }],
    });
    await sleep(50);
    refreshHeadingAnchors(root, editor.document);
    expect(headingIds(root)).toEqual(['installation']);
    expect(document.getElementById('setup')).toBe(null);
  });

  it('drops the anchor when a heading becomes a paragraph', async () => {
    const { editor, root } = await mountEditor('## Gone\n');
    editor.updateBlock(editor.document[0], { type: 'paragraph' });
    await sleep(100);
    refreshHeadingAnchors(root, editor.document);
    expect(headingIds(root)).toEqual([]);
  });

});

// AC 2: the app and the share pages render note bodies through completely
// different pipelines — BlockNote and react-markdown — and a link that resolves
// in one and dies in the other is worse than one that fails in both, because
// sharing is when a link leaves the author's control.
describe('the two surfaces agree', () => {
  const headings = ['Getting Started', 'What is it, really?', 'Città e paesi', '🚀 Launch day'];

  it('produces the same anchors for the same headings', async () => {
    const md = headings.map((t) => `## ${t}`).join('\n\n');
    const { root } = await mountEditor(md);
    const appSlugs = headingIds(root);

    const html = renderBody(md, {});
    const shareSlugs = [...html.matchAll(/<h2[^>]*\bid="([^"]*)"/g)].map((m) => m[1]);

    expect(shareSlugs).toEqual(appSlugs);
  });

  it('numbers duplicates across map-card segments on a share page', () => {
    // The share renderer splits the body into segments around map cards and
    // renders each separately. A per-render slugger (rehype-slug's own) would
    // restart the counter here and emit `setup` twice.
    const md = ['## Setup', '', 'https://maps.app.goo.gl/abc123', '', '## Setup'].join('\n');
    const html = renderBody(md, {});
    const slugs = [...html.matchAll(/<h2[^>]*\bid="([^"]*)"/g)].map((m) => m[1]);
    expect(slugs).toEqual(['setup', 'setup-1']);
  });

  it('differs on duplicates in the editor, which cannot number them', async () => {
    // Documented divergence, not an oversight: `render` sees one block and has
    // no document-wide counter, so both get `setup` and an anchor resolves to
    // the first. The share page, rendering the note in one pass, still numbers
    // them. See the note on headingSpecWithAnchors.
    const { root } = await mountEditor('## Setup\n\ntext\n\n## Setup\n');
    expect(headingIds(root)).toEqual(['setup', 'setup']);
  });
});

// The copy-link affordance. The icon is a `::after`, so it can never be an
// event target: which click counts as "on the icon" is decided by geometry,
// which is exactly the part worth pinning.
describe('the copy-link hit test', () => {
  // A heading whose last line of text ends at x=200, vertically 100..124.
  const textEnd = { right: 200, top: 100, height: 24 };
  const size = 24;
  // isCopyIconHit places the centre 0.9em past the text end, radius 0.85em.
  const centre = { x: 200 + 0.9 * size, y: 112 };

  it('accepts a click at the centre of the icon', () => {
    expect(isCopyIconHit(centre.x, centre.y, textEnd, size)).toBe(true);
  });

  it('accepts a click anywhere inside the circle, not just the glyph', () => {
    // Slightly high and to the left — the forgiving edge that makes a round
    // target easier to hit than the icon's own box.
    expect(isCopyIconHit(centre.x - 12, centre.y - 12, textEnd, size)).toBe(true);
  });

  it('rejects a click on the heading text, so the caret still lands there', () => {
    expect(isCopyIconHit(120, 112, textEnd, size)).toBe(false);
    expect(isCopyIconHit(textEnd.right - 1, centre.y, textEnd, size)).toBe(false);
  });

  it('rejects a click past the icon', () => {
    expect(isCopyIconHit(centre.x + 40, centre.y, textEnd, size)).toBe(false);
  });

  it('rejects a click on another line of a wrapped heading', () => {
    // The rect passed in is the LAST line; a click level with an earlier line
    // is far away vertically and must not copy.
    expect(isCopyIconHit(centre.x, centre.y - 40, textEnd, size)).toBe(false);
  });

  it('is inert without a measurable heading', () => {
    expect(isCopyIconHit(centre.x, centre.y, null, size)).toBe(false);
    expect(isCopyIconHit(centre.x, centre.y, textEnd, 0)).toBe(false);
  });
});

// The affordance is scoped to h2..h6 in the stylesheet AND in the click
// handler, and the two must agree: an icon nobody can see but that still
// answers clicks, or the reverse, is worse than not having it.
describe('the affordance is scoped to the same headings in CSS and JS', () => {
  const SELECTOR = '[data-content-type="heading"] > :is(h2,h3,h4,h5,h6)[id]';

  it('covers h2..h6 but not the note title', () => {
    const root = document.createElement('div');
    root.innerHTML = [1, 2, 3, 4, 5, 6]
      .map((l) => `<div data-content-type="heading"><h${l} id="s${l}">t</h${l}></div>`)
      .join('');
    const matched = [...root.querySelectorAll(SELECTOR)].map((el) => el.tagName);
    expect(matched).toEqual(['H2', 'H3', 'H4', 'H5', 'H6']);
  });

  it('uses the same selector in the stylesheet', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    // Every rule that draws or reveals the icon is scoped this way; if the CSS
    // is widened to h1 without the handler, this catches it.
    expect(css).toContain('> :is(h2,h3,h4,h5,h6)[id]::after');
    expect(css).not.toContain('> :is(h1,h2,h3,h4,h5,h6)[id]::after');
  });
});

describe('copying the link', () => {
  const heading = () => {
    const el = document.createElement('h2');
    el.setAttribute('id', 'search');
    return el;
  };

  it('copies an absolute URL addressing the heading', async () => {
    const written = [];
    const el = heading();
    await copyHeadingLink(el, 'tolaria-note-list', { writeText: (t) => { written.push(t); return Promise.resolve(); } });
    expect(written[0]).toContain('#/n/tolaria-note-list#search');
    expect(written[0]).toMatch(/^https?:\/\//);
    expect(el.classList.contains('anchor-copied')).toBe(true);
  });

  it('does nothing for a heading with no anchor', async () => {
    const el = document.createElement('h2');
    let called = false;
    await copyHeadingLink(el, 'notes/alpha', { writeText: () => { called = true; return Promise.resolve(); } });
    expect(called).toBe(false);
  });

  it('stays quiet when the clipboard refuses', async () => {
    const el = heading();
    const ok = await copyHeadingLink(el, 'notes/alpha', { writeText: () => Promise.reject(new Error('denied')) });
    expect(ok).toBe(false);
    expect(el.classList.contains('anchor-copied')).toBe(false);
  });
});
