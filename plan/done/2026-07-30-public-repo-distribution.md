# Distribution as a public git dependency

Owning ADR: `adr/0029-cli-setup-and-distribution.md`.

Scope: distribute web-vault as a git dependency from a public GitHub repository
(no npm publish for now); keep npm/other hosts open as a later option.

Exit criteria: package installable from its public repo, documented in the setup.
Depends on `plan/todo/0001-agent-driven-setup.md`.

Shipped in v0.2.0: installable as a git dependency from the public repo
(github:marconucara/web-vault#v0.2.0), documented in README + SETUP.md.
