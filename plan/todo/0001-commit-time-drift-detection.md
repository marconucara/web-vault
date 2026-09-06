# Commit-time drift detection and conflict resolution

**Owning ADR(s):** `adr/0050-commit-time-drift-detection-and-conflict-resolution.md`
(Accepted → Implemented on this item's commit).

## Scope

A note edited here and changed elsewhere — a second web client, a desktop Tolaria
session — is silently overwritten on commit. Give every note a base identity,
carry it through the edit, and compare it server-side before anything is written.

**The base.** `scripts/build-content.mjs` emits, per note, the Git blob SHA the
file has in `HEAD` — a single `git ls-tree -r HEAD` read into a path→sha map, one
process rather than `git hash-object` per file. `HEAD` is the right reference and
not an approximation of the working tree: the Function compares against `cur.sha`
from GitHub, i.e. the remote branch, so the base has to name the last version the
two sides shared. A file with uncommitted local changes therefore still gets a
base — the SHA of the version without them, which is what the remote holds, so it
compares equal and no false drift is raised, while a real remote change to that
file still differs and is caught. Only an untracked file has no base at all: it
has never been in the repo, so there is nothing it can have drifted from, and its
collision is caught by the existing path-existence check instead.

**The edit.** `src/lib/pending.js` stores `{ path, id, title, body }` per path;
add the base from `note` in `setEdit`, which already receives the whole note.
Entries written before this change simply lack the field — that is AC 9's
"no base" path, so the `vault-web:pending:v1` key needs no migration and no bump.
`src/lib/drafts.js` (new notes) is untouched: a draft has no path and no base, and
its collision is already caught by the path-existence check.

**The wire.** `src/lib/commit.js` passes `files` through verbatim, so the base
rides along once the callers put it there. Callers to cover: the editor's commit
path, and — deliberately NOT — `typeCommit.js` / `writeAction.js`, per 0050's
out-of-scope.

**The check.** `functions/commit.js` step 3 already fetches each file and has
`cur.sha` in hand (`:283`). Compare it to the base the client sent; on mismatch
collect the path and `rawCurrent`, and after the loop reject the whole batch
before step 4 builds any tree. Two details:

- The response must be distinguishable from the two 409s already there (`:271`
  path collision, `:305` fast-forward). Add a `reason` field rather than relying
  on the status code, and have `commit.js` surface it — it currently throws
  `new Error(data?.error)`, which flattens everything to a string and would lose
  the payload.
- The `:305` fast-forward check stays. It covers the intra-request race this
  preflight cannot see.

**The UI.** Per drifted note, the local text and the remote text in a raw
git-style conflict form, editable, with explicit commit-the-resolution and
abandon actions. Committing the resolution sends it with the base advanced to the
remote SHA that was shown, so the retry does not immediately re-drift. No
automatic merge (0050 out-of-scope). New i18n keys in `src/locales/en.json` and
every other catalogue (`adr/0047-*.md`), English at the point of use; no ADR
identifiers in any string (`CONVENTIONS.md` §ADR Privacy).

## Exit criteria

Mapped to `adr/0050-*.md`:

1. AC 1 — `content.json` carries a per-note base SHA, taken from `HEAD`. Test
   over `build-content.mjs` against a fixture vault: a committed file carries its
   `HEAD` SHA, a file with uncommitted changes carries the same one, an untracked
   file carries none.
2. AC 2 — `setEdit` persists the base; it survives a reload; an entry without one
   loads without error. Unit tests over `pending.js`.
3. AC 3-4 — the Function compares per file and rejects on mismatch before any
   tree or commit object is created. Test that a drifted request creates nothing
   on the GitHub side (no `POST /git/trees`).
4. AC 5 — the rejection names the drifted files, carries their current remote
   content, and is distinguishable by the client from both existing 409s.
5. AC 6 — a batch with one drifted file commits nothing and leaves every draft in
   the batch intact.
6. AC 7 — the client renders both versions per drifted note, editable, with the
   two explicit actions; neither fires on its own.
7. AC 8 — committing a resolution succeeds against the content that was shown and
   advances the note's base.
8. AC 9 — an edit with no base (an untracked note, or a draft predating this
   mechanism) is not refused for drift; new-note creation keeps its
   path-collision rejection.
9. AC 10 — a non-drifted commit is unchanged, with no extra round trip. Existing
   commit tests stay green unmodified.
10. `yarn verify` green; manual test by Marco with two clients on one note;
    `adr/0050-*.md` → Implemented; `INDEX.md` regenerated.

## Dependencies

None blocking. Independent of `adr/0030-background-freshness-detection.md`, which
needs `content.json` extracted from the bundle as a fetchable asset — a build
pipeline change this item does not require and must not drag in. The comparison
and the conflict UI built here are what 0030 will reuse for its own AC 4.

## Notes

Adjacent and deliberately excluded: `applyOps` preserves the remote frontmatter
verbatim while replacing the body wholesale (`functions/commit.js:126`). That
asymmetry is a defect in its own right and wants its own item — this one makes
drift visible, it does not change how a non-drifted write is composed.
