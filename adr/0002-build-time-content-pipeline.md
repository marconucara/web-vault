---
adr: 0002
title: Build-time content pipeline, no backend for reading
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: []
tags: [architecture, build, content]
---

# ADR 0002 — Build-time content pipeline, no backend for reading

## Context

The product must let a user browse a Markdown knowledge vault from a browser,
mobile included, with the vault kept private. The two shapes were: a runtime
backend that reads the vault per request, or a static build that reads the
vault once and ships a self-contained artifact. A runtime backend adds a server
to run, secure, and pay for, and puts vault I/O on the request path. The vault
is a git repository that changes by commit, so a build triggered per commit is
a natural refresh boundary and needs no live server for reading.

## Capability statement

At build time the system reads the entire vault — every `.md` note
(frontmatter, body, first-H1 title, per-file git dates, size) and the
`views/*.yml` saved views — and packs it into a single content artifact
(`content.json`) that the client loads. All reading, searching, filtering, and
navigation happen client-side against that artifact; no backend is contacted to
view the vault. Editing is a separate, explicitly server-assisted path (see
`adr/0018-edit-commit-via-pages-function.md`).

## User stories / scenarios

- As a reader, I open the site and browse notes and views instantly, with no
  server round-trips per note.
- As an operator, I run no database or app server to serve reads; a static host
  is enough.
- As a maintainer, a commit to the vault triggers a rebuild that regenerates the
  content artifact, so the site reflects the vault.

## Acceptance criteria

1. `wv build` (via `scripts/build-content.mjs`) produces a content artifact
   containing, per note: id/path, title (first H1 or filename), frontmatter,
   body, a search snippet, word count, byte size, git-derived created/modified
   dates, and the last commit that touched it.
2. The artifact also contains the parsed `views/*.yml` and a title/id index used
   to resolve wikilinks.
3. The client renders the vault entirely from the artifact, with no runtime
   request to read note content.
4. Hidden dot-directories, `node_modules`, `attachments/`, `views/`, and agent
   docs (`AGENTS.md`/`CLAUDE.md`/`GEMINI.md`) are excluded from the notes walk.

## Out of scope

- Editing and committing notes (`adr/0018-edit-commit-via-pages-function.md`).
- Google Maps link resolution, which is a separate build-time step
  (`adr/0028-google-maps-places.md`).
- In-app hot-refresh of content after an edit (not implemented; content
  reappears on the next build).

## Open questions

- None.

## References

- scripts/build-content.mjs
- adr/0007-tolaria-views-evaluator.md
- adr/0008-wikilink-resolution.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
