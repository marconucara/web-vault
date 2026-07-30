# Agent Worklog

Append one row per commit. Newest at the bottom.

| Date | Commit | Branch | Item | Notes |
|------|--------|--------|------|-------|
| 2026-07-29 | v0.1.0 | main | bootstrap + backfill | Initial import: web-vault framework package + docflow catalogue (ADRs 0001–0029, all Implemented except 0029 Accepted). Signed, tagged v0.1.0. Distribution validated: installs as a git dependency and the reference consumer builds green on Cloudflare (preview + production). |
| 2026-07-30 | v0.2.0 | main | ADR 0029 (0001+0002) | Shipped agent-driven onboarding (SETUP.md), user-facing README, single-source DEPLOY.md; product name WebVault; AGPL-3.0. Build now generates `dist/_headers` (ADR 0026 r2, consumer-overridable) instead of scaffolding it. ADR 0029 → Implemented; plan 0001/0002 → done. Squash+ff to main, tagged v0.2.0. Onboarding UX validated on a clean vault. |
| 2026-07-30 | v0.3.0 | main | dev editor interop fix | Fixed `wv dev` blanking on plain-CJS transitive deps (style-to-js via react-markdown; use-sync-external-store via zustand/BlockNote): pre-bundle the affected libraries in Vite `optimizeDeps.include`. Dev-only; Rollup build unaffected. Verified in-browser on a real install. See `plan/done/2026-07-30-dev-editor-cjs-interop.md`. |
