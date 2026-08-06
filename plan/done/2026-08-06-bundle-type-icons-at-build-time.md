# Bundle the type icons at build time instead of resolving them dynamically

**Owning ADR(s):** `adr/0009-three-panel-ui-note-list.md`, `adr/0003-stack-react-vite.md`
**Dependencies:** None

## Context

Type icons rendered in two different ways depending on where the glyph came
from, and the difference was visible. The app's own UI icons are inline SVG paths
in `src/components/Icon.jsx` (`PATHS`), so they paint with the first frame. A
type's icon — `icon:`/`_icon:` in its Type document — is a lucide name, and went
through lucide's `DynamicIcon`, which resolves the icon by `import()` at runtime.
Each one arrives in its own chunk, so the sidebar and the note list painted an
invisible placeholder and filled the icons in a frame or more later, next to
local icons that were already there.

Nothing forced that split. The set of type icons is **already known when the
build runs**: it is in the Type documents' frontmatter, which `build-content.mjs`
has written into `content.json` before Vite starts. The dynamic path was
resolving at runtime something the build could have settled.

## Scope

- Derive the used icon names from `content.json` at build time and generate a
  static `{ name: Component }` module from them, so those icons ship in the app
  bundle rather than one chunk each.
- Cover the app's own lucide-named UI icons too (`list` in `MapView`), which are
  not in `content.json` and would otherwise keep taking the dynamic path.
- Keep `DynamicIcon` as the fallback. It is not dead code: `adr/0045-manage-types-from-the-ui.md`
  (Proposed) puts an icon picker in the UI, and an icon chosen there after the
  build is by definition not in the generated set. Without the fallback that icon
  would not render at all until the next build.
- Tolerate a name lucide does not ship (a typo in a Type document) by dropping it
  from the generated module rather than failing the build.

## Tests

- name mapping (kebab -> PascalCase export), including a digits group;
- collection from Type documents: `icon` and `_icon`, ignoring non-Type notes,
  de-duplicated, sorted so the generated module is stable across builds;
- empty/malformed/missing `content.json` degrades to the UI set;
- generated module shape: static imports, no `import(`;
- an unknown icon name is dropped, not emitted;
- the installed lucide icon set is readable and contains what the app names.

## Out of scope

- The ~1,750 per-icon chunks `DynamicIcon` still emits into `dist/` — one for
  every lucide icon, almost none now reachable. Build-output bloat, not a
  correctness problem, and how to fix it depends on whether `0045` lands an icon
  picker (which needs the full map) or not (which allows a closed set). Filed
  separately as `plan/todo/0006-prune-the-dynamic-icon-chunk-map.md`.
- The `0045` open question of whether the local `PATHS` set should be dropped in
  favour of resolving every icon through lucide.

## Exit criteria

1. A type icon named in a Type document renders from the app bundle, with no
   per-icon chunk emitted for it.
2. The app's lucide-named UI icons are bundled on the same path.
3. An icon name not known at build time still renders, via the dynamic fallback.
4. An icon name lucide does not ship does not break the build.
5. `yarn verify` green.

## Outcome

`scripts/type-icons.mjs` collects the names and renders the module; a
`virtual:web-vault-icons` plugin in `lib/vite-config.mjs` generates it from the
same `content.json` the content module reads, with `addWatchFile` so a new type
icon regenerates in dev. `Icon.jsx` gains a step between the local set and
`DynamicIcon`: use the bundled component if there is one.

**Verified against a real build, not just unit tests.** A throwaway vault with
two Type documents (`user-round`, `folder-git-2`) was built with `VAULT_DIR`
pointing outside this repo — so the `wv build` prohibition in `AGENTS.md` is
respected and no stray `dist/` was produced here — and the tree compared before
and after via `git stash`:

| | before | after |
|---|---|---|
| `user-round`, `folder-git-2`, `list` | three separate lazy chunks | no chunk — present in `index` |

**Two details worth keeping.** `lucide-react/dynamic` exports the valid icon
list, but it is bundler-only resolution and cannot be imported from a plain Node
build script; the shipped `dist/esm/icons` directory is the same source of truth
and is exactly the set a deep import can reach. And `require.resolve('lucide-react')`
resolves via `main` into `dist/cjs`, the wrong subtree — the package root has to
be anchored on `package.json`.

The vitest virtual-module stub was generalised to cover both virtual modules, so
the suite still runs from a bare clone with no vault.

228 -> 238 tests. `yarn verify` green.

---

Shipped at HEAD `7179ef6`, released as `v0.8.1` — see the commit for the exact tree.
