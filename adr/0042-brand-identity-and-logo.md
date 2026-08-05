---
adr: 0042
title: Brand identity and logo
status: Proposed
date: 2026-08-01
owner: Jules
supersedes:
superseded-by:
depends-on: []
tags: [design, brand, logo, assets]
---

# ADR 0042 — Brand identity and logo

## Context

web-vault currently operates with a highly neutral visual interface. While it supports dark and light themes out of the box, it lacks a dedicated brand identity, logo, or a distinctive brand accent color. The application UI uses a generic blue/blue-light accent color primarily for interactive links and selection highlights, but this is a standard default rather than a tailored brand choice.

To establish a cohesive identity, the system requires a custom logo/icon designed for use as both an in-app visual and a web favicon. The design must deliberately avoid any key, lock, or physical vault/safebox metaphors. While the application is named "web-vault", the "vault" terminology strictly refers to a "Markdown vault" — a collection of markdown notes, files, writing, connections, and structured knowledge. Consequently, the brand identity and logo should solely represent concepts like:
- Knowledge structure and note organization.
- Markdown syntax, writing, and curation.
- Nodes, connectivity, and linkages (like wikilinks/graphs).
- Minimalist, clean, and modern aesthetics.

Furthermore, while the logo/icon will introduce a specific brand color, the application UI itself should remain highly neutral in both light and dark modes. An eventual application-wide brand/accent color may be introduced in the future, but must be designed in a flexible, scalable manner to preserve theme contrast.

## Capability statement

web-vault must define and support a custom brand identity system, including a dedicated logo designed strictly around notes, knowledge, and connection concepts, delivered as a scalable SVG asset suitable for icons, favicons, and in-app brand headers, while preserving the application's clean, high-contrast, theme-neutral user interface.

## User stories / scenarios

- As a user, I want the application to have a distinctive brand icon (logo and favicon), so that I can easily identify WebVault among other open browser tabs and recognize it as a specialized knowledge tool.
- As a designer or contributor, I want the brand guidelines to avoid vault/lock metaphors, so that the visual identity aligns with the digital knowledge and Markdown organization nature of the tool.
- As a theme developer, I want any brand color or logo accent to adapt gracefully to both light and dark modes, so that contrast and readability are never compromised.

## Acceptance criteria

1. An ADR is authored and proposed outlining the branding strategy, visual requirements, and design constraints.
2. The visual guidelines forbid the use of physical lock, key, safe, or security box imagery.
3. The visual guidelines require the logo to be designed around knowledge, notes, writing, or connectivity (e.g., node graphs, pages, cursors, wikilink delimiters).
4. The logo must be defined as a clean, scalable SVG asset capable of acting as a favicon, sidebar brand icon, or general application symbol.
5. The visual guidelines define the criteria for a brand/accent color (such as contrast compliance on dark/light backgrounds) without immediately imposing a heavy colored theme on the currently neutral UI.
6. The ADR lists concrete aesthetic proposals for review (e.g., page/document node combinations, connected graph nodes, markdown/brackets symbolisms) to be evaluated and selected in the implementation phase.

## Out of scope

- Complete overhaul of the neutral dark/light theme stylesheet. The core UI continues to use its highly legible, neutral grey/border layout, and only incorporates the brand color/icon where appropriate (like the brand header or favicon).
- Production of automated raster image assets beyond the SVG component definitions and favicon guidance.
- Redesigning the entire markdown/editor rendering system.

## Open questions

- Which of the aesthetic proposals (Connected Nodes, Floating Page, Brackets/Cursor) will be selected as the final visual identity?
- Whether to export the SVG asset into a standard `.ico`/`.png` collection at build time or simply deliver the raw inline SVGs for react/framework usage.

### Why this ADR is not ready to implement

This ADR was queued for implementation once and the item was withdrawn. Several
attempts, across different models and providers, all produced unacceptable
results. The cause is in this document, not in the executors: **the decision is
not made here.** The first open question above leaves the visual identity to
whoever implements it, so each attempt invented a different direction and none
of them was the owner's.

Two further properties make it unsuitable for delegation as written:

- It bundles one act of product judgement (choosing an identity) with three
  mechanical tasks (drawing the SVG, placing it in the sidebar, emitting the
  favicon). The mechanical parts are routine, but bundled together they inherit
  the open-endedness of the creative one.
- Its acceptance criteria are not machine-verifiable. "The guidelines are
  respected" and "the UI remains neutral" cannot be checked by an executor,
  which has no way to know whether the result is the one the owner wanted.

Before this ADR moves to `Accepted`, the owner resolves the first open question
**in this document** — one identity, described precisely enough to be
unambiguous (metaphor, forbidden imagery, colour, visual weight). Only then does
the work split into small items with criteria an executor can satisfy without
guessing at taste.

## References

- adr/0009-three-panel-ui-note-list.md — the sidebar branding location where the logo is to be integrated.
- src/styles.css — the stylesheet declaring neutral light/dark colors.
- src/components/Sidebar.jsx — where the brand text currently resides.

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-08-01 | r1 | Jules | Initial draft. |
| 2026-08-05 | r2 | marco | Recorded why the ADR is not ready to implement: the visual identity is still an open question, so the queued item was withdrawn after repeated failed attempts. Names what must be settled here before the ADR can move to Accepted. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
