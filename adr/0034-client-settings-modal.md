---
adr: 0034
title: Client preferences modal — language, formatting, Inbox, and a commit-disabled notice
status: Implemented
date: 2026-07-30
owner: marco
supersedes:
superseded-by:
depends-on: [0018, 0033, 0047]
tags: [settings, ui, editor, preferences, i18n]
---

# ADR 0034 — Client preferences modal — language, formatting, Inbox, and a commit-disabled notice

## Context

web-vault has no client preferences surface today. Several needs converge on one:

- The built-in **Inbox** view (`adr/0033-builtin-sidebar-views.md`) is shown
  unconditionally and needs a user opt-out (its always-on rule was accepted as
  provisional precisely pending this).
- The UI language layer (`adr/0047-ui-language-i18n-layer.md`) shipped without a
  control: it resolves the language from the browser and **persists nothing** by
  design, leaving both the storage and the selector to this ADR. It also
  established that the interface language and the **formatting locale** are two
  separate decisions — the first picks a message catalogue and ignores the
  region, the second drives `Intl` and is nothing *but* the region — so a single
  selector cannot serve both.
- The GitHub token that authorizes commits is a **server-side deploy secret**
  (`adr/0018-edit-commit-via-pages-function.md`,
  `adr/0026-cloudflare-pages-access.md`) — the client cannot and must not set it,
  and editing is pointless when it is absent because no commit can succeed. A
  user whose deployment cannot write will look for the reason in preferences,
  because that is where an application's configuration normally lives.

One modal is the natural home for these client-side preferences, persisted
locally (like drafts, `adr/0021-draft-state-optimistic-ui.md`).

The token notice is deliberately *not* a preference. It is information about the
deployment, placed here because this is where a user goes looking for it, and it
is shown only when there is something to say. Keeping that distinction explicit
is what stops the modal from drifting into a place where deployment
configuration appears editable from the browser.

## Capability statement

A preferences modal, opened from the status bar, holds the client-side
preferences of this browser, persisted in `localStorage`: the **interface
language**, the **date and time format**, and whether the built-in **Inbox**
view is shown. Preferences apply immediately, without a reload, and each has an
**Auto** state that is stored as the *absence* of a preference, so a user who
never chooses keeps following their browser.

The modal is also where a deployment that **cannot commit** explains itself:
when the capability endpoint reports no write access, a notice states that the
deployment is missing its GitHub secret and that the secret is added at the
deployment, not in the app. There is never a field to enter it. In that state
every action that would commit is disabled throughout the app and says so in a
tooltip, so a user is not invited to make changes that can never be saved. Those
actions keep their place whatever the answer, so the answer arriving never
shifts the interface under the reader. The note body itself is never withheld
while the answer is outstanding: it renders read-only and relaxes into writing
once write access is confirmed.

## User stories / scenarios

- As a user, I can choose the language of the interface, or leave it following
  my browser.
- As a user on an `en-GB` browser reading an English interface, I can keep
  `11 Aug 2026` rather than being given the American order — and I can change
  the format without changing the language.
- As a user, I can hide the Inbox view when my vault does not use `_organized`.
- As a user on an instance whose deployment has no token, no action that would
  fail is offered to me — edit, new note and share are all visibly unavailable
  rather than missing — and hovering one tells me editing is off, so I know the
  instance is read-only rather than wondering where its controls went. When I go
  looking for the reason I find it in preferences: the deployment is missing a
  secret, and I am told where it goes.
- As a maintainer, adding a translated catalogue makes its language appear in
  the selector without touching the modal.

## Acceptance criteria

1. A preferences modal is reachable from the status bar, at its right edge after
   the sync indicator; its preferences persist in `localStorage` across reloads
   and are applied without a reload.
2. The modal offers an **interface language** selector whose entries are
   `Auto` plus one per shipped catalogue, derived from `SUPPORTED_LOCALES` — a
   catalogue added later appears with no change to the modal. Each language is
   labelled with its own endonym, capitalised (`English`, `Italiano`), from
   `Intl.DisplayNames`; a language `Intl` cannot name falls back to its code.
3. The modal offers a **date and time format** selector whose entries are `Auto`
   plus a curated list of BCP-47 tags. Each entry is labelled with the region
   name in the current interface language followed by a fixed sample date and
   time formatted by that tag — `United Kingdom — 11 Aug 2026, 14:30` — with no
   hand-written copy per entry. A tag whose region `Intl` cannot name falls back
   to showing the tag.
4. The two selectors are independent: changing the language never changes the
   stored format preference, and vice versa. Changing the language does
   relabel the format entries, since the region names are translated.
5. `Auto` is stored as the absence of a preference, not as a value: with `Auto`
   selected, resolution falls to the browser exactly as it does today
   (`adr/0047-ui-language-i18n-layer.md`), so a user who changes their browser
   or system language keeps following it, and a browser tag outside the curated
   format list remains reachable by returning to `Auto`.
6. The modal owns the persistence of both preferences and passes them to the
   translation layer; that layer continues to read and write no storage of its
   own.
7. The modal provides a "show Inbox" toggle (default: shown) controlling whether
   the built-in Inbox view (`adr/0033-builtin-sidebar-views.md`) appears in the
   sidebar and is counted. Hiding it while it is the selected view leaves that
   list open and working; only the row goes, matching what
   `adr/0046-type-visibility.md` does for a hidden type. Navigating away is what
   makes it unreachable, which is the point of having hidden it.
8. When the deployment reports no write access, the modal shows a notice
   explaining that the deployment is missing its GitHub secret and that it is
   configured at the deployment. There is **no field to enter the token** in the
   client, in any state.
9. When the deployment does report write access, the modal says nothing about
   the token: the notice is conditional, not a status line.
10. The note body is never held back waiting for the deployment's answer: the
    editor mounts as soon as its own loading completes, read-only until write
    access is confirmed. Read-only is the state it is *born* in, so an
    unanswered endpoint can only ever relax into writing, never revoke it. This
    must not change the rendered height of the body, so that following a link to
    a heading is unaffected (`adr/0044-what-the-url-addresses.md`).
11. Every action that would commit — new note, new type, edit type, share,
    delete — is **present at all times and inert until** the deployment has
    confirmed write access: inert while the answer is outstanding, inert when
    the answer is no. Presence is unconditional so that the answer arriving
    never changes the layout: a control that appears late reflows everything
    below it, which is what criterion 10 already forbids for the body and which
    applies no less to the controls around it. They become live on confirmation
    through a short transition on the control itself, so relaxing into writing
    reads as the interface settling rather than as something popping in.
12. Actions held inert under criterion 11 are **disabled, not absent**, and each
    carries a tooltip naming the state in one line. A disabled control does
    raise a question, and the tooltip is where the app answers it; the full
    explanation is not repeated beside each one, but stays in this modal, which
    is the one place that holds it. Inert means `aria-disabled` with the action
    not firing — not the `disabled` attribute, which suppresses the hover and
    focus events the tooltip needs, leaving the control mute at exactly the
    moment it is asked to explain itself. There is no preference that overrides
    criteria 10-12.

## Out of scope

- Setting, entering, or rotating the GitHub token from the client — it is a
  deploy secret and is never accepted in the browser.
- Any override of the read-only state: criteria 10-12 are unconditional.
- Commit actions that appear and disappear with the answer. They hold their
  place and change state in it (criteria 11-12).
- Repeating the full token explanation in each tooltip. The tooltip names the
  state; the reason lives in this modal.
- A free-text BCP-47 field for the format: the selector offers the curated list
  plus `Auto`.
- Deriving the format list from the shipped catalogues, or from the regions of
  the current language. The curated list is a starting point; extending it is a
  one-line change and not a decision to revisit this ADR for.
- Server-side or cross-device synced preferences; preferences are local to the
  browser.
- Preferences beyond those listed (per-note or per-view configuration).

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
  write gating (criteria 10-12) consumes that endpoint; it does not need to
  define it.

## References

- adr/0018-edit-commit-via-pages-function.md
- adr/0026-cloudflare-pages-access.md
- adr/0033-builtin-sidebar-views.md
- adr/0014-wysiwyg-blocknote-editor.md
- adr/0021-draft-state-optimistic-ui.md
- adr/0039-adopter-upgrade-path.md (defines and consumes the capability endpoint)
- adr/0047-ui-language-i18n-layer.md (the layer this ADR supplies the control and the storage for)
- adr/0044-what-the-url-addresses.md (heading anchors, which a change in body height would disturb)
- CONVENTIONS.md (Language)

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-30 | r1 | marco | Initial draft. |
| 2026-08-06 | r2 | marco | Resolved the open question: commit availability is read at runtime from a capability endpoint, not baked into the build. Settled and implemented under `adr/0039-*.md`, which consumes the same signal. No change to this ADR's scope or criteria. |
| 2026-08-11 | r3 | marco | Retitled and rescoped ahead of implementation, now that `adr/0047-*.md` has shipped the layer this modal controls. The token becomes a conditional notice rather than a status line, and the editor gating loses its "by default" — there is no override. The language selector is specified as dynamic over the shipped catalogues, and a second selector is added for the formatting locale, which 0047 established as a separate decision. Criteria restated from 5 to 10. |
| 2026-08-11 | r4 | marco | Settled four points raised while planning. The body and the commit actions are split, because one is content and the other is controls: the body always renders, read-only until write access is confirmed, so an unanswered endpoint can only relax into writing and the heading-anchor scroll gains no extra reflow; the actions are withheld until write access is *confirmed* — absent while the answer is outstanding, not only when it is no — and fade in on confirmation. They are **removed** rather than disabled, and the gating is stated over all of them, not the editor alone. Hiding the selected Inbox now leaves that list open, aligning with `adr/0046-*.md` instead of diverging from it. Criteria 10 to 12. |
| 2026-08-11 | r5 | marco | Reversed r4's absence rule after using the shipped feature: withholding the commit actions until the answer arrives makes them appear late, which reflows the rows below and visibly shifts the sidebar's type list and the note list header. Criterion 10 already forbade exactly this for the body; the controls had been left out of that reasoning. They are now present at all times and disabled until write access is confirmed, each with a one-line tooltip — which is also the answer to r4's objection that a disabled control raises a question. Inert is `aria-disabled`, not the `disabled` attribute, which would suppress the tooltip's own hover. The fade on arrival goes with the arrival it described, replaced by a transition between states. Criteria 11 and 12 rewritten. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Owner | marco | 2026-08-11 | Accepted at r3 |
