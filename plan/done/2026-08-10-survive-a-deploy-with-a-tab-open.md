# Survive a deploy with a tab open — revalidate the HTML, recover from a missing chunk

**Owning ADR(s):** `adr/0040-cloudflare-workers-deploy-substrate.md`
**Related (not implemented here):** `adr/0030-background-freshness-detection.md`

## Context

Opening map view on a note with pins crashed the deployed app to a blank screen:

```
GET /assets/MapView-UDqmwo8L.js  404 (Not Found)
Uncaught TypeError: Failed to fetch dynamically imported module: .../assets/MapView-UDqmwo8L.js
```

Nothing is wrong with the map. `MapView` is simply the only surface that loads a
chunk **lazily, after first paint** (`src/components/NoteView.jsx:13`) — everything
else rides the entry bundle — so it is the first thing to trip over a much more
general failure: **the browser is running an `index.html` older than the deploy.**

The chain:

1. The browser holds a stale `index.html`, whose entry bundle has the previous
   build's chunk hashes compiled into it.
2. A new deploy publishes new content-hashed chunks and drops the old ones.
3. The stale entry asks for `MapView-<old-hash>.js`, which no longer exists → 404.
4. Nothing catches the rejected `import()`, so the `lazy` boundary throws and the
   app unmounts to white.

Root cause is a gap in the cache policy. `scripts/build-headers.mjs` correctly
marks `/assets/*` `immutable` — safe, the names are content-hashed — but sets **no
`Cache-Control` on the HTML entry at all**. With no directive the browser applies
heuristic freshness and may serve `index.html` from cache for a long time. The one
file that must never be cached is the only one with no policy.

Headers alone are necessary but not sufficient: a tab left open *across* a deploy
already has the old entry bundle in memory, so a correct header cannot save it. It
will still request a chunk that has been deleted. That case needs a runtime
recovery path, which is why both halves ship as one item.

There is a second, adopter-side trap. `build-headers.mjs` lets a consumer's
`public/_headers` win and suppress the generated file entirely. The override is
intentional and stays, but it is all-or-nothing: a consumer file replaces these
rules wholesale, so it silently misses every later fix to them — this one
included. Neither onboarding path creates such a file (SETUP.md states `_headers`
is not scaffolded; the template ships no `.web/public/`), so this is about the
override being silent, not about migrating anyone.

## Scope

1. **Revalidate the HTML entry.** In `scripts/build-headers.mjs`, emit a
   `Cache-Control` rule for the HTML entry (`/` and `/index.html`) that forces
   revalidation on every navigation — `no-cache` (store, but always revalidate),
   not `no-store`. `/assets/*` stays `immutable`; that pairing is the whole point
   of content hashing and must not be weakened.

2. **Recover instead of crashing.** Add an error boundary around the lazy
   boundaries in `src/components/NoteView.jsx` (both `MapView` and `BlockEditor`)
   that catches a failed dynamic import and offers a reload rather than letting
   the app unmount.

   **Copy constraint:** the message must NOT say "new version" or otherwise read
   as a framework upgrade. The upgrade notice bottom-left
   (`adr/0038-in-app-upgrade-notice.md`, `src/components/VersionIndicator.jsx`) is
   a different thing — a new web-vault release — and two surfaces both saying
   "new version" for unrelated events is a genuine confusion. This one is about
   the **vault's content** having moved on: word it as new content being
   available, e.g. "New content is available — reload to see it."

3. **Make the suppression visible.** Warn at build time when a consumer
   `public/_headers` suppresses the generated file, naming what is being skipped,
   so it is a visible choice rather than a silent one. Warn only — do not
   override the consumer's file.

## Out of scope

- Implementing `adr/0030-background-freshness-detection.md`. This item does not
  poll, does not detect a new build, and does not soft re-fetch anything; it only
  keeps a chunk 404 from being fatal. 0030 stays Proposed and unimplemented. A
  reference is added there so that whoever implements it knows this recovery path
  exists and can fold it into the real freshness signal — the reload prompt here
  is the crude, reactive version of what 0030 does proactively.
- Any change to the upgrade notice or its copy.
- Removing the consumer `_headers` override.

## Exit criteria

1. A build emits `_headers` in which the HTML entry is revalidated on every
   navigation, while `/assets/*` remains `public, max-age=31536000, immutable`.
2. A failed dynamic import of `MapView` or `BlockEditor` renders a recovery
   message with a reload affordance; the surrounding app stays mounted.
3. That message does not contain the words "new version" and refers to content,
   not to a web-vault release.
4. A build where the consumer ships `public/_headers` logs a warning naming the
   suppression, and still leaves the consumer's file in place.
5. Tests cover: the generated header rules (1), the boundary's fallback and its
   copy (2, 3), and the suppression warning (4).
6. `yarn verify` green.
