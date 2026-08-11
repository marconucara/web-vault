// Heading anchors inside the always-editable app surface.
//
// The app has no read-only reader: every note body is a live BlockNote editor
// (adr/0044-what-the-url-addresses.md). So an anchor target here is a heading in
// a `contenteditable` document whose text changes as the user types, and the id
// has to follow it.
//
// The id is put on by the heading's own `render`, not stamped onto the DOM
// afterwards. Stamping does not work at all here, which is worth recording so
// it is not retried: ProseMirror recreates a block's elements on every render,
// so ids written from outside are discarded within a frame or two — measured
// against the running editor, the `<h_>` node had a different identity on each
// repaint and the ids set on one paint were gone by the next.
//
// Overriding `render` is nonetheless cheap, because it is the only thing being
// overridden. BlockNote builds the heading as
// `createHeadingBlockSpec(config, implementation, extensions)`, and everything
// that makes a heading behave like one — the `Mod-Alt-N` shortcuts, the `#`
// input rules, the slash menu and toolbar entries — lives in `extensions`,
// keyed off `type: "heading"`. The real spec is reused whole and only its
// `render` output is decorated, so none of that is reimplemented or forked:
// upstream keeps ownership of the heading, and this adds one attribute.

import { defaultBlockSpecs } from '@blocknote/core';
import { headingSlug, noteHash } from './headingSlug.js';

// The plain text of a block's inline content. Custom inline content — wikilink
// and media chips — carries no `text`, so it contributes nothing to the slug: a
// heading is addressed by the words in it.
export function blockText(block) {
  const content = block?.content;
  if (!Array.isArray(content)) return '';
  let out = '';
  for (const item of content) {
    if (typeof item?.text === 'string') out += item.text;
    else if (Array.isArray(item?.content)) out += blockText(item);
  }
  return out;
}

// Refreshes the ids of headings whose text changed since they were rendered.
//
// `render` runs when ProseMirror creates a node — a level change, a paste, the
// initial load — but NOT when text is typed into an existing heading, which
// updates the element in place. Without this, renaming a heading leaves the
// anchor on the old words until the block happens to be recreated.
//
// Driven from the editor's change event rather than a MutationObserver on the
// editor DOM. That was tried and is not viable: writing an attribute inside the
// observed subtree is itself a mutation ProseMirror answers with a repaint, and
// the resulting loop hangs the editor outright — reproduced, not theorised.
export function refreshHeadingAnchors(root, blocks) {
  if (!root) return;
  const byId = new Map();
  for (const el of root.querySelectorAll('[data-node-type="blockContainer"]')) {
    byId.set(el.getAttribute('data-id'), el);
  }
  const walk = (list) => {
    for (const block of list || []) {
      if (block?.type === 'heading') {
        const target = byId.get(block.id)?.querySelector('h1,h2,h3,h4,h5,h6');
        if (target) {
          const slug = headingSlug(blockText(block));
          // Only ever written when it differs, so this cannot itself provoke
          // the repaint it would then be reacting to.
          if (slug && target.getAttribute('id') !== slug) target.setAttribute('id', slug);
          else if (!slug && target.hasAttribute('id')) target.removeAttribute('id');
        }
      }
      if (Array.isArray(block?.children) && block.children.length) walk(block.children);
    }
  };
  walk(blocks);
}

// How far, in em, the icon's centre sits past the end of the heading text, and
// how wide its hit target is. Both are read against the heading's own font
// size, so they track `margin-left`/`width` in the stylesheet.
const ICON_CENTRE_EM = 0.9;
const ICON_RADIUS_EM = 0.85;

// Whether a click at (x, y) — viewport coordinates — landed on the copy icon.
//
// The icon is a `::after`, which is not a DOM node and so never appears as an
// event target: a click anywhere on the heading arrives as the heading itself.
// The hit test therefore has to be geometric. `textEnd` is the rectangle of the
// LAST line of the heading, since the icon follows the final word rather than
// the block: `getClientRects()` gives one rect per line.
//
// The target is a circle rather than the icon's own box: it is more forgiving
// at the edges, and it means no part of this has to match the icon's exact
// layout. Everything outside it stays a normal click, so the caret can still be
// placed anywhere in the heading — which matters more in an always-editable
// surface than the affordance does.
export function isCopyIconHit(x, y, textEnd, fontSize) {
  if (!textEnd || !fontSize) return false;
  const cx = textEnd.right + ICON_CENTRE_EM * fontSize;
  const cy = textEnd.top + textEnd.height / 2;
  const r = ICON_RADIUS_EM * fontSize;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// The rectangle of the last rendered line of a heading's TEXT.
//
// Measured with a Range over the contents rather than from the element: the
// `<h_>` is a block, so its own box spans the full column width and its right
// edge says nothing about where the words end. A Range gives one rect per line
// of text, so the last one ends at the final word — which is where the icon is.
export function lastLineRect(el) {
  if (typeof document === 'undefined' || !document.createRange) return null;
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = range.getClientRects();
  return rects.length ? rects[rects.length - 1] : el.getBoundingClientRect?.() || null;
}

// The absolute URL addressing a heading — what someone else can open.
export function headingLinkUrl(slug, noteId, href = window.location.href) {
  const url = new URL(href);
  url.hash = noteHash(noteId, slug);
  return url.toString();
}

// Copies the link to `heading` and flashes the confirmation on it.
//
// The confirmation is a class the stylesheet renders as a second pseudo-element,
// so no node is added to the editor here either. Removed on a timer, and the
// timer is stored on the element so repeated clicks reset it rather than
// stacking up and clearing an already-restarted flash.
// `clipboard` is only ever asked for `writeText`, so it is typed as that rather
// than as a whole `Clipboard` — which a test would otherwise have to fake in
// full to hand one in.
/** @param {{ writeText?: (text: string) => Promise<void> } | undefined} clipboard */
export function copyHeadingLink(heading, noteId, clipboard = navigator.clipboard) {
  const slug = heading.getAttribute('id');
  if (!slug || !noteId) return Promise.resolve(false);
  const flash = () => {
    heading.classList.add('anchor-copied');
    clearTimeout(heading.__copiedTimer);
    heading.__copiedTimer = setTimeout(() => heading.classList.remove('anchor-copied'), 1400);
  };
  return Promise.resolve(clipboard?.writeText?.(headingLinkUrl(slug, noteId)))
    .then(() => {
      flash();
      return true;
    })
    // Clipboard access can be refused (permissions, insecure origin). Silent:
    // the user asked to copy a link, not to be told about browser policy.
    .catch(() => false);
}

// The heading spec, with an `id` on the rendered element.
//
// The slug is computed per block, so duplicate headings inside one note cannot
// be disambiguated here — `render` sees one block and has no document-wide
// counter to consult, and a stateful one would renumber differently depending
// on the order ProseMirror happens to re-render in. Two headings with the same
// text therefore get the same id, and an anchor to it resolves to the first, as
// `getElementById` does. The share pages, which render a whole note in one
// pass, still number them `-1`, `-2`, … (adr/0044 AC 4); this is the one point
// where the two surfaces differ, and it is a limitation of addressing headings
// in a live editor rather than a difference in the slug rule.
export function headingSpecWithAnchors(base = defaultBlockSpecs.heading) {
  const render = base.implementation.render;
  return {
    ...base,
    implementation: {
      ...base.implementation,
      render(block, editor) {
        const out = render.call(this, block, editor);
        // `dom` is the `<h_>` itself in the plain case and the toggle wrapper
        // when the heading is toggleable; `contentDOM` is the `<h_>` in both,
        // which is what the anchor should point at.
        const target = out?.contentDOM || out?.dom;
        if (!target?.setAttribute) return out;

        const slug = headingSlug(blockText(block));
        if (slug) target.setAttribute('id', slug);
        return out;
      },
    },
  };
}
