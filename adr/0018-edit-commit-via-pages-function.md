---
adr: 0018
title: Edit-to-commit via a Cloudflare Pages Function, token as a server secret
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002]
tags: [editor, commit, security, functions]
---

# ADR 0018 — Edit-to-commit via a Cloudflare Pages Function, token as a server secret

## Context

To let the convenience editor (`adr/0014-wysiwyg-blocknote-editor.md`) persist
changes, a note edit must become a commit in the vault's git repository — and,
since web-vault is deployment-agnostic (`adr/0017-deployment-model.md`), through a
**same-origin serverless endpoint** behind the app's own access control, a
primitive available on any serverless host. The hard constraint is that the
**GitHub token must never live in the client bundle**. Two alternatives were
rejected: putting the token in the JS behind the app's access control
(technically workable for a single user, but it leaves a wider surface — a widened
access bypass, the cache, a device, or git history could expose it); and
isomorphic-git in the browser (fascinating, but GitHub's git-HTTP endpoints send
no CORS headers, so it still needs a server-side CORS proxy, and it is heavy
machinery — clone + history in IndexedDB — for "change a note and commit").

## Capability statement

Committing goes through a **same-origin serverless commit endpoint** behind the
same access control as the app: the UI does `fetch('/api/commit')` and never
talks to GitHub directly. On the first supported deployment (Cloudflare Pages)
the endpoint is a **Pages Function** at `/api/commit`. The GitHub token lives only
as an **encrypted host secret** (`env.GITHUB_TOKEN`), server-side, so there is no
token in the bundle to protect; a fine-grained PAT with `contents:write` on the
vault repo is enough. The handler is zero-dependency (`fetch` to the GitHub API,
no SDK).

## User stories / scenarios

- As an editor-user, I commit an edit and the token that authorises it is never
  in anything my browser downloads.
- As an operator, I set one encrypted secret on the host and rotate it there; the
  client never changes.
- As a maintainer, the commit endpoint is same-origin and inherits the app's
  Access protection with no extra CORS setup.

## Acceptance criteria

1. The client commits by POSTing to a same-origin `/api/commit` Function; it does
   not call the GitHub API directly.
2. The GitHub token is read only from `env.GITHUB_TOKEN` (an encrypted host
   secret) inside the Function; it never appears in the client bundle or a
   response body.
3. The Function has no runtime dependencies beyond `fetch` and Web APIs.
4. The commit endpoint is behind the same access control as the rest of the app
   (on Cloudflare, Access — `adr/0026-cloudflare-pages-access.md`).

## Out of scope

- The commit algorithm itself (`adr/0019-atomic-commit-git-data-api.md`).
- Which branch is committed to (`adr/0020-commit-target-deployment-branch.md`).
- How the Function file is produced in the packaged framework
  (`adr/0005-framework-package.md`).

## Open questions

- **Git backend is GitHub-only today**, by deliberate scope. Supporting other git
  hosts (GitLab, Gitea, …) is a future direction, deferred: it is harder to
  abstract than the deployment layer because the atomic commit path uses GitHub's
  specific Git Data API (`adr/0019-atomic-commit-git-data-api.md`), and each
  provider would need real validation. No provider abstraction is built until a
  concrete second backend exists — pre-abstracting an unvalidated API would
  likely be wrong.

## References

- functions/commit.js
- adr/0017-deployment-model.md
- adr/0019-atomic-commit-git-data-api.md, adr/0026-cloudflare-pages-access.md

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact from existing implementation (backfill). |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-07-29 | — |
