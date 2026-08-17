import { describe, expect, it } from 'vitest';
import { inlineHtml, parseInline } from './inlineText.js';

// adr/0049-*.md AC 7: a place card's description renders inline emphasis, and
// anything it cannot render stays literal rather than disappearing.
describe('inline markdown in a place description (ADR 0049 AC 7)', () => {
  const types = (s) => parseInline(s).map((t) => `${t.type}:${t.value}`);

  it('renders strong, emphasis, inline code and strikethrough', () => {
    expect(types('a **b** c *d* e `f` g ~~h~~')).toEqual([
      'text:a ',
      'strong:b',
      'text: c ',
      'em:d',
      'text: e ',
      'code:f',
      'text: g ',
      'strike:h',
    ]);
  });

  it('reads ** as strong rather than as two emphases', () => {
    expect(types('**bold**')).toEqual(['strong:bold']);
  });

  it('keeps asterisks inside code as code', () => {
    expect(types('`a*b*c`')).toEqual(['code:a*b*c']);
  });

  it.each([
    ['unmatched strong', '~30 min. ** not bold'],
    ['unmatched emphasis', 'a * b'],
    ['a lone asterisk', '2 * 3'],
    ['an unmatched backtick', 'a ` b'],
    // Underscores are common in prose and identifiers; italicising across them
    // would silently reformat half a sentence.
    ['underscores', 'snake_case_name'],
  ])('leaves %s literal', (_case, input) => {
    expect(types(input)).toEqual([`text:${input}`]);
  });

  it('does not consume emphasis markers around whitespace', () => {
    expect(types('a * b * c')).toEqual(['text:a * b * c']);
  });

  it('merges adjacent plain runs and drops empty ones', () => {
    expect(parseInline('plain')).toEqual([{ type: 'text', value: 'plain' }]);
    expect(parseInline('')).toEqual([]);
  });
});

// The map popup takes an HTML string, so this is the one place author text is
// interpolated into markup.
describe('the popup HTML is escaped (ADR 0049 AC 7, ADR 0028)', () => {
  it('emits emphasis as tags', () => {
    expect(inlineHtml('a **b** c')).toBe('a <strong>b</strong> c');
    expect(inlineHtml('*i* and `k`')).toBe('<em>i</em> and <code>k</code>');
  });

  it('escapes markup in the author text, inside and outside emphasis', () => {
    expect(inlineHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
    expect(inlineHtml('**<b>x</b>**')).toBe('<strong>&lt;b&gt;x&lt;/b&gt;</strong>');
    expect(inlineHtml('a & b "q"')).toBe('a &amp; b &quot;q&quot;');
  });

  it('never emits a tag for an unmatched marker', () => {
    expect(inlineHtml('a ** b')).toBe('a ** b');
  });
});
