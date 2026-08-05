# Cover the wikilink/code-span interaction with tests

**Owning ADR(s):** `adr/0015-durable-markdown-round-trip.md`, `adr/0008-wikilink-resolution.md`
**Dependencies:** None

## Context

This item was originally filed as a bug. `preProcessWikilinks` applies its
`[[...]]` regex to the whole body including inline code, so a note that
*documents* the wikilink syntax — writing `` `[[` `` inside backticks — was
reported as rendering with the code span running from the backtick through
`[[welcome`, swallowing the sentence in between and destroying both the code
span and the link.

**Re-verified 2026-08-05 by running the round trip: that outcome no longer
reproduces.** The line from the starter template's welcome note,

```markdown
Type `[[` to link one note to another, like [[welcome]].
```

round-trips byte-identical today. So do a complete `[[note]]` inside a code
span, a wikilink inside a fenced block, an aliased `[[a|b]]` in code, and the
media-link equivalents.

The underlying asymmetry is real, though, and worth pinning. `preProcessWikilinks`
still produces a malformed token in the first case — it matches from the `[[`
inside the code span through to the `]]` of the later real link, and everything
in between (including the closing backtick) is percent-encoded into one token:

```
Type `[[` then [[welcome]].   ->   Type `‹%60%20then%20%5B%5Bwelcome›.
```

The round trip survives only because `postProcessWikilinks` decodes that token
symmetrically and restores the original text. Nothing enforces that symmetry.
Any change to the token format, to the encoding, or any step running between
pre- and post-processing that reorders or rewrites text would turn a currently
invisible asymmetry into visible corruption — with no test to catch it.

The value left in this item is therefore coverage, not a fix.

## Scope

- Add round-trip tests locking in the current (correct) behaviour:
  - a bare `` `[[` `` in inline code followed by a real wikilink later in the line;
  - a complete `[[note]]` inside an inline code span;
  - the same inside a fenced code block;
  - an aliased `[[a|b]]` in code alongside a real `[[target|alias]]`;
  - a code span containing `]]` before a real wikilink.
- Cover the media-link equivalents, which share the shape of the problem.
- Record near `preProcessWikilinks` that its correctness depends on
  `postProcessWikilinks` being its exact inverse, so the next reader knows why
  these tests exist.

## Out of scope

- Changing `preProcessWikilinks` to skip code spans. Tempting, but it is a
  behaviour change with no user-visible defect to justify it today, and it would
  need its own derivation of where the token boundaries should fall. If a future
  change breaks the symmetry these tests protect, that is the moment to revisit.
- Escaping wikilinks outside code (e.g. a `\[[` escape hatch).
- The fence-language defect found during the same verification (an unlabelled
  fence comes back labelled `text`) — tracked separately as
  `plan/todo/0005-fence-language-added-on-round-trip.md`.

## Exit criteria

1. Each case listed under Scope has a round-trip test asserting the body is
   unchanged.
2. The media-link equivalents are covered too.
3. The tests fail if `postProcessWikilinks` stops being the exact inverse of
   `preProcessWikilinks` (verify by temporarily breaking one of them).
4. No production behaviour changes as part of this item.
5. `yarn verify` green.
