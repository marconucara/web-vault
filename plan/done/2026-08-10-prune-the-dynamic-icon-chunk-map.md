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

**The decision this waited on has landed.** `adr/0045-manage-types-from-the-ui.md`
is Implemented and its icon picker offers the **whole** lucide catalogue: a vault
owner can pick any icon at runtime, so the full set must stay reachable and
`DynamicIcon` stays. That settles the fork below in favour of the first branch —
group the icons rather than remove them. The second branch is dead; it is kept
here only to record why.

- **If `0045` lands an icon picker**, the full set has to stay reachable — a user
  can pick any lucide icon at runtime. The work is then to stop it being ~1,750
  *separate* chunks: group them (`manualChunks`) so the picker still resolves any
  icon without the one-file-per-icon explosion.
- **If `0045` does not land, or the picker offers a closed set**, `DynamicIcon`
  can go entirely. The bundled map from the shipped item already covers every
  icon a build can know about, and the fallback would only need to handle icons
  chosen between builds — which, with no picker, cannot happen.

Settled: `0045` landed the picker over the full catalogue, so `manualChunks` it is.
A build of a two-type vault after `0045` still emits ~1,750 single-icon chunks —
the number to bring down.

## Decision

`manualChunks` grouping, with buckets keyed on a **hash of the icon name** rather
than its first letter (`iconChunkName` in `scripts/type-icons.mjs`, wired from
`lib/vite-config.mjs`).

Alphabetical buckets were measured first and rejected: they are lopsided, `s` at
146 KB and `c` at 144 KB against a ~40 KB mean. The path that pays for a bucket
is not the picker but `Icon.jsx`'s step-3 fallback — a type icon chosen in the
running app between builds, rendered in the sidebar — where the rest of the
letter is pure cost. Hashing gives even ~35-52 KB buckets, and being stable
across builds it keeps an unchanged icon set cached.

24 buckets: small enough that pulling one is cheap, few enough to read.

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

---

## Outcome

`iconChunkName` in `scripts/type-icons.mjs`, wired into
`build.rollupOptions.output.manualChunks` from `lib/vite-config.mjs`. It lives
beside the icon set the build already reasons about, so the reason travels with
the code rather than sitting in the Vite config as a bare regex.

Measured on the `Getting Started` vault through a `portal:` link:
**~1,760 → 34 assets** in `dist/`, of which 24 are icon buckets and the rest the
app's own chunks. `BlockEditor` and `MapView` are untouched, as scoped.

Criterion 2 was checked on both halves of the rendering path, which fail
differently:

- The five type icons the vault uses (`airplay`, `note`, `rocket`, `tag`,
  `user`) plus the UI's `list` are still **eager in the main bundle** — the
  bundling mechanism from `plan/done/2026-08-06-bundle-type-icons-at-build-time.md`
  is unaffected and first paint does not change.
- The dynamic map still carries **2,007 names across the 24 buckets**, so an
  icon picked in the running app between builds resolves as before.

Worth knowing if that last number is ever re-checked: it comes from grepping the
**minified** bundle, where the map is emitted as
`s(()=>import("./lucide-NN-*.js").then(t=>t.aq))`. Two plausible-looking regexes
matched nothing and read as "the map is gone" before the real shape was
inspected. It is the most fragile check in this item; the others rest on tests
or on `ls`.

Tested by hand against a real vault before the commit landed, per the standing
rule that the gate is necessary but not sufficient for anything the user sees.

333 tests (6 new). No ADR moves: `adr/0003-stack-react-vite.md` was already
`Implemented`, and this is a build-pipeline change under it, not a new decision.
No version bump — rides along with a later release.
