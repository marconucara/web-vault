# Maps resolver — reject blocked responses instead of caching them as places

**Owning ADR(s):** `adr/0028-google-maps-places.md`
**Dependencies:** None

## Context

A rate-limited Google response is currently accepted as a successful resolution
and written to the persistent cache, where it becomes permanent. Observed in a
deploy log:

```
[maps] status=429 htmlLen=4338 ogTitle="" img=no coords=url final=https://www.google.com/sorry/index?continue=https://www.google.it/maps
[gen] maps: 13 link(s), 1 resolved now, 13 usable
```

Three defects compound:

1. `fetchPage` retries a `429` but, once `MAPS_RETRIES` is exhausted, returns the
   last blocked response as if it were valid — no caller checks `res.status`.
2. `extractCoords` runs its `@lat,lng` regex over the whole final URL, so the
   `?continue=…` of a `/sorry/` interstitial yields bogus coordinates.
3. Both the "needs resolving" filter and the "usable" guard treat `lat != null`
   as proof of success, so the bogus entry is considered resolved, is written to
   `dist/maps-cache.json`, and is never retried on any later build.

Net effect: one poisoned pin per blocked link, permanent until `MAP_CACHE_KEY` is
rotated, and a `usable` count that overstates reality.

## Scope

- `scripts/resolve-maps.mjs` — treat a `429`/5xx or a `/sorry/` final URL as a
  failed fetch, not a page to parse.
- `scripts/resolve-maps.mjs` — do not derive coordinates from a blocked or
  non-place final URL (strip the `continue=` payload before matching).
- `scripts/resolve-maps.mjs` — require `title || image` for an entry to count as
  usable and to be considered already-resolved, so entries already poisoned in a
  deployed cache self-heal on the next build without a key rotation.
- `scripts/resolve-maps.mjs` — log an explicit `UNRESOLVED` summary line listing
  the links that did not resolve, with the reason. Exit code unchanged.
- Tests in `scripts/resolve-maps.test.mjs` covering the blocked-response and
  cache-eligibility behaviour.

## Out of scope

- Failing the build on unresolved links. Rejected deliberately: a `429` is
  transient and IP-sticky across the whole build, so a hard gate would block
  unrelated deploys and re-fatalise exactly what the persistent cache exists to
  make non-fatal; a permanently dead link would hold every future build hostage.
- Surfacing unresolved links on the client (`mapsIssues` in the content artifact,
  plus an optional `MAPS_STRICT` gate limited to permanent failures). That is a
  new decision and needs its own ADR; parked.

## Exit criteria

1. A `429` (or any non-OK status, or a `/sorry/` final URL) that survives all
   retries produces no place entry: the link is absent from `maps` in the content
   artifact and absent from the written cache.
2. Coordinates are never taken from the `continue=` payload of a blocked URL.
3. An entry with neither `title` nor `image` is not counted as usable and is
   retried on the next build, including when it arrived from the persistent
   cache — a previously poisoned entry recovers with no key rotation.
4. The build logs an `UNRESOLVED` line naming each unresolved link and its
   reason; the process exit code is unchanged (success).
5. `yarn verify` is green.

Maps to ADR 0028 acceptance criteria 1 (resolution and transient-error retry) and
2 (persistent cache contents).

---

**Shipped:** 2026-08-02 · HEAD `bd49d88` · `v0.5.1` · ADR 0028 r2 (stays
Implemented; the fix corrects behaviour already decided). `yarn verify` green
(typecheck + 19 tests). Client-side surfacing of unresolved links deferred to a
future ADR.
