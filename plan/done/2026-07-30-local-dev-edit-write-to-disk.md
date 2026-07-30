# Local dev edit persistence — write to disk, no commit

Owning ADR: `adr/0036-local-dev-edit-write-to-disk.md`.

Scope: make the editor persist under `wv dev`. A dev-only Vite middleware handles
`POST /api/commit` by applying the production Function's pure transforms and
writing the resulting `.md` files directly to the vault on disk — no git commit,
no push, no GitHub token.

Exit criteria (mapped to the ADR's acceptance criteria):

1. `POST /api/commit` handled by a dev-only middleware (`apply: 'serve'`);
   production still uses the Pages Function. (AC 1)
2. Same transforms as `functions/commit.js` by reusing `isSafeNotePath` /
   `applyOps`. (AC 2)
3. Notes written to the vault on disk; no git, no push, no token. (AC 3)
4. Function-shaped success response so the optimistic UI clears the draft. (AC 4)
5. Unsafe paths rejected (`isSafeNotePath`). (AC 5)

Implementation: `scripts/commit-dev.mjs` (the `commitDev()` plugin) wired into
`lib/vite-config.mjs` plugins, mirroring the `sharedPagesDev` pattern.

Shipped 2026-07-30 on `main`. Verify gate green: `wv build` from the reference
vault (marconucaravault) succeeded, and a dev smoke of `/api/commit` exercised
create / edit-body / delete / invalid-path (files written and removed on disk,
frontmatter preserved, traversal rejected 400), plus a manual browser edit.
0036 advanced Proposed → Implemented.
