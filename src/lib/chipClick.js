// What a click on an editor link chip (wikilink, media) should do.
//
// The chip lives in a `contenteditable=false` island inside a `contenteditable`
// root, where native anchor activation is not dependable across browsers, so the
// app decides the outcome itself rather than letting the anchor do it. BlockNote
// makes the same choice for ordinary links
// (`@blocknote/core/src/extensions/tiptap-extensions/Link/helpers/clickHandler.ts`).
// See adr/0016-wikilink-and-media-blocks.md.

// `event` only needs the flags a MouseEvent carries, so the decision is testable
// without a DOM. `resolved` is false for a dead wikilink — a chip with no target.
//
// The middle button resolves the same way whichever handler asks, so the two
// listeners a chip installs can divide the buttons between them rather than both
// answering for the same one — see `isChipAuxClick`.
export function chipClickIntent(event, resolved = true) {
  if (!resolved) return 'ignore';
  const { button = 0, metaKey, ctrlKey, shiftKey } = event || {};
  // Middle click is the browser's own "open in a new tab" gesture.
  if (button === 1) return 'new-tab';
  // Anything that is not a left click (right click above all) is left to the
  // browser, so its context menu — and the "Open in new tab" it offers on an
  // anchor — is never pre-empted.
  if (button !== 0) return 'ignore';
  if (metaKey || ctrlKey || shiftKey) return 'new-tab';
  return 'navigate';
}

// A chip listens on both `click` and `auxclick`, because the middle button is
// not dependably delivered as a `click` across browsers. Per the UI Events spec
// the two are disjoint — `click` is the primary button, `auxclick` every other
// one — but a browser that sent the middle button to both would open two tabs,
// so the split is enforced here instead of being assumed: `auxclick` answers for
// the middle button and nothing else, `click` for everything else.
export function isChipAuxClick(event) {
  return (event || {}).button === 1;
}
