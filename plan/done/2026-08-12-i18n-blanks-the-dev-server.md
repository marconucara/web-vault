# The i18n dependencies blank the dev server

**Owning ADR(s):** `adr/0003-stack-react-vite.md` (the Vite configuration),
with `adr/0005-framework-package.md` for why the `portal:` link is the
condition that matters.

## Context

v0.11.2 shipped the i18n layer (`adr/0047-ui-language-i18n-layer.md`) with
`i18next` and `react-i18next` as new dependencies. `wv dev` then serves a blank
screen:

```
Uncaught SyntaxError: The requested module
'/node_modules/use-sync-external-store/shim/index.js?v=...'
does not provide an export named 'useSyncExternalStore'
```

`react-i18next`'s `useTranslation` imports `useSyncExternalStore` from
`use-sync-external-store/shim`. That module is CJS with a conditional `require`
on `NODE_ENV` and, at 1.6.0, has no `main` field — only `exports`. Vite's dev
scanner does not pre-bundle it, serves it raw, and the named import fails.

The production build (Rollup) is unaffected, which is why remote deploys looked
healthy. Confirmed by building the fixture: the build completes and emits 31
chunks, the lucide grouping working as intended.

## What was investigated, and what it changed

The item was queued to do more than add a line: this was the fifth instance of
the same class of bug, and `optimizeDeps.include` had been growing by incident.
The intended fix was to replace the hand-written list with automatic discovery —
set `optimizeDeps.entries` to the real app entry so esbuild walks the whole
import graph, and reduce `include` to only what a scanner cannot see by
construction.

**Measurement rejected that plan.** It does not work, and the reason is
structural rather than incidental.

The measurements were first taken with the package resolved standalone, and in
that condition the bug **does not reproduce at all**: the app mounts, no console
errors. The reproducing condition is the `portal:` link — how this package is
actually developed — where `resolve.preserveSymlinks: true` makes esbuild walk
modules by their real paths inside the linked package. It then stops classifying
them as optimizable dependencies. Results under that condition, each booted
through the consumer's own resolution with `--preserve-symlinks`, checked in a
headless browser for console errors and a mounted `#root`:

| `optimizeDeps` | outcome |
|---|---|
| current list (no fix) | `#root` empty — the reported `useSyncExternalStore` error |
| `include: ['use-sync-external-store/shim']` only | `#root` empty — fails earlier, on `react-dom/client` / `createRoot` |
| `entries` + minimal include | `#root` empty — same `react-dom/client` failure |
| current list + `use-sync-external-store/shim` | mounts, no errors |

So the list is **load-bearing, not legacy**. Reducing it breaks the app on
`react-dom/client` before execution ever reaches the exotic cases, and
`entries` does not change that: the problem is not discovery but
classification, and no discovery setting can reach it.

The two entries the original diagnosis proposed adding — `i18next` and
`react-i18next` — are **not** what fixes this. Both are already found by the
crawl. The single necessary entry is `use-sync-external-store/shim`.

## Change

One entry added to `optimizeDeps.include`, nothing removed, plus a comment
recording why the list cannot be replaced by automatic discovery — so the next
occurrence is answered by adding a line rather than by repeating this
investigation.

## Not done

The dev/prod asymmetry in CI (a headless smoke of `wv dev` that fails on console
errors or a missing mount) is **not** part of this item, deferred by the
operator. The groundwork exists and is cheap to pick up: `playwright` is already
a devDependency, and `VAULT_DIR` in `scripts/paths.mjs` is overridable, so a
fixture vault can live inside the repo without violating the self-contained gate
rule in `AGENTS.md`. The reproduction harness used here is the shape such a test
would take. Until it exists, this class of bug is still caught only by someone
running `wv dev`.

---

Shipped: v0.11.3, HEAD `(this commit)`.
