---
adr: 0004
title: Purpose and compatibility target — private viewing, public sharing, any Markdown vault
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002]
tags: [product, compatibility, positioning, philosophy]
---

# ADR 0004 — Purpose and compatibility target — private viewing, public sharing, any Markdown vault

## Context

This repository exists for **two core needs**, and everything else is secondary
to them:

1. **Private viewing of the vault from any device** — read the notes anywhere,
   privately, without standing up a server or exposing the vault.
2. **Public sharing of selected notes** — publish individual notes as public
   links without making the whole vault public.

The primary way the vault itself is **edited is via coding agents**
(agent-driven editing of the Markdown files), not through a UI. The in-browser
editor added later is a **small convenience**, explicitly not the heart or the
reason for the project; it must never compromise the two core features above.

The project is strongly inspired by
[Tolaria](https://github.com/refactoringhq/tolaria) (an AGPL vault app) — its
conventions shaped what the client understands — but it targets **any** Markdown
vault, so it leans on portable Markdown conventions rather than a Tolaria
runtime. Because Tolaria vaults are Obsidian-style Markdown vaults (frontmatter
+ wikilinks), supporting Tolaria's conventions makes Obsidian vaults compatible
by construction.

web-vault **sits alongside** existing vault tools rather than taking them over:
it reads the vault from its git repository without locking it, so a user can
keep editing with Obsidian or Tolaria and use web-vault's viewer and share
alongside, use web-vault's editor too, or rely on web-vault entirely — complement
or replace, the user's choice.

"Tolaria" is a third-party name and is not appropriated: the product is named
**web-vault**, and its docs state plainly that it is strongly inspired by and
compatible with Tolaria vaults.

## Capability statement

web-vault provides two core capabilities over a generic Markdown vault: **private
cross-device viewing** and **public sharing of selected notes**. It reads a vault
following portable conventions (first `# H1` as title, `type:` frontmatter,
`[[wikilinks]]`, and Tolaria `views/*.yml` saved views), with no hard dependency
on a Tolaria runtime; Obsidian-style and Tolaria vaults are both supported. It
complements existing vault tools — reading the vault's git repository without
locking it — so it can be used together with, or in place of, Obsidian/Tolaria.
An in-browser editor exists as a convenience; the primary editing path for the
vault is via coding agents.

## User stories / scenarios

- As a vault owner, I view my private vault from any device without exposing it
  publicly.
- As a vault owner, I publish selected notes as public links without making the
  whole vault public.
- As an Obsidian or Tolaria user, I keep my existing app and use web-vault's
  viewer and sharing alongside it — or replace it entirely.
- As a vault owner, I edit the vault primarily through my coding agent; the web
  editor is an occasional convenience, not the main path.

## Acceptance criteria

1. Notes are read as generic Markdown (first H1 as title, `type:` from
   frontmatter, `[[wikilinks]]` resolved — see
   `adr/0008-wikilink-resolution.md`); Obsidian-style vaults (frontmatter +
   wikilinks) are supported, Tolaria vaults being a subset.
2. Saved views use the Tolaria `views/*.yml` format
   (`adr/0007-tolaria-views-evaluator.md`); no Tolaria runtime is required.
3. web-vault reads the vault from its git repository without locking it, so an
   existing tool (Obsidian/Tolaria) can be used concurrently on the same vault.
4. The two core features — private cross-device viewing and public sharing — work
   without the editor; the in-browser editor is layered on as a convenience and
   is not required for the core.
5. Nothing in the package name or public identifiers uses the "Tolaria" name;
   the README states the inspiration, the compatibility, and the
   complement-or-replace relationship with existing tools.

## Out of scope

- The in-browser editor's rich-syntax fidelity
  (`adr/0015-durable-markdown-round-trip.md`).
- Obsidian `.base` companion views, which are ignored
  (`adr/0007-tolaria-views-evaluator.md`).

## Open questions

- The minimum convention set for arbitrary vaults that follow neither Tolaria
  nor mainstream Obsidian conventions (unusual frontmatter shapes or link
  flavours).

## References

- adr/0007-tolaria-views-evaluator.md
- adr/0008-wikilink-resolution.md
- adr/0025-public-share-pages.md
- https://github.com/refactoringhq/tolaria

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact; captures purpose (private viewing + public sharing as the two core features), the agent-driven editing philosophy, compatibility target, the complement-or-replace positioning, and the naming constraint (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
