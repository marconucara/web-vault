# Agent-driven setup from a spec file

Owning ADR: `adr/0029-cli-setup-and-distribution.md`.

Scope: install web-vault into an existing vault, agent-driven from a spec file —
no wizard, no interactive `npx`. Flow: point at a vault, add the dependency, write
the minimal config.

Exit criteria: a documented setup spec an agent can follow end-to-end.

Shipped in v0.2.0: SETUP.md is the agent-driven onboarding spec (any vault),
no-toolchain scaffolding; verified end-to-end on marconucaravault.
