# Let the build's install update the shell lockfile

**Owning ADR(s):** `adr/0039-adopter-upgrade-path.md`
**Dependencies:** none

## Context

The one-click upgrade commits a new `web-vault` pin to `.web/package.json` and
stops there, which is the correct write scope (`0039` AC3/AC4). What it cannot
do is update `.web/yarn.lock`, which is versioned in the adopter's repo and
names the *old* pin — both as the workspace dependency and as a resolved entry
carrying a `resolution: ...#commit=<sha>` and a `checksum`.

The deploy substrate installs with Yarn's immutable mode, which CI enables by
default. So the rebuild the upgrade triggers fails at the install step, before
`wv build` runs at all:

```
➤ YN0028: │ -    web-vault: "github:marconucara/web-vault#v0.8.3"
➤ YN0028: │ +    web-vault: "github:marconucara/web-vault#v0.8.4"
➤ YN0028: │ The lockfile would have been modified by this install, which is
           explicitly forbidden.
Failed: error occurred while installing tools or dependencies
```

The adopter is left with the pin committed and the site not rebuilt — the
"upgrade is building" state of AC7 never resolves — and the only way out is a
manual `yarn install` and commit in their vault. That has now happened twice.

Regenerating the lockfile from the endpoint is not a real option: a new
framework version can add, drop or move transitive dependencies, so a targeted
rewrite of the `web-vault` entry is right only in the case where nothing else
changed. The `checksum` compounds it — Yarn recomputes it by packing the git
source, so it cannot be synthesised without performing an install. Only a real
install can produce a correct lockfile, and the build already performs one.

Immutable installs exist to catch a `package.json` edited without regenerating
the lock. Here that guard has little to catch and a demonstrated cost: the shell
has exactly **one** direct dependency, pinned to an immutable git tag, and its
only programmatic writer is the upgrade endpoint, which changes that one field.

## Scope

Drop the immutable-install requirement in the adopter shell, so the build's
install updates the lockfile in place instead of refusing to run.

- Add `enableImmutableInstalls: false` to the scaffolded `.web/.yarnrc.yml` in
  `SETUP.md`, with a comment saying why, so every shell gets it by default.
- Keep `.web/yarn.lock` versioned. It still pins the whole transitive tree; only
  the `web-vault` entry goes stale between an upgrade and the adopter's next
  local `yarn install`.

The setting lands in the shell, which the upgrade endpoint does not write — so
a shell scaffolded before this ships takes the line by hand, once.

## Out of scope

- Committing the regenerated lockfile back from the build. It would keep the
  lock exactly fresh, but it makes the deployment write to the repo unprompted
  and re-trigger itself, and it is not needed to unblock the upgrade. Revisit
  only if lockfile drift proves to cost something.
- This repo's own `yarn.lock` and the `yarn verify` gate, which stay immutable —
  they are developer-facing and have many direct dependencies.
- Widening the upgrade endpoint's write scope (`0039` AC3/AC4 stand).

## Exit criteria

1. An upgrade accepted from the notice on an adopter deployment rebuilds
   successfully: the install updates the lockfile rather than failing with
   `YN0028`, and the new version goes live without manual intervention in the
   vault repo.
2. `SETUP.md` scaffolds `.web/.yarnrc.yml` with `enableImmutableInstalls: false`
   and states why.
3. `.web/yarn.lock` remains versioned and still resolves the transitive tree.
4. `yarn verify` green.

---

Shipped in `2bab00e`, released as `v0.9.0`. Minor rather than patch: the shell
config gains a required line, so this is a breaking adopter-facing change under
`adr/0037-*.md`.

Exit criterion 1 is the one that cannot be verified from this repo — it needs a
real upgrade on a deployed vault, whose shell must first take the new
`.yarnrc.yml` line by hand (the upgrade endpoint writes only the pin, so nothing
else can put it there). Confirmed on the first upgrade away from `v0.9.0`.
