# Bake the framework version into the build and show it in the status bar

**Owning ADR(s):** `adr/0037-versioning-and-release-policy.md`
**Dependencies:** None. Unblocks `adr/0038-in-app-upgrade-notice.md`.

## Context

`adr/0037-*.md` r3 settles the versioning contract: semver over `vX.Y.Z` git
tags, no GitHub Releases, no `1.0.0` commitment. Its policy half is prose and
lands with the ADR itself, and the release procedure that keeps the four version
references in sync (AC3) lands in `AGENTS.md` with it. Its code half is AC4 +
AC5 — bake the framework's own version into the build, and show it in the status
bar.

Today the build writes `build { sha, short, dirty, builtAt, repo }`
(`scripts/build-content.mjs:188-194`), all of which describes the **adopter's
vault**: the commit the site was built from, and the vault repo the toolbar chip
links to (`adr/0012-build-version-chip.md`). Nothing describes the **framework**.
So the app cannot name its own version — the missing half of the comparison
`adr/0038-*.md` needs — and the adopter cannot see it.

The status bar chip is an `<a>` to the vault commit
(`src/components/StatusBar.jsx:180-191`). The framework version is a different
identity and has no commit to link to, so it sits beside the chip rather than
inside that anchor. `adr/0012-*.md` is untouched: this adds a neighbour, it does
not redefine the commit chip.

## Scope

- Read `version` from the framework package's own `package.json` at build time.
  It must resolve via `PACKAGE_DIR` (`scripts/paths.mjs`), which points at this
  package's root, so it keeps working when the framework is installed inside the
  adopter's `node_modules` — **not** via `PROJECT_DIR`/`VAULT_DIR`, which would
  read the adopter's shell `package.json` and bake the wrong number.
- Add it to the `build` object under a name that cannot be confused with the
  vault commit fields it sits next to (e.g. `frameworkVersion`).
- Record near `gitBuildInfo` why the version comes from `PACKAGE_DIR` while
  everything else in that object comes from the vault — the two identities look
  alike and the next reader will otherwise assume one source.
- Render it in the status bar next to the existing build chip, outside that
  anchor. Both the visible label and the tooltip must make clear which value is
  the framework version and which is the vault commit; do not let them read as
  one compound identity.
- Test that the baked value equals the package's declared `version`, and that it
  is not read from the consumer project.

## Out of scope

- Fetching tags, comparing versions, or any upgrade notice — that is
  `adr/0038-*.md` and gets its own item. The indicator here states the running
  version unconditionally and carries no update-available affordance.
- Any change to the commit chip's own behaviour or to `adr/0012-*.md`.
- Automating or enforcing the version bump across the four places that name a
  version. `adr/0037-*.md` AC2/AC3 require them to match at a release commit, and
  the procedure is documented in `AGENTS.md` (Cutting a release); making it a
  mechanical check rather than a documented step would be its own item, and needs
  a reason beyond "it drifted once".
- Any change to the existing vault commit fields.

## Exit criteria

1. `content.json`'s `build` object carries the framework version, read from the
   framework package's own `package.json`.
2. Resolution goes through `PACKAGE_DIR`, verified to still be correct when the
   package sits in a consumer's `node_modules` rather than being the cwd.
3. A test asserts the baked value matches the package's declared `version`.
4. The status bar shows the framework version beside the build chip, with the
   two identities distinguishable in the rendered output and in the tooltip.
5. The existing `sha` / `short` / `dirty` / `builtAt` / `repo` fields and the
   commit chip's link and behaviour are unchanged.
6. `yarn verify` green.

---

## Outcome

`frameworkVersion` is read from the framework package's own `package.json` via
`PACKAGE_DIR` and baked into `content.json`'s `build` object beside the vault
commit fields. The status bar renders it as its own `.sb-version` element,
outside the commit anchor: the version is not a property of that commit and has
nowhere to link to. Both tooltips now name what they describe ("WebVault 1.2.3"
/ "Content built from commit abcdef1") — the commit chip's previously said just
"Build abcdef1", which read as the version once a version sat next to it.

Verified in the situation the whole item exists for, which this repo's own
checkout cannot reproduce: a throwaway consumer with a `portal:` link to this
tree, `wv dev` run from its `.web`. The vault's commit (`dd428b7`, dirty) and
the framework version (`0.6.1`) came out as different values from different
sources, which is the point of criterion 4.

Both regressions were confirmed to be caught rather than merely covered:
pointing `PACKAGE_DIR` at `PROJECT_DIR` fails the build test, and removing the
indicator fails 3 of the 5 status-bar tests (the other 2 assert the degradation
and the commit link, which must hold either way).

Left as documented process, not machinery: the four places that name a version
(`package.json`, the tag, the `SETUP.md` pin, the `README.md` blob link) are
kept in sync by hand, per `AGENTS.md` (Cutting a release). Making that a
mechanical gate check needs a reason beyond the one drift at `v0.5.0`.

Coverage: 130 → 137 tests.

**Shipped:** 2026-08-06 · HEAD d8cb7c2 · ADR 0037 (r4, Proposed → Implemented)
