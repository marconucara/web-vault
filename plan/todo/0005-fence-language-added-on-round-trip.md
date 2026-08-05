# An unlabelled code fence gains a `text` language on round-trip

**Owning ADR(s):** `adr/0015-durable-markdown-round-trip.md`
**Dependencies:** None

## Problem

A fenced code block written without an info string comes back labelled `text`
after an open-and-save cycle:

| Source | After a round trip |
|---|---|
| ```` ```\nSee [[welcome]] here\n``` ```` | ```` ```text\nSee [[welcome]] here\n``` ```` |

The fence content itself is untouched — this is not content loss — but the
note's source is rewritten in a way the author did not ask for. Opening a note
and saving it without editing anything should be a no-op, which is the promise
ADR 0015 makes; a diff appearing in the vault for a note nobody changed
undermines it.

A fence that *does* declare a language is unaffected (```` ```markdown ````
stays ```` ```markdown ````). The rewrite comes from BlockNote's exporter, which
emits a default info string where the source had none, not from this repo's
pre/post-processing.

Found on 2026-08-05 while re-verifying `plan/todo/0003`; it is the only
difference that survived in an otherwise clean set of wikilink/code round-trip
cases.

## Scope

- Stop an unlabelled fence from acquiring a language on export, in the same
  normalisation stage that already rewrites list bullets and compacts tables
  (`normalizeMarkdown` in `src/lib/richMarkdown.js`).
- Preserve a language the author *did* write, including one that happens to be
  `text` — the fix must distinguish "no info string in the source" from "the
  author wrote `text`", so it cannot be a blanket strip.

## Out of scope

- Any other exporter-introduced formatting difference not observed here.
- Normalising the info string's casing or aliases (`js` vs `javascript`).

## Exit criteria

1. An unlabelled fence round-trips unlabelled.
2. A fence with an explicit language keeps it, `text` included.
3. Idempotence: a second round trip is a no-op.
4. `yarn verify` green.
