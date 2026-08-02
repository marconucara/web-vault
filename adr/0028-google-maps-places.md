---
adr: 0028
title: Google Maps places — keyless build-time resolution, place cards, and map view
status: Implemented
date: 2026-07-29
owner: marco
supersedes:
superseded-by:
depends-on: [0002, 0015, 0016]
tags: [maps, editor, ui, build, cache]
---

# ADR 0028 — Google Maps places — keyless build-time resolution, place cards, and map view

## Context

Notes often contain Google Maps links to places. Shown as raw links they carry no
context; as rich cards and on a map they become useful. This must stay **keyless**
(no Maps API key) and must not break the markdown round-trip
(`adr/0015-durable-markdown-round-trip.md`). Short Maps links are opaque and the
browser can't follow them (CORS), so the place data is resolved at build time in
Node; the rendering (cards, map) then consumes that resolved data. From CI/
datacenter IPs Google sometimes answers `429`, which would ship unresolved links
until the next build, so a cache that survives between builds makes that
transient.

## Capability statement

**Build-time resolution (keyless).** `scripts/resolve-maps.mjs` resolves each Maps
link into `{ title, address, image, ratingStars, category, lat, lng }` baked into
the content artifact (`adr/0002-build-time-content-pipeline.md`). It reads Google's
Open Graph with a social-crawler User-Agent plus a pre-accepted consent cookie (so
datacenter/CI IPs get the preview, not a consent shell); coordinates come from the
resolved URL, else the `og:image` static-map `center=`, else an OpenStreetMap
**Nominatim** geocode (serialised, ~1 req/s). Fetches run with bounded concurrency
(`MAPS_CONCURRENCY`) and retry `429`/network errors with jittered backoff
(`MAPS_RETRIES`). Resolution must happen in CI so notes edited from the web editor
— which never pass through a local machine — also resolve.

**What counts as resolved.** A link is resolved only when Google returned a
**name or a photo**; coordinates alone are not a place. This deliberately drops
the coordinates-only entries that the `og:image` static-map fallback could
produce — they rendered a nameless pin, and they are indistinguishable from a
blocked response's bogus coordinates. Google's `/sorry/`
rate-limit interstitial is treated as a failed fetch (like a network error) and
never parsed, and coordinates are never taken from the `continue=` parameter that
page echoes back. Unresolved links are omitted from the artifact, kept out of both
caches, reported as `UNRESOLVED` in the build log, and retried on the next build;
they never fail the build, because a `429` is transient and hits every link at
once, so failing would re-fatalise what the cache exists to absorb.

**Persistent cross-build cache.** A transient CI `429` is made non-fatal: with
`MAP_CACHE_KEY` set, each build writes an **encrypted** (AES-256-GCM) cache to
`dist/maps-cache.json` — a public static file, opaque without the key (no key = it
is never written, never plaintext). The build reads the previous build's cache
first (from `SITE_URL`, auto-detected from `CF_PAGES_URL` / Vercel / Netlify, or an
explicit `MAP_CACHE_URL`) and re-fetches only the missing links. The cache is
provider-agnostic and never committed.

**Body place cards.** A Maps link that starts its own line (paragraph or list item,
bare or `[title](url)`, with optional trailing text as a description) becomes a
compact place-preview card (photo, name, address, rating, category) via a custom
BlockNote `mapcard` block, with an in-place floating editor (URL + description,
Enter/Esc, Cmd/Ctrl+click to open). The markdown round-trips **exactly**: the block
carries a token, and the grouped card is derived on render and stripped on export.

**Map view.** A toolbar toggle replaces the note body with a fullscreen **Leaflet +
OpenStreetMap** map (keyless raster tiles) of all the note's points; a headings
sidebar filters markers to one section (exclusive, default "All markers") and
recenters; pins are coloured per list (shared palette, assigned in order of
appearance), with duplicates spread apart.

## User stories / scenarios

- As a vault owner, my Maps links render as cards with photos and coordinates, with
  no API key.
- As a reader, I toggle a map view to see all of a note's places at once and filter
  them by section.
- As an operator, a transient Google `429` on CI does not wipe already-resolved
  places, because the previous build's cache is reused.
- As a vault owner editing from the web, my newly added Maps links resolve on the CI
  build without ever touching my machine.
- As a vault owner, adding or editing a place card does not churn the note's
  markdown beyond the intended change.

## Acceptance criteria

1. The build resolves each Maps link to `{title, address, image, ratingStars,
   category, lat, lng}` in the content artifact, keyless; coordinates resolve from
   the URL, else the `og:image` static-map center, else a serialised OSM Nominatim
   geocode; fetches use bounded concurrency and retry transient errors.
2. With `MAP_CACHE_KEY` set, the build writes an encrypted `dist/maps-cache.json`
   and, on the next build, reads the prior deploy's cache and re-fetches only
   missing links; with no key nothing is written (never plaintext). Neither the
   local nor the deployed cache is committed.
3. A Maps link starting its own line renders as a `mapcard` place card (photo,
   name, address, rating, category) with an in-place editor; other Maps links stay
   inline. The block round-trips to the original markdown exactly (token-based).
4. A toolbar toggle shows a keyless Leaflet + OpenStreetMap map of the note's
   points, with a headings filter and per-list coloured pins.
5. No Google Maps API key is required at build or runtime.
6. A link counts as resolved only with a title or an image. A blocked response
   (`429`, non-OK, or a `/sorry/` final URL) yields no entry, contributes no
   coordinates, and is written to neither cache; an entry lacking title and image
   — including one read from a previously deployed cache — is re-fetched on the
   next build. Unresolved links are listed as `UNRESOLVED` in the build log and
   do not change the build's exit status.

## Out of scope

- Non-Google map providers.

## Open questions

- ~~Surfacing unresolved links to the client.~~ Split out into
  `adr/0043-map-link-resolution-diagnostics.md` (Proposed): today the only
  signal that a link failed to resolve is the build log.
- Moving resolution to an on-demand Pages Function + KV cache, only if the
  build-time approach ever becomes a bottleneck (the persistent cross-build cache
  already covers the common case; raise `MAPS_CONCURRENCY` for a big first build).

## References

- scripts/resolve-maps.mjs, scripts/resolve-maps.test.mjs, scripts/maps-cache.mjs,
  scripts/build-maps-cache.mjs, scripts/maps-genkey.mjs
- src/components/MapCard.jsx, src/components/MapView.jsx, src/lib/mdLinks.js
- adr/0002-build-time-content-pipeline.md, adr/0015-durable-markdown-round-trip.md,
  adr/0016-wikilink-and-media-blocks.md
- adr/0043-map-link-resolution-diagnostics.md — reporting the links this ADR
  leaves unresolved.

## Revision History

| Date | Revision | Author | Change |
|------|----------|--------|--------|
| 2026-07-29 | r1 | marco | Recorded after the fact; merges the keyless build-time resolver, the persistent encrypted cache, the body place-cards, and the map view into one ADR (backfill). |
| 2026-08-02 | r2 | marco | Defined what counts as resolved (title or image; coordinates alone are not a place) after a `429` interstitial was cached as a place — its `continue=` URL yielded plausible coordinates, so the entry passed the old `lat != null` test and was never retried. Blocked responses are now failed fetches, unusable entries stay out of both caches and self-heal, and unresolved links are logged as `UNRESOLVED` without failing the build. Added acceptance criterion 6; parked client-side surfacing as an open question. |
| 2026-08-02 | r3 | marco | Closed the open question on surfacing unresolved links: split out into `adr/0043-map-link-resolution-diagnostics.md`. No behaviour change here. |

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Maintainer | Marco Nucara | 2026-08-02 | — |
