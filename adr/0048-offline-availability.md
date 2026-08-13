---
adr: 0048
title: Offline availability — precached shell and snapshot, editing preserved, commit awaits the network
status: Proposed
date: 2026-08-13
owner: marco
supersedes:
superseded-by:
depends-on: [0002, 0006, 0012, 0021, 0034]
tags: [offline, availability, service-worker, read, edit, ux]
---

# ADR 0048 — Offline availability — precached shell and snapshot, editing preserved, commit awaits the network

## Context

The app is already, almost by accident, close to working without a network. The
build-time content pipeline (`adr/0002-build-time-content-pipeline.md`) compiles
the whole vault snapshot **into the JS bundle** through the
`virtual:web-vault-content` module, so reading a note fetches nothing: notes,
saved views, the title index and the resolved map metadata are all in the entry
bundle by the time the app paints. Hash routing
(`adr/0006-hash-based-routing.md`) means navigating between notes never touches
the server. Drafts, pending edits, preferences and share state live in
`localStorage`. And `scripts/build-headers.mjs` marks `/assets/*` as
`immutable, max-age=31536000`, so after one visit the hashed chunks sit in the
HTTP cache.

What is missing is everything that makes that reliable rather than lucky.

**The entry cannot be re-fetched.** `index.html` is deliberately `no-cache` —
it carries the entry bundle's hashed name, and serving it stale is how a tab
ends up asking for chunks a deploy has already dropped. Offline, that
revalidation simply fails and the app does not start at all. No amount of cache
header tuning fixes this; it is what a service worker exists for.

**Reading a note goes through a lazily loaded chunk.** This is the
counter-intuitive part. `src/components/NoteView.jsx` renders the note body with
`<BlockEditor readOnly={!canWrite}>` behind `React.lazy`, so the BlockNote chunk
is not an editing accessory — it is on the **read** path. The map view and the
per-type icon chunks are lazy too. Any of them absent from cache offline lands
on `ChunkBoundary`, which is an error screen, not a degraded read.

**Attachments have no policy at all.** `/attachments/*` carries no cache rule,
so it is left to browser heuristics. It is also the one part of a vault with no
upper bound: a folder of videos and PDFs can be gigabytes, which rules out
precaching it wholesale.

### The accident that has to be undone

The remaining gap is the interesting one, because the current behaviour is the
opposite of what this ADR wants.

`src/lib/capabilities.js` probes `/api/capabilities` once, from a mount-time
effect in `App.jsx`, and lands on `canWrite: false` whenever that probe fails
for any reason. `adr/0034-client-settings-modal.md` then builds on that answer:
criterion 10 has the editor *born* read-only, relaxing only once write access
is confirmed, and criterion 11 holds every committing action inert until the
same confirmation arrives. Together they are exactly right against an
unanswered endpoint on a reachable network — the failure they were written for
is a deployment with no GitHub secret.

Offline they misfire twice over. The probe cannot succeed, so a cold offline
start never confirms anything: the editor stays read-only forever, "new note"
stays inert, and the app the user opens on a plane is one they can only read.
And the explanation they are shown is about a deployment missing its secret —
a sentence that is simply untrue of a deployment that writes perfectly well.
Connectivity has been inferred as capability.

The distinction this ADR draws is that **write access is a property of the
deployment and connectivity is a property of the moment**. A deployment that
answered "I can write" has not stopped being able to; the client has merely
stopped being able to ask. So the answer is remembered, per deployment, and a
probe that fails while the client is offline leaves the last known answer
standing rather than overwriting it with `false`. This deliberately revises the
"not persisted" note in `src/lib/capabilities.js` — written against the risk of
a cached `true` outliving an adopter removing the secret. That risk is real and
stays bounded: the next successful probe corrects the memory, and the worst
outcome in between is a commit that fails against a durable draft, which is a
state the app already handles.

### Why editing offline is not a new drift risk

Editing offline invites a long session against a base the client cannot check,
and the drafts it produces may meet a vault that has moved. That is drift, and
it is deliberately **not** solved here, because it is not specific to being
offline.

Three things already bound it. Drafts and pending edits are durable, one working
copy per note in `localStorage` (`adr/0021-draft-state-optimistic-ui.md`), so a
stale base never silently loses work. The commit path fast-forwards with
`force:false`, so a commit on an advanced branch is rejected with a 409
(`adr/0019-atomic-commit-git-data-api.md`) rather than overwriting anything. And
what the editing user is told when the base moves is already decided, at the
right altitude, by `adr/0031-edit-time-drift-policy.md` on the signal
`adr/0030-background-freshness-detection.md` supplies: warn, preserve, never
merge or discard for the user.

From the drift machinery's point of view an offline session is indistinguishable
from a long online session on a stale base. Building a second, offline-specific
answer would mean two policies for one situation. One caveat belongs on the
record: **both 0030 and 0031 are Proposed, not Implemented.** Until they ship
the only drift signal that exists is the 409 at commit time — correct and
non-destructive, but blunt, and arriving after the work rather than during it.

### The boundary that remains

Not every write can survive a missing network, and the dividing line is already
in the code rather than being a policy invented here.

Body edits (`src/lib/pending.js`) and new notes (`src/lib/drafts.js`) are
**staged**: durable working copies that wait for an explicit commit. Nothing
about creating or changing one touches the network, which is why they work
offline by construction.

Share and unshare, delete, and type management are **commit-immediate**: they
post to `/api/commit` at the moment of the click, and their local stores
(`src/lib/shares.js`, `src/lib/deleted.js`) exist only to bridge the gap until
the next build catches up — `deleted.js` says so outright, "the delete commit
lands immediately". There is no working copy to hold them in, and inventing one
would be an offline write queue, a decision this ADR does not make. Offline they
stay inert, for the same reason the commit action itself does: the operation *is*
the network call.

## Capability statement

A built deployment registers a service worker that precaches the application
shell — the HTML entry, every emitted asset chunk including the lazily loaded
ones, the brand icons and the web manifest — together with the inline images the
vault's notes display, so that after one successful visit the app **starts,
navigates and reads its whole snapshot with no network at all**. Other
attachments are cached as they are viewed, and requests that are meaningless
offline are passed through untouched. Offline the client remains **fully
editable**: note bodies can be edited and new notes created, into the same
durable stores an online session uses, because write access is remembered from
the deployment's last known answer instead of being re-inferred from
connectivity. Only the operations that *are* a network call — the commit itself,
and the commit-immediate share, delete and type actions — are inert while
offline, each explaining that the network is missing rather than that the
deployment cannot write. Everything authored offline survives untouched and
becomes committable the moment connectivity returns, with no page reload.

## User stories / scenarios

- As a reader on a plane, I open the app with no connection and it starts,
  lists my notes, and renders any note I select, including its inline images.
- As a reader, I follow wikilinks across the vault offline and nothing behaves
  differently from an online session, because the snapshot was never fetched
  in the first place.
- As a reader offline, I open a note whose body links a video or a large PDF I
  have never viewed; the note renders and only that one item is unavailable.
- As a writer on a plane, I edit notes and create new ones for the whole flight,
  and my work accumulates exactly as it would online.
- As a writer offline, I try to commit and the control tells me the network is
  missing — not that this deployment lacks write access.
- As a writer landing with a phone full of offline edits, the app reconnects and
  the commit control becomes live without my reloading anything; nothing I wrote
  was lost or altered in the meantime.
- As a writer whose offline drafts meet a vault that moved while I was away, I
  am handled by the same drift policy as any other stale base — not by a
  separate offline rule.

## Acceptance criteria

1. A production build emits a service worker and registers it; `wv dev` does
   **not** register one, so the dev server keeps serving modules unmediated.
2. The service worker precaches, at install: the HTML entry, every asset the
   build emits under the hashed output directory — including the lazily loaded
   editor, map and icon chunks — the brand icons and the web manifest.
3. The precache manifest is generated from the actual build output, not
   hand-maintained, so a newly emitted chunk is covered without anyone editing
   a list.
4. The precache also includes every same-origin **inline image** referenced by a
   note body, identified with the same rule the client uses to tell an inline
   image from a media/file link (`![…](…)` versus `MEDIA_EXT` or an
   `attachments/` link in `src/lib/mdLinks.js` / `src/lib/richMarkdown.js`).
5. Attachments that are not inline images — video, audio, PDF and other file
   links — are not precached; they are cached when first fetched and served
   from cache afterwards, including offline.
6. With the network disabled after one successful visit, a cold start (full
   reload) renders the app shell, the note list and the sidebar.
7. With the network disabled, selecting any note renders its body — the
   lazily loaded editor chunk resolves from cache and `ChunkBoundary` does not
   engage.
8. Requests to `/api/*`, to the framework's release feed and to any
   cross-origin resource are passed through and never served from the offline
   cache; offline they fail exactly as they do today, with no new error surface.
9. Public share pages under `/shared/*` are neither precached nor served from
   cache, and continue to work online unchanged despite falling inside the
   service worker's scope.
10. Navigation requests are network-first with a cache fallback, so an online
    load always receives the freshly published entry and no client is pinned to
    a superseded build by the presence of the cache.
11. Each build's caches are keyed to the build identity
    (`adr/0012-build-version-chip.md`); caches from earlier builds are deleted
    when the new service worker activates, so storage does not accumulate one
    copy of the vault per deploy.
12. The service worker script itself is served always-revalidated, so a
    published fix to it reaches an already-installed client.
13. A successful capability probe is **remembered per deployment** and survives
    a reload. A probe that fails while the client is offline leaves the
    remembered answer standing; it never resolves to "cannot write".
14. A probe that *succeeds* and reports no write access overwrites the
    remembered answer, so an adopter removing the deployment's secret is
    reflected on the next successful probe.
15. With the network disabled and write access remembered as available, note
    bodies are editable and new notes can be created; both persist to the same
    durable stores an online session writes to
    (`adr/0021-draft-state-optimistic-ui.md`).
16. With the network disabled, the actions that are themselves a network call —
    commit, share/unshare, delete, type create/edit, the pin bump — are inert,
    using the existing inert-not-disabled treatment
    (`adr/0034-client-settings-modal.md`, criterion 12).
17. The explanation shown on an action held inert by criterion 16 names the
    missing network, and is distinct from the explanation shown when the
    deployment has no write capability. Neither message is used for the other
    situation.
18. Every draft, pending edit and note created while offline survives the whole
    offline period unchanged.
19. When connectivity returns the client re-probes the deployment and restores
    the actions of criterion 16 **without a page reload**; nothing is committed
    automatically.
20. Drift between work authored offline and a vault that advanced meanwhile is
    not resolved here: it is left to the existing drift policy
    (`adr/0031-edit-time-drift-policy.md`) and, failing that, to the 409
    fast-forward rejection (`adr/0019-atomic-commit-git-data-api.md`).
21. No ADR number, ADR title, or reference to the ADR catalogue appears in any
    string this capability shows a user.

## Out of scope

- **Automatic commit on reconnect.** Nothing is posted without an explicit user
  action; there is no queue that fires by itself. Criterion 19 restores the
  affordance, not the outcome.
- **Offline share, unshare, delete and type management.** These are
  commit-immediate operations with no staging store; giving them one is an
  offline write queue and would need its own decision.
- **Drift resolution.** What an editor is told when the base moved under their
  draft belongs to `adr/0031-edit-time-drift-policy.md`, on the signal
  `adr/0030-background-freshness-detection.md` provides.
- **Proactive "new content is available" detection and its notice** —
  `adr/0030`. This ADR only guarantees that the cache never prevents a new build
  from being picked up (criterion 10).
- Note-level freshness or a per-path content manifest — the same boundary
  `adr/0030` draws.
- Offline map imagery: tile layers, the OpenStreetMap embed and remote place
  thumbnails stay online-only. Bulk tile caching is out on both weight and
  provider-terms grounds.
- Offline availability for public share pages (`adr/0025-public-share-pages.md`).
  They are one-off links opened by other people; the isolation is the point.
- A custom install prompt, install UI, or app-store packaging. Installability
  follows from the existing manifest plus a service worker; no new surface is
  added for it here.
- Storage quota management UI — eviction reporting, a "clear offline data"
  control, per-vault budgets.
- Any change to what a note *renders*; this ADR changes availability, not
  presentation.

## Open questions

- **Precache budget for inline images.** A photo-heavy vault could push the
  install payload well past what is reasonable to fetch in one go. Does the
  build cap the inline-image set by total size (falling back to cache-on-view
  above the cap), warn, or neither?
- **Whether offline warrants an indicator of its own.** Criterion 17 puts the
  explanation on each inert control, which is where a user meets the
  consequence. A persistent status-bar marker would state the cause once,
  up front, at the price of another always-on surface. Undecided.

## References

- adr/0002-build-time-content-pipeline.md
- adr/0006-hash-based-routing.md
- adr/0012-build-version-chip.md
- adr/0019-atomic-commit-git-data-api.md
- adr/0021-draft-state-optimistic-ui.md
- adr/0025-public-share-pages.md
- adr/0030-background-freshness-detection.md
- adr/0031-edit-time-drift-policy.md
- adr/0034-client-settings-modal.md — criteria 10-12; criteria 13-15 here revise
  how "confirmed" is resolved, from a live answer to a remembered one
- adr/0040-cloudflare-workers-deploy-substrate.md
- src/components/NoteView.jsx, src/components/ChunkBoundary.jsx
- src/lib/capabilities.js, src/lib/writeAction.js
- src/lib/pending.js, src/lib/drafts.js, src/lib/deleted.js, src/lib/shares.js
- src/lib/mdLinks.js, src/lib/richMarkdown.js
- scripts/build-headers.mjs, scripts/copy-attachments.mjs, lib/vite-config.mjs

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-08-13 | r1 | marco | Initial draft. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
