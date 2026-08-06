---
adr: 0034
title: Client-side settings modal — token status, editor gating, Inbox toggle, language
status: Proposed
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0018, 0033]
tags: [settings, ui, editor, preferences]
---

# ADR 0034 — Client-side settings modal — token status, editor gating, Inbox toggle, language

## Context

web-vault has no client settings surface today. Several needs converge on one:

- The GitHub token that authorizes commits is a **server-side deploy secret**
  (`adr/0018-edit-commit-via-pages-function.md`,
  `adr/0026-cloudflare-pages-access.md`) — the client cannot and must not set it,
  and editing is pointless when it is absent because no commit can succeed.
- The built-in **Inbox** view (`adr/0033-builtin-sidebar-views.md`) is shown
  unconditionally and needs a user opt-out (its always-on rule was accepted as
  provisional precisely pending this).
- A UI **language** selector is wanted, ahead of the future i18n layer that
  `CONVENTIONS.md` anticipates.

A single settings modal is the natural home for these client-side preferences,
persisted locally (like drafts, `adr/0021-draft-state-optimistic-ui.md`).

## Capability statement

A settings modal, opened from the toolbar, holds client-side preferences persisted
in `localStorage`. It **displays** the GitHub token status (configured / not
configured) as read-only information — never a field to enter it — with copy
explaining the token is a deploy-time secret set at the deployment (Cloudflare
Pages env), and a warning banner at the top when it is unset. When the token is not
configured, the markdown editor is **read-only by default**, so a user is not
invited to make edits that can never be committed. The modal also offers a "show
Inbox" toggle (default on, overriding 0033's unconditional display) and a UI
language selector.

## User stories / scenarios

- As a user, I open Settings and see whether commits are enabled, and — if not — a
  clear explanation that the token is a deploy secret I set at the deployment, not
  in the app.
- As a user on an instance with no token, the editor is read-only, so I am not led
  to type changes that cannot be saved.
- As a user, I can hide the Inbox view when my vault does not use `_organized`.
- As a user, I can choose the UI language.

## Acceptance criteria

1. A settings modal is reachable from the app toolbar; its preferences persist
   client-side (`localStorage`) across reloads.
2. The modal shows GitHub token status (configured / not configured) as **read-only**,
   with copy explaining it is a deploy-time secret configured at the deployment —
   there is **no field to enter the token** in the client.
3. When the token is not configured, a warning banner appears at the top of the
   modal and the markdown editor is read-only by default (viewing only; no
   edit/commit affordances).
4. The modal provides a "show Inbox" toggle (default: shown) controlling whether the
   built-in Inbox view (`adr/0033-builtin-sidebar-views.md`) appears in the sidebar.
5. The modal provides a UI language selector, and the choice persists.

## Out of scope

- Setting, entering, or rotating the GitHub token from the client — it is a deploy
  secret and is never accepted in the browser.
- The i18n message-file layer and the translations themselves — the selector is the
  control; translation delivery is a separate layer (`CONVENTIONS.md`).
- Server-side or cross-device synced preferences; preferences are local to the
  browser.
- Settings beyond those listed (per-note/per-view configuration).

## Open questions

- ~~The exact mechanism by which the client learns commit availability without
  exposing the secret — a `build-info` flag vs a Pages Function / health
  response.~~ **Resolved: a runtime capability endpoint.** Settled while
  implementing `adr/0039-*.md`, which needs the same answer to choose which
  action its notice offers. The deployment answers `GET /api/capabilities` with
  `canWrite`, derived server-side from the presence of the token; the token
  itself never leaves the server. Runtime rather than build-injected, because
  the token is a host secret an adopter adds *after* deploying (the welcome note
  instructs exactly that) — a build-time flag would report `false` on a
  deployment that writes perfectly well, until the next rebuild. This ADR's
  editor gating (criterion 3) consumes that endpoint; it does not need to define
  it.

## References

- adr/0018-edit-commit-via-pages-function.md
- adr/0026-cloudflare-pages-access.md
- adr/0033-builtin-sidebar-views.md
- adr/0014-wysiwyg-blocknote-editor.md
- adr/0021-draft-state-optimistic-ui.md
- adr/0039-adopter-upgrade-path.md (defines and consumes the capability endpoint)
- CONVENTIONS.md (Language)

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |
| 2026-08-06 | r2 | marco | Resolved the open question: commit availability is read at runtime from a capability endpoint, not baked into the build. Settled and implemented under `adr/0039-*.md`, which consumes the same signal. No change to this ADR's scope or criteria. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
