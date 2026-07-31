# Automated quality gate

Owning ADR: `adr/0041-automated-quality-gate-typecheck-and-tests.md`

## Scope

Establish a fast local quality gate for the agent-driven codebase:

- add `tsc --noEmit` with `allowJs` and `checkJs`;
- add Vitest unit/logic tests for round-trip and pure vault helpers;
- wire typecheck and tests into the documented verify gate;
- keep the gate fast enough for local and future CI use.

## Spike findings

Measured on the current tree before fixes, using `tsc --noEmit --pretty false`
with the new `tsconfig.json`:

- TypeScript check errors: **67**.
- Primary clusters: Vite inline config typing, missing virtual module types,
  CodeMirror import typing, optional React props inferred as required, and
  untyped discriminated UI state.

Measured after generating `.wv/content.json` with `yarn wv build`, using
`yarn roundtrip:spike` against the generated note set:

- Notes checked: **689**.
- Round-trip failures: **588**.
- Round-trip runtime errors: **0**.

## Rollout priority order

1. Lead with typechecking because the initial 67 failures are mechanical, fast
   to run, and catch broad refactor mistakes across the codebase.
2. Add fast unit tests for pure vault-logic helpers first: wikilinks, markdown
   link/map parsing, saved-view filtering/sorting, and note-file naming.
3. Add a small asserted `richMarkdown` round-trip fixture suite to make the
   existing browser harness executable without putting the full-vault spike in
   the fast gate.
4. Keep `roundtrip:spike` as a diagnostic command outside the default verify
   gate; use its large failure count to drive later, focused round-trip work.

## Exit criteria

- `yarn typecheck` passes.
- `yarn test` passes.
- `yarn verify` runs both from a bare clone, with no dependency on any vault
  outside this repo.
- `AGENTS.md` and `CONVENTIONS.md` name typecheck and tests in the verify gate,
  and record that `wv build` is not a gate step.
- The owning ADR can move to `Implemented` when this item is shipped via the
  repository completion event.

## Shipped

HEAD: `d708c5493f14e03d8a06bd2b88a9b5de0bd9dfaf`
(`feat(quality): add typecheck and test gate; implement 0041`)

Delivered: `tsconfig.json` (allowJs + checkJs, whole tree, 67 → 0 errors),
Vitest with 14 tests, `yarn verify`, `scripts/roundtrip-spike.mjs` as an
out-of-gate diagnostic, and `.yarnrc.yml` pinning `nodeLinker: node-modules`.

Deviation from the original scope: `wv build` was dropped from the verify gate.
It resolves the vault as `process.cwd()/..`, so from this repo's root it scans
the parent directory and builds unrelated notes. The gate is now self-contained
and CI-portable (ADR criterion 6); build and browser smoke run against a
`portal:`-linked consumer vault instead.

Follow-ups left open: the 588 round-trip failures reported by the spike, and
whether to commit an example vault so `wv build` becomes gate-verifiable.
