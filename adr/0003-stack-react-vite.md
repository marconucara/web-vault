---
adr: 0003
title: Application stack — React and Vite
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002]
tags: [architecture, stack, build]
---

# ADR 0003 — Application stack — React and Vite

## Context

The client is a single-page app built from the content artifact of
`adr/0002-build-time-content-pipeline.md`, and must be mobile-friendly and fast
to iterate on. It needs a component model rich enough for a three-panel UI, a
block editor, and a map view, and a bundler that produces a static output for a
CDN host. React is the ecosystem the richer building blocks target (the chosen
block editor and its ProseMirror stack, the map library bindings), and Vite
gives a fast dev server and a static production build with content-hashed
assets. Heavier meta-frameworks (Next.js and similar) were unnecessary: there
is no server runtime for reads (ADR 0002), so their server features would be
dead weight.

## Capability statement

The application is built as a React single-page app bundled by Vite. The
production build is a static, content-hashed asset set suitable for any static
host; the dev server offers fast HMR. React is the single component runtime
across the whole app (read view, editor, map view), and Vite's build is the
pipeline the framework's `wv` CLI drives.

## User stories / scenarios

- As a developer, I get fast HMR in dev and a reproducible static build for
  production.
- As an operator, I deploy a folder of static assets; no application server.
- As a maintainer, the same component runtime powers the read view, the editor,
  and the map view, so shared UI is not duplicated across stacks.

## Acceptance criteria

1. The app is authored in React and bundled by Vite.
2. `wv build` produces a static `dist/` with content-hashed assets and a
   relative `base` so it works under any host path.
3. A single copy of React and react-dom is enforced (dedupe) so the editor's
   React-context-based libraries work.

## Out of scope

- The static share-page rendering, which deliberately does NOT ship the React
  app bundle (`adr/0025-public-share-pages.md`).
- The choice of block editor library (`adr/0014-wysiwyg-blocknote-editor.md`).

## Open questions

- None.

## References

- vite / lib/vite-config.mjs (config factory, see adr/0005-framework-package)
- adr/0002-build-time-content-pipeline.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
