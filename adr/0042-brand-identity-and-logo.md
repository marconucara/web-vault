---
adr: 0042
title: Brand identity and logo
status: Implemented
date: 2026-08-01
owner: marco
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

### The direction, and how it is recorded

r1 of this ADR listed three candidate directions and left the choice open. That
open question is now closed: the direction is a **geometric, monoline mark in
which a connecting path is framed by angular delimiters**, in a single blue
accent against otherwise neutral values. It reads simultaneously as the wikilink
delimiters the product is built around and as a link traced between two points —
the two concepts r1 could not choose between, resolved into one sign.

A visual reference for this direction is committed at
`adr/assets/0042-brand-direction.png`. It is a **mood and constraint reference,
not a specification**: it shows the mark, a wordmark, the palette, the icon at
several sizes, and two editor mockups demonstrating how little colour the UI
carries. The geometry in it is inconsistent between instances by nature, and is
not what is being decided here.

**This ADR deliberately does not specify the drawing.** Node count, node shapes,
the path the connector takes, stroke ratios and proportions are design work, not
decisions: writing them here would produce a document that is stale the moment
the artwork is refined and that cannot be adjusted without a formal revision.
What is fixed below is the mood, the palette, the prohibitions, and the
operational constraints the artwork must satisfy. **Once produced, the SVG asset
itself is the authoritative source for the form**; this ADR governs the space it
is drawn in.

The shape vocabulary named below is illustrative — a set of examples that
orients the drawing, not an inventory to be reproduced or exhausted.

## Capability statement

WebVault has a defined brand identity: a single geometric mark built from a
connecting path and angular framing delimiters, one blue accent against a
neutral palette, delivered as a scalable SVG that serves as favicon, in-app
brand mark, and application icon. The mark is **one drawing used at every
size** — no simplified variant for small renderings. The identity deliberately
carries no lock, key, or safe imagery: the "vault" in the name is a Markdown
vault, a body of notes. The application interface remains neutral in both
themes; the brand colour appears in the mark and in the accents the UI already
uses, and does not spread into a themed interface.

## User stories / scenarios

- As a user, I recognise WebVault by its icon among open browser tabs, at
  favicon size, without squinting.
- As a user, I see an interface that stays calm and neutral — the brand is
  present in the mark, not painted across the app.
- As a designer or contributor, I can tell from this ADR what the identity is
  about and what it must never look like, and find the exact form in the SVG
  rather than in prose.
- As a theme developer, the mark and its accent hold contrast on both light and
  dark backgrounds without a per-theme redraw.

## Acceptance criteria

1. A single SVG mark exists, used unchanged at every size — favicon, sidebar
   brand mark, and application icon — with no separate simplified variant.
2. The mark is legible at 16 px: its silhouette stays distinguishable and does
   not read as a smudge.
3. The mark renders correctly on both light and dark backgrounds from one asset,
   with no per-theme redraw. Where a value must invert between themes, it does
   so via `currentColor` or a CSS custom property, not a second file.
4. The brand accent is `#3B82F6`, and it is the only saturated colour in the
   identity. All other values are neutral (the reference palette is `#EFF6FF`,
   `#E5E7EB`, `#737373`, `#171717`).
5. The mark carries no lock, key, safe, padlock, or security-box imagery, and no
   skeuomorphic depth — no gradients, drop shadows, or bevels.
6. The mark is monoline and geometric: uniform stroke weight, hard corners, flat
   fills.
7. The application UI is unchanged in its neutrality by this work: no new
   coloured surfaces, and the existing accent usage (links, selection, active
   sidebar row) is not broadened.
8. The favicon is emitted from the same source as the in-app mark, so the two
   cannot drift.
9. The wordmark reads **WebVault**, matching the product name established in
   `adr/0029-cli-setup-and-distribution.md`. `web-vault` remains the repository,
   package, and CLI identifier and is not used as the product name.

## Out of scope

- Complete overhaul of the neutral dark/light theme stylesheet. The core UI continues to use its highly legible, neutral grey/border layout, and only incorporates the brand color/icon where appropriate (like the brand header or favicon).
- Production of automated raster image assets beyond the SVG component definitions and favicon guidance.
- Redesigning the entire markdown/editor rendering system.

## Open questions

- ~~Whether to export the SVG into a standard `.ico`/`.png` collection at build
  time, or deliver the raw inline SVG for react/framework usage and rely on
  modern browsers' SVG favicon support.~~ **Settled (r4):** both, and neither is
  generated at build time. The raster set is produced once from the SVG geometry
  by the design tooling and committed under `brand/`; the build only copies it.
  Rasterising during `wv build` was rejected because it would put an image
  dependency into a gate that must run from a bare clone, and "Out of scope"
  already excludes automated raster production. Modern browsers still take the
  SVG — `favicon.svg` is listed after `favicon.ico` in the head so that the ICO
  serves only the browsers that cannot read the SVG.

  One consequence is worth recording, because it looks like avoidable
  duplication and is not. The site root is behind Cloudflare Access while
  `/shared/*` is on a Bypass (see `DEPLOY.md`), so a public share page linking
  the root icon has that request answered by the Access login rather than by the
  file. The share pages therefore reference a **second copy of `favicon.svg`,
  placed once at `/shared/favicon.svg`** — one file for every share page, not
  one per share, and mirrored from whichever copy won at the root so that an
  adopter override reaches the public pages too. The `404` can use neither copy:
  it is served for unmatched paths at any depth, so no relative href resolves in
  every case, and it inlines the mark as a `data:` URI instead — the same reason
  it already inlines its CSS and JS. All three surfaces read
  `brand/favicon.svg` at build time, so criterion 8 holds: they cannot drift.
- Whether the wordmark needs a specified typeface, or the mark alone carries the
  identity and the wordmark is set in the UI's existing font.
- Whether the brand accent eventually replaces the UI's current generic blue,
  which would unify them at the cost of touching every accent surface. Not
  proposed here; criterion 7 explicitly holds the UI as it is.

### Note for whoever implements this

r1 of this ADR left the visual direction unchosen, and the queued item was
attempted repeatedly across several models and providers with unacceptable
results every time — each attempt invented its own direction because none was
recorded. r2 closes that: the direction is fixed above and referenced by
`adr/assets/0042-brand-direction.png`.

What remains genuinely open is the **drawing**, and that is intentional. Work
from the reference image and the constraints above; do not treat the reference's
geometry as a spec to reproduce pixel-for-pixel, and do not expect this document
to tell you how many nodes to draw. Expect the artwork to need review by the
owner — several criteria here (legibility at 16 px, whether the silhouette
reads) are judgements a human makes by looking, not assertions a test can make.

Split the work so that judgement is isolated: produce and settle the SVG first,
then the mechanical placements (sidebar mark, favicon emission) against a
finished asset.

Before this ADR moves to `Accepted`, the owner resolves the first open question
**in this document** — one identity, described precisely enough to be
unambiguous (metaphor, forbidden imagery, colour, visual weight). Only then does
the work split into small items with criteria an executor can satisfy without
guessing at taste.

## References

- adr/assets/0042-brand-direction.png — the visual reference for the chosen
  direction: mark, wordmark, palette, icon sizes, and editor mockups showing the
  UI's colour restraint. A mood and constraint reference, not a specification.
- brand/ — the produced identity: `mark.svg` (the authoritative form),
  `favicon.svg` and the raster set, with `brand/ASSETS.md` describing each
  file's role and colour behaviour.
- adr/assets/0042-brand-components.jsx — the design-tool React source the
  geometry was settled in. A reference: it is not imported by the app and is
  outside the typecheck and test scope.
- adr/0009-three-panel-ui-note-list.md — the sidebar branding location where the logo is to be integrated.
- adr/0029-cli-setup-and-distribution.md — where the product name WebVault was established.
- src/styles.css — the stylesheet declaring neutral light/dark colors.
- src/components/Sidebar.jsx — where the brand text currently resides.

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-08-01 | r1 | Jules | Initial draft. |
| 2026-08-05 | r2 | marco | Recorded why the ADR is not ready to implement: the visual identity is still an open question, so the queued item was withdrawn after repeated failed attempts. Names what must be settled here before the ADR can move to Accepted. |
| 2026-08-05 | r4 | marco | Closed the raster question: the icon set is committed pre-rendered from the SVG geometry under `brand/`, copied into the deploy at build time rather than generated. Recorded how each surface reaches the mark under Cloudflare Access — root file, one shared copy at `/shared/favicon.svg`, inline `data:` URI for the 404 — all read from the same source. Status advanced to Implemented: the mark now ships as favicon, platform icons and the sidebar brand. |
| 2026-08-05 | r3 | marco | Closed the direction question. Fixed the identity as a monoline geometric mark — a connecting path framed by angular delimiters — with `#3B82F6` as the sole accent, one drawing at every size, and a committed visual reference at `adr/assets/`. Replaced the aspirational criteria with operational ones, and deliberately excluded the drawing itself (node count, shapes, path, proportions) so the SVG stays authoritative for form. Settled the wordmark as WebVault. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-08-05 | — |
