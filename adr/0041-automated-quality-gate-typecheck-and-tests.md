---
adr: 41
title: Automated quality gate — typechecking and tests
status: Implemented
date: 2026-07-31
owner: Marco Nucara
supersedes:
superseded-by:
depends-on: []
tags: [quality, tooling, testing, developer-experience]
---

# ADR 41 — Automated quality gate — typechecking and tests

## Context

web-vault is written almost entirely by agents. The human operator drives
the work but does not read every generated line. Today the only guardrail
against a broken change reaching `main` is the **verify gate** defined in
`CONVENTIONS.md`: `wv build` plus a **manual** dev-server smoke of `/` and
`/shared/<id>/`. In other words, the whole quality bar is "it compiles and a
human eyeballs two routes."

Two gaps make that bar weak for an agent-driven codebase:

- **No type checking.** The codebase (~5.4k lines across ~46 `.js`/`.jsx`/
  `.mjs` files) has no `tsconfig`, no `@ts-check`, no JSDoc types. `vite build`
  transpiles but never checks types. Prop mismatches, renamed-but-not-everywhere
  fields, and half-finished refactors — the characteristic failure mode of
  generated edits — surface only at runtime, if at all.
- **No behavioural tests.** There is no test runner (no Vitest/Jest/Playwright)
  and no `test` script. The single test-looking artefact,
  `src/roundtrip-test.jsx`, is by its own header comment a *dev-only* diagnostic
  harness that renders diffs in the browser; it asserts nothing and is not part
  of the build. Meanwhile ~40 ADRs carry numbered acceptance criteria that
  `AGENTS.md` declares "testable" and asks to "map tests back to" — but nothing
  executes them.

So the repo's stated intent (testable acceptance criteria, tests mapped to
them) and its reality (zero automated tests, zero type checks) are in open
contradiction. This ADR closes that gap by establishing an automated quality
gate as a first-class part of the verify contract.

A deliberate constraint: the right *sequence and depth* of the rollout depends
on data we do not yet have — how many type errors `checkJs` surfaces on the
current tree, and how many vault notes actually fail the round-trip. This ADR
therefore makes a **measured spike the first accepted unit of work**, whose
output sets the priority of everything after it, rather than committing up front
to a fixed amount of typing and test coverage.

## Capability statement

web-vault must have an automated quality gate that mechanically verifies both
type correctness and core behavioural correctness, runs as part of the verify
gate before any change reaches `main`, and fails the build on regression — so
that agent-generated changes are caught by tooling rather than relying on a
human smoke of two routes.

## User stories / scenarios

- As the operator, I want a single command to typecheck the whole tree, so that
  a refactor that leaves a dangling field or wrong prop fails before I push.
- As the operator, I want the note round-trip and the pure vault-logic helpers
  covered by real assertions, so that a change to Markdown handling that would
  corrupt notes fails the build instead of a browser diff I have to read.
- As an agent working in this repo, I want `tsc --noEmit` and the test suite in
  the verify gate, so that "done" means the gate is green, not "it builds."
- As the operator, I want the rollout sequenced by measured evidence, so that
  effort goes to the checks that catch the most real defects first.

## Acceptance criteria

1. A **measured spike** runs first and reports two numbers on the current
   `main`: (a) the count of type errors surfaced by `tsc --noEmit` with
   `checkJs`/`allowJs` enabled, and (b) the count of vault notes that fail the
   `richMarkdown` round-trip when `roundtrip-test` logic is run under assertions.
   The spike changes no product behaviour and its findings are recorded in the
   owning `plan/` item.
2. The spike's findings set the **documented priority order** for the rollout
   (which of typechecking vs. behavioural tests leads, and where the first tests
   land); that ordering is written back into this ADR's References or the plan
   item before Accepted work proceeds beyond the spike.
3. A type-checking command exists (`tsc --noEmit`, `checkJs: true`,
   `allowJs: true`, no file renames required) and passes clean on `main` — with
   any errors the spike found either fixed or explicitly suppressed with a
   tracked reason.
4. A test runner is present with a `test` script, and the `richMarkdown`
   round-trip is expressed as real assertions (ported from the existing dev
   harness) plus at least the pure vault-logic helpers identified by the spike
   (candidates: `wikilinks`, `mdLinks`, `views`, frontmatter parsing) have unit
   tests mapped to their ADRs' acceptance criteria.
5. Both the type-check and the test run are wired into the **verify gate** in
   `CONVENTIONS.md` and `AGENTS.md`, and a red result blocks the fast-forward to
   `main`.
6. The gate is **self-contained in this repository**: it runs from a bare clone
   plus an install, with no dependency on a vault outside the repo, so the same
   commands can move to a hosted CI unchanged. `wv build` and the dev-server
   smoke are consequently not gate steps — they require a consumer `.web`
   project, since `wv` resolves the vault as `process.cwd()/..`.

## Out of scope

- Full migration of the codebase to TypeScript (`.ts`/`.tsx` file renames). This
  ADR adopts *type checking* via `checkJs`; a later ADR may decide on a
  per-file conversion informed by the spike, but that is a separate decision.
- End-to-end / browser automation (Playwright and the like). This ADR covers
  typechecking and unit/logic-level tests. Browser-level verification stays a
  manual development aid against a linked consumer vault, outside the gate,
  until an E2E decision is taken.
- Build-level verification inside this repo. Covering `wv build` mechanically
  would need an example vault committed here (a self-installing `.web` under a
  subdirectory); that is a separate decision, not taken.
- Coverage thresholds or a mandate that every ADR acceptance criterion have a
  test. Comprehensive coverage is a later tightening, not this ADR's bar.
- CI service configuration. The verify gate runs locally per the current Git
  contract; wiring the same commands into a hosted CI is a separate concern.

## Open questions

Both questions below were settled during implementation:

- **Test runner: Vitest**, as presumed. It reuses the existing Vite pipeline and
  is a `devDependency`, so it does not affect the adopter-facing package (the
  `files` allowlist ships no tests or config).
- **Scope of the type-check: the whole tree from day one** — `src/`, plus the
  build scripts, `functions/`, and `lib/`. The spike's 67 errors proved
  mechanical enough to clear in one pass, so no staged `src/`-only rollout was
  needed.

Remaining, deferred to later work:

- Whether to commit a **small example vault** into this repo (a self-installing
  `.web` under a subdirectory) so `wv build` becomes mechanically verifiable
  inside the gate. It would close the one hole the gate leaves, but it pulls a
  nested install and build output into the repo; not attempted here.
- The **588 round-trip failures** the full-vault spike reported are not
  addressed by this ADR. `yarn roundtrip:spike` stays a diagnostic outside the
  fast gate; a focused ADR should triage that number against
  `adr/0015-durable-markdown-round-trip.md`.

## References

- adr/0015-durable-markdown-round-trip.md — the round-trip guarantee the tests
  make executable.
- adr/0003-stack-react-vite.md — Vite pipeline that Vitest and `tsc --noEmit`
  attach to.
- CONVENTIONS.md — Git Contract / verify gate this ADR extends.
- AGENTS.md — "Acceptance criteria are testable" / "Map tests back to ADR
  acceptance criteria" intent this ADR operationalises.
- ../plan/todo/0002-automated-quality-gate.md — measured spike findings and
  rollout priority order.

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-31 | r1 | Marco Nucara | Initial draft. |
| 2026-07-31 | r2 | Marco Nucara | Accepted after spike; rollout priority recorded in the owning plan item. |
| 2026-07-31 | r3 | Marco Nucara | Implemented: `yarn typecheck` clean (67 → 0), 14 Vitest tests, gate wired into AGENTS/CONVENTIONS. Open questions resolved (Vitest; whole-tree checking); round-trip triage deferred. |
| 2026-07-31 | r4 | Marco Nucara | Added criterion 6: the gate is self-contained in this repo (CI-portable). `wv build` and the browser smoke are removed from the gate — they need a consumer vault. Example-vault option recorded as an open question. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Owner | Marco Nucara | 2026-07-31 | Accepted for implementation |
| Owner | Marco Nucara | 2026-07-31 | Implementation verified (r3) |
