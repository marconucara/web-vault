# Starter template returns to a separate repository

Owning ADR: `adr/0035-cloudflare-template-onboarding.md`.

## Context

The template was moved into this repository at `templates/base/` on the
assumption that the "Deploy to Cloudflare" button could target a subfolder via
`?url=.../tree/main/templates/base`. The button's UI does show the subfolder,
but the flow then fails with a generic monorepo error before reaching the
configuration screen, because there is no `wrangler.toml` at the root of the
pointed folder. Our shell lives in `.web/`, so there never is one — and the
**Path** setting that would point at `.web/` is only reachable *after* the step
that fails. The same folder as the root of its own repository does work, even
though it likewise has no root-level `wrangler.toml`.

## Scope

Restore the standalone `marconucara/web-vault-template` repository as the
one-click entry point, and delete `templates/base/` from this repository. Record
in ADR 0035 both the decision and the two principles that should have guided it
from the start: the vault structure is not reshaped to satisfy the one-click
deploy, and the template must be identical to a real vault.

## Work

- `web-vault-template`: revert the "retire" README commit; verify the tree
  matches the copy last shipped from `templates/base/`; rebuild artefacts.
- `web-vault`: delete `templates/`, repoint `README.md` at the template
  repository, update ADR 0035 (open questions → decision, two new acceptance
  criteria, revision history), regenerate `INDEX.md`.

## Exit criteria

- `templates/` no longer exists in this repository and nothing references it.
- `README.md` links the template repository, not a subfolder of this one.
- ADR 0035 states the separate-repo decision with its cause, and carries the two
  new acceptance criteria.
- A live button test from the template repository root reaches the
  configuration screen (the step that failed with the subfolder).
