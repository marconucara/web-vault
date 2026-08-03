# Wikilink Pre-processing Must Skip Inline Code

**Owning ADR(s):** `adr/0015-durable-markdown-round-trip.md`, `adr/0008-wikilink-resolution.md`
**Dependencies:** None

## Context

`preProcessWikilinks` applies its `[[...]]` regex to the whole body, including
spans of inline code. A note that *documents* the wikilink syntax — writing
`` `[[` `` inside backticks — has that literal opening treated as a real
wikilink, which then closes on the next `]]` anywhere later in the text. The
span between them is swallowed into a single token.

Observed in the starter template's welcome note. Source:

```markdown
Type `[[` to link one note to another, like [[welcome]].
```

Rendered: the inline-code span ran from the backtick through `[[welcome`,
eating the sentence in between and destroying both the code span and the link.

The same hole applies to fenced code blocks, and by symmetry to
`preProcessMediaLinks` — `preProcessMapLinks` already tracks fences and is not
affected.

## Scope

- Make wikilink (and media-link) pre-processing skip inline code spans and
  fenced code blocks, so literal `[[` inside code stays literal.
- Cover the reverse direction: a token must not be restored inside a code span
  it never belonged to.
- Add round-trip cases for a note that documents the syntax it uses.

## Out of scope

- Escaping wikilinks outside code (e.g. a `\[[` escape hatch) — separate
  question, not needed to fix this.

## Exit criteria

1. A note containing `` `[[` `` in inline code round-trips unchanged, with the
   code span and any later real wikilink both intact.
2. The same holds inside a fenced code block.
3. Existing wikilink and media-link behaviour outside code is unchanged.
4. `yarn verify` green.
