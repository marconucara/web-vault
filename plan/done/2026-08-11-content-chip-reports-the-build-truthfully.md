# The content chip reports the build truthfully

**Owning ADR(s):** `adr/0012-build-version-chip.md` (criteria 1-3),
`adr/0040-cloudflare-workers-deploy-substrate.md` (the substrate change that
stranded 0012's CI detection), `adr/0034-client-settings-modal.md` (criterion 3,
the date/time format preference this tooltip ignores)

## Context

The content chip in the status bar — the commit icon plus the short SHA, beside
the version indicator — is wrong in three separate ways on a real deployed
vault. All three are visible in one hover, which is how they were found
together, but they have nothing in common beyond the site they share.

**It claims uncommitted changes on a clean CI build.** A production deployment
built by Workers Builds renders `dce151c+` and a tooltip reading *Content built
from commit dce151c (uncommitted local changes)*. There are no local changes:
CI builds from a clean clone. The cause is in `scripts/build-content.mjs:187`:

```js
if (!process.env.CF_PAGES_COMMIT_SHA) {
  dirty = git(['status', '--porcelain']).length > 0;
}
```

The guard reads "am I not in CI?" — and it was correct when
`adr/0012-build-version-chip.md` was written, because the substrate was
Cloudflare **Pages**, which sets `CF_PAGES_COMMIT_SHA`.
`adr/0040-cloudflare-workers-deploy-substrate.md` moved the deploy to Workers,
which does not set that variable. The guard now passes in CI, `git status`
runs against the build clone, and the build's own generated artifacts — `.wv/`
among them — answer that the tree is dirty. The flag has been false for every
Workers build since 0040 shipped.

`scripts/generate-worker.mjs:48` shows the shape of the fix that this file never
received:

```js
const buildBranch = process.env.WORKERS_CI_BRANCH || process.env.CF_PAGES_BRANCH || 'main';
```

Workers first, Pages as the transitional fallback. The same treatment belongs in
`gitBuildInfo`, and it is worth stating the intent rather than the symptom:
`dirty` means *this build came from a working tree with uncommitted changes*,
which is a thing only a local build can be. Detecting "am I in CI" by enumerating
one vendor's variables is what broke; the more durable reading is that a build
is dirty only when `git status` says so **and** nothing identifies the build as
automated. Enumerating `WORKERS_CI_BRANCH`, `CF_PAGES_COMMIT_SHA`, and the
generic `CI` covers the substrate we have, the one we came from, and any hosted
runner we might move to.

Note the SHA itself is correct on Workers: `CF_PAGES_COMMIT_SHA` is empty, so it
falls through to `git rev-parse HEAD`, and the CI clone is checked out at the
built commit. Only the dirty flag is wrong. ADR 0012's criterion 2 names
`CF_PAGES_COMMIT_SHA` as the CI source, so the ADR text is stale too even where
the behaviour happens to be right.

**The timestamp is a raw ISO string.** `StatusBar.jsx:194` interpolates
`build.builtAt` — `2026-08-11T18:10:58.085Z` — straight into the tooltip.
The app has a formatting layer, `src/lib/formats.js`, driven by the date/time
preference from `adr/0034-client-settings-modal.md`; `numericDate` and
`clockTime` are exactly the two pieces this line needs, and `VersionIndicator`
already uses them for its own last-checked line
(`VersionIndicator.jsx:lastCheckedLabel`). The chip is the one place in the
status bar that bypasses the preference the user set.

`builtAt` is an ISO string, while `formats.js` takes epoch milliseconds and
returns `—` for a falsy input. It needs parsing at the call site, and an
unparseable or absent value must not render `Invalid Date` into a tooltip.

**The bubble wraps mid-word.** `.tt-multi` sets `white-space: pre-line`
(`src/styles.css:993`) so the `\n` in the catalogue string breaks the line. But
`pre-line` also drops the `nowrap` that `.tt::after` relies on, and with no
width of its own the bubble collapses toward its anchor's width — the chip is
narrow, so `uncommitted` breaks across lines. It needs `width: max-content` with
a `max-width` so it stays a bubble and still wraps on a genuinely long tip.

## Scope

**The dirty flag** — `scripts/build-content.mjs`, `gitBuildInfo`:

- Treat the build as automated when any of `WORKERS_CI_BRANCH` (current
  substrate), `CF_PAGES_COMMIT_SHA` (transitional Pages), or `CI` (generic
  hosted runner) is set, and skip the `git status` probe in that case.
- Keep the SHA resolution as it is — `CF_PAGES_COMMIT_SHA` then
  `git rev-parse HEAD` — since it is correct on both substrates.
- Comment the reason, naming 0040. The next substrate move should find the note
  rather than the symptom.

**The timestamp** — `src/components/StatusBar.jsx`:

- Format `build.builtAt` through `numericDate` + `clockTime` with the locale
  from `useFormatLocale()`, matching what `VersionIndicator` does.
- Parse the ISO string to epoch ms at the call site; render the tooltip without
  a timestamp segment rather than `Invalid Date` when it is missing or
  unparseable.
- The catalogue keys `statusBar.buildTip` / `statusBar.buildTipDirty` keep their
  `{{builtAt}}` placeholder — it receives a formatted string instead of an ISO
  one, so `en.json` and `it.json` need no new keys.

**The bubble** — `src/styles.css`, `.tt-multi`:

- `width: max-content` plus a `max-width` (the version panel's own width is the
  reference for what looks right in this corner), keeping `pre-line`.
- Check the other `.tt-multi` sites, if any, do not regress.

**ADR 0012 is amended, not superseded.** The capability is unchanged: a chip
showing the commit with a tooltip. What changed underneath is the substrate, so
criterion 2's `CF_PAGES_COMMIT_SHA` wording is corrected to name the Workers
variables, and a criterion is added for the timestamp honouring the format
preference. Substantive, so a Revision History row and an Approvals update.

## Out of scope

- The version indicator beside it. Its own bugs are items `0001` and `0002`.
- Any change to what the chip links to, or to the `+` marker's visual design —
  the marker is right, it was being fed a wrong flag.
- Showing the build timestamp anywhere other than this tooltip.
- Reworking `formats.js`. It has what this needs.
- Making `dirty` meaningful for CI in some other sense (e.g. detecting a build
  from a modified checkout). A CI build is defined as clean here.

## Exit criteria

1. A build with `WORKERS_CI_BRANCH` set reports `dirty: false` regardless of
   what `git status` says in the build directory. *(0012 AC1, AC2)*
2. A build with `CF_PAGES_COMMIT_SHA` set, or with `CI` set and neither of the
   others, likewise reports `dirty: false`.
3. A local build with uncommitted changes and none of those variables set still
   reports `dirty: true` and still renders the `+`. The local affordance is
   unchanged. *(0012 AC2)*
4. A local build on a clean tree reports `dirty: false`.
5. The chip tooltip renders the build time in the format selected in
   preferences, in the same form the rest of the app uses — no ISO string.
   *(0034 AC3)*
6. A missing or unparseable `builtAt` renders a tooltip without a time, never
   `Invalid Date` and never the literal placeholder.
7. The two-line tooltip renders as a bubble sized to its content, with the line
   break where the catalogue puts it and no mid-word breaking, at a narrow
   window as well as a wide one, in both themes.
8. `adr/0012-build-version-chip.md` names the Workers-era detection and the
   format-preference requirement, with a Revision History row and Approvals
   updated.
9. Unit coverage for the flag: the CI variables suppress the probe, the local
   dirty tree does not. Unit coverage for the tooltip: formatted time present,
   absent `builtAt` degrades cleanly.
10. `yarn verify` green.
11. Verified by hand before the change is committed — the tooltip in the running
    app, and the flag by building with and without the CI variables set.

## Dependencies

None. Independent of items `0001` and `0002`, which touch the version indicator
next to this chip but not this element.

---

**Shipped:** 819b663 — `fix(build): report the build truthfully on the content
chip`. `adr/0012-build-version-chip.md` stays Implemented (the capability did
not change; AC2/AC3 corrected and AC5 added at r2), so `INDEX.md` needs no
regeneration. The dirty-flag fix cannot be observed locally — a local build is
genuinely dirty — and is verified by `scripts/build-dirty-flag.test.mjs`, which
was itself checked by restoring the old guard and watching the two hosted cases
fail. Confirmation in production arrives with the next CI deploy.
