# Stop emitting a chunk for every lucide icon

**Owning ADR(s):** `adr/0003-stack-react-vite.md`
**Dependencies:** `adr/0045-manage-types-from-the-ui.md` (its status decides the shape of the fix)

## Context

`plan/done/2026-08-06-bundle-type-icons-at-build-time.md` moved the type icons a
vault actually uses into the app bundle, so they paint with the first frame. What
it deliberately did not touch is what `DynamicIcon` costs the *build*: lucide's
dynamic entry point carries a map of `import()` calls covering its entire icon
set, so Rollup emits one chunk per icon whether or not anything can reach it.

Measured on a two-type vault after that change: **1,760 JS chunks in `dist/assets`**,
of which roughly 1,750 are single icons — `wheat-off`, `hop-off`, `brain-cog` and
so on — that no code path reaches. They are small individually and never fetched,
so nothing is slow at runtime; the cost is a `dist/` full of noise, slower builds
and uploads, and a deploy listing that is hard to read.

## Scope

The fix depends on a decision that has not been made yet, which is why this is
queued rather than done:

- **If `0045` lands an icon picker**, the full set has to stay reachable — a user
  can pick any lucide icon at runtime. The work is then to stop it being ~1,750
  *separate* chunks: group them (`manualChunks`) so the picker still resolves any
  icon without the one-file-per-icon explosion.
- **If `0045` does not land, or the picker offers a closed set**, `DynamicIcon`
  can go entirely. The bundled map from the shipped item already covers every
  icon a build can know about, and the fallback would only need to handle icons
  chosen between builds — which, with no picker, cannot happen.

Settle which of the two applies before implementing, and record why.

## Out of scope

- The bundled-icon mechanism itself; that shipped and works.
- Chunking of anything other than the icon set.

## Exit criteria

1. A build of a small vault emits a number of chunks proportional to what the app
   can actually reach, not to the size of lucide's icon set.
2. Every icon that rendered before still renders — bundled type icons, the app's
   own UI icons, and (if the fallback is kept) an icon name not known at build
   time.
3. The decision between the two options above is recorded, with its reason.
4. `yarn verify` green.
