# Dev-server CJS/ESM interop for the editor stack

Owning ADR: `adr/0014-wysiwyg-blocknote-editor.md` (with `adr/0003-stack-react-vite.md`).

Reactive fix (no prior todo). Scope: the local dev server (`wv dev`) blanked with
`does not provide an export named ...` for plain-CJS transitive deps whose named
exports Vite's dev scanner can't detect when the importer is served raw:

- `style-to-js` (`module.exports = fn`) via the react-markdown chain — a default
  import, fixed by listing the leaf.
- `use-sync-external-store` shims (conditional `require`) via `zustand`, pulled by
  the BlockNote editor — a *named* import; listing the leaf yields default-only, so
  the fix is to pre-bundle the editor libraries (`@blocknote/core`,
  `@blocknote/react`, `@blocknote/mantine`) so esbuild inlines the whole subtree
  and resolves the interop.

Both handled via Vite `optimizeDeps.include` in `lib/vite-config.mjs`. Production
(Rollup) was never affected; this is dev-only optimization.

Shipped in v0.3.0. Verified: the editor mounts in dev on a real install; the
optimized graph carries `useSyncExternalStoreWithSelector` (no raw CJS file
served). `wv build` is unaffected (optimizeDeps does not apply to the Rollup build).
