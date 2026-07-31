// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  postProcessMediaLinks,
  postProcessWikilinks,
  preProcessMediaLinks,
  preProcessWikilinks,
  roundTripBody,
  splitFrontmatter,
} from './richMarkdown.js';

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
