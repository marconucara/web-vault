# ADR Index

Regenerated from each ADR's metadata block. Sorted by ADR number. Do not
hand-edit rows out of sync with the ADR files.

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](adr/0001-record-architecture-decisions.md) | Record architecture decisions as ADRs | Implemented | 2026-07-29 |
| [0002](adr/0002-build-time-content-pipeline.md) | Build-time content pipeline, no backend for reading | Implemented | 2026-07-29 |
| [0003](adr/0003-stack-react-vite.md) | Application stack — React and Vite | Implemented | 2026-07-29 |
| [0004](adr/0004-vault-compatibility-target.md) | Purpose and compatibility target — private viewing, public sharing, any Markdown vault | Implemented | 2026-07-29 |
| [0005](adr/0005-framework-package.md) | Framework package with a thin config-only consumer and generated deploy functions | Implemented | 2026-07-29 |
| [0006](adr/0006-hash-based-routing.md) | Hash-based routing, no server SPA fallback | Implemented | 2026-07-29 |
| [0007](adr/0007-tolaria-views-evaluator.md) | Tolaria views/*.yml evaluator, Obsidian .base ignored | Implemented | 2026-07-29 |
| [0008](adr/0008-wikilink-resolution.md) | Wikilink resolution by title and filename | Implemented | 2026-07-29 |
| [0009](adr/0009-three-panel-ui-note-list.md) | Three-panel responsive UI with a Tolaria-style note list | Implemented | 2026-07-29 |
| [0010](adr/0010-git-derived-dates.md) | Reliable created/modified dates derived from git | Implemented | 2026-07-29 |
| [0011](adr/0011-read-only-properties-panel.md) | Read-only Properties panel | Implemented | 2026-07-29 |
| [0012](adr/0012-build-version-chip.md) | Build/version chip in the toolbar | Implemented | 2026-07-29 |
| [0013](adr/0013-copy-vault-attachments.md) | Copy vault attachments into the build output | Implemented | 2026-07-29 |
| [0014](adr/0014-wysiwyg-blocknote-editor.md) | Inline WYSIWYG editor on BlockNote, CodeMirror raw fallback | Implemented | 2026-07-29 |
| [0015](adr/0015-durable-markdown-round-trip.md) | Durable-markdown round-trip layer for the block editor | Implemented | 2026-07-29 |
| [0016](adr/0016-wikilink-and-media-blocks.md) | Wikilinks and media as interactive blocks/chips in the editor | Implemented | 2026-07-29 |
| [0017](adr/0017-deployment-model.md) | Deployment model — deployment-agnostic core, Cloudflare Pages as the first target | Implemented | 2026-07-29 |
| [0018](adr/0018-edit-commit-via-pages-function.md) | Edit-to-commit via a Cloudflare Pages Function, token as a server secret | Implemented | 2026-07-29 |
| [0019](adr/0019-atomic-commit-git-data-api.md) | Atomic multi-file commit via the GitHub Git Data API | Implemented | 2026-07-29 |
| [0020](adr/0020-commit-target-deployment-branch.md) | Commit to the deployment's own branch by default | Implemented | 2026-07-29 |
| [0021](adr/0021-draft-state-optimistic-ui.md) | Draft state in localStorage with optimistic commit UI | Implemented | 2026-07-29 |
| [0022](adr/0022-frontmatter-preserved-line-ops.md) | Preserve frontmatter with line-level operations, no YAML re-serialization | Implemented | 2026-07-29 |
| [0023](adr/0023-note-create-delete.md) | Create and delete notes from the client | Implemented | 2026-07-29 |
| [0024](adr/0024-share-unshare-from-app.md) | Share and unshare a note from the app | Implemented | 2026-07-29 |
| [0025](adr/0025-public-share-pages.md) | Isolated public share pages | Implemented | 2026-07-29 |
| [0026](adr/0026-cloudflare-pages-access.md) | Cloudflare Pages deployment — configurable access, versioned config, runbook setup | Superseded | 2026-07-29 |
| [0027](adr/0027-real-404-and-share-marker.md) | Real 404 page and a share-page marker | Implemented | 2026-07-29 |
| [0028](adr/0028-google-maps-places.md) | Google Maps places — keyless build-time resolution, place cards, and map view | Implemented | 2026-07-29 |
| [0029](adr/0029-cli-setup-and-distribution.md) | Delivery — wv CLI, agent-driven setup, and git-repo distribution | Implemented | 2026-07-29 |
| [0030](adr/0030-background-freshness-detection.md) | Background freshness detection and soft content re-fetch | Proposed | 2026-07-30 |
| [0031](adr/0031-edit-time-drift-policy.md) | Edit-time drift policy — warn on a stale base, no auto-merge | Proposed | 2026-07-30 |
| [0032](adr/0032-dual-format-views-base-yml.md) | Dual-format saved views — Obsidian .base and Tolaria .yml with dedup | Proposed | 2026-07-30 |
| [0033](adr/0033-builtin-sidebar-views.md) | Built-in vault-independent sidebar views — All notes, Inbox, Shared | Implemented | 2026-07-30 |
| [0034](adr/0034-client-settings-modal.md) | Client-side settings modal — token status, editor gating, Inbox toggle, language | Proposed | 2026-07-30 |
| [0035](adr/0035-cloudflare-template-onboarding.md) | Second delivery path — Cloudflare starter template for near-one-click onboarding | Implemented | 2026-07-30 |
| [0036](adr/0036-local-dev-edit-write-to-disk.md) | Local dev edit persistence — write to disk, no commit | Implemented | 2026-07-30 |
| [0037](adr/0037-versioning-and-release-policy.md) | Versioning policy — semver over git tags, framework version in the build | Implemented | 2026-07-30 |
| [0038](adr/0038-in-app-upgrade-notice.md) | In-app upgrade notice — fetch published tags, compare, notify | Implemented | 2026-07-30 |
| [0039](adr/0039-adopter-upgrade-path.md) | Adopter upgrade path — one-click pin bump from the upgrade notice | Implemented | 2026-07-30 |
| [0040](adr/0040-cloudflare-workers-deploy-substrate.md) | Cloudflare Workers as the deploy substrate, superseding Pages | Implemented | 2026-07-31 |
| [0041](adr/0041-automated-quality-gate-typecheck-and-tests.md) | Automated quality gate — typechecking and tests | Implemented | 2026-07-31 |
| [0042](adr/0042-brand-identity-and-logo.md) | Brand identity and logo | Implemented | 2026-08-01 |
| [0043](adr/0043-map-link-resolution-diagnostics.md) | Map link resolution diagnostics — unresolved links surfaced to the client and an opt-in strict gate | Proposed | 2026-08-02 |
| [0044](adr/0044-what-the-url-addresses.md) | What the URL addresses — note, heading anchor, and what stays out | Proposed | 2026-08-05 |
| [0045](adr/0045-manage-types-from-the-ui.md) | Manage note types from the UI — create, edit, and guarded delete | Proposed | 2026-08-06 |
