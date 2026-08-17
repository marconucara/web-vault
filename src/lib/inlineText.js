// A place card's description is the author's prose, so it carries the emphasis
// they wrote (adr/0049-*.md AC 7). It is rendered in two very different places —
// as React inside the card's anchor, and as an HTML string inside a Leaflet
// popup — so the PARSING lives here once and each surface only renders the
// tokens. Two parsers would be two sets of edge cases and, worse, two escaping
// stories.
//
// Deliberately tiny: strong, emphasis and inline code, nothing else. The
// description is one line of prose, not a document — links, images and block
// constructs belong to the note body, and a full markdown pipeline in a map
// popup would cost more than it renders. Anything unrecognised stays literal
// (AC 7), which is also the safe default: unmatched `**` is text, never a
// dangling tag.

// `code` first: backticks win over emphasis in markdown, so a span of code
// containing asterisks stays code. Then strong before em, so `**x**` is not read
// as two ems. Underscore forms are intentionally left out — they collide with
// snake_case in the middle of prose, which is common in these notes and would
// silently italicise half a sentence.
const RULES = [
  { type: 'code', re: /`([^`]+)`/ },
  { type: 'strong', re: /\*\*(?!\s)([^*]+?)(?<!\s)\*\*/ },
  { type: 'em', re: /\*(?!\s)([^*]+?)(?<!\s)\*/ },
  // The editor's own strikethrough button writes `~~`, so a description can
  // acquire one without the author ever typing markdown.
  { type: 'strike', re: /~~(?!\s)([^~]+?)(?<!\s)~~/ },
];

// Split a line into { type, value } tokens: 'text' | 'strong' | 'em' | 'code'.
// Emphasis does not nest — a description is one line of prose, and nesting buys
// nothing here while costing a recursive parser.
export function parseInline(input) {
  const src = String(input == null ? '' : input);
  const out = [];
  let rest = src;
  while (rest) {
    // The earliest match across all rules wins, so the order of constructs in
    // the text decides, not the order of the rules. Ties go to RULES order,
    // which is why `code` is listed first.
    let best = null;
    for (const rule of RULES) {
      const m = rest.match(rule.re);
      if (m && (best === null || m.index < best.m.index)) best = { rule, m };
    }
    if (!best) {
      out.push({ type: 'text', value: rest });
      break;
    }
    if (best.m.index > 0) out.push({ type: 'text', value: rest.slice(0, best.m.index) });
    out.push({ type: best.rule.type, value: best.m[1] });
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  // Merge adjacent text runs so a caller rendering one node per token does not
  // emit a spray of fragments for plain prose.
  return out.reduce((acc, tok) => {
    const prev = acc[acc.length - 1];
    if (tok.type === 'text' && prev && prev.type === 'text') prev.value += tok.value;
    else if (tok.value !== '') acc.push({ ...tok });
    return acc;
  }, []);
}

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TAG = { strong: 'strong', em: 'em', code: 'code', strike: 'del' };

// The same tokens as an HTML string, for the Leaflet popup — which takes HTML,
// not React. Every token's VALUE is escaped, so the only markup that can reach
// the DOM is the fixed tag set above; author text can never become an element.
export function inlineHtml(input) {
  return parseInline(input)
    .map((tok) => {
      const value = escapeHtml(tok.value);
      const tag = TAG[tok.type];
      return tag ? `<${tag}>${value}</${tag}>` : value;
    })
    .join('');
}
