# Goal — QA Full Surface Audit

Act as QA engineer over the contractor-ops product (web-vite staff SPA, external portal, tRPC staff+portal API, public-api, cron-worker). Produce a comprehensive **test matrix doc** covering every integration and outgoing surface, input/form/modal/wizard, feature flag, upload, auth/authorization/role, and notification — then implement an **automated test suite** that fills the highest-risk gaps, ordered security/auth/IDOR → money/data integrity → integration correctness → input/UX. All external HTTP is mocked; no live calls.

## Shared understanding

See [`facts.md`](./facts.md) — ~90 testable, verified-and-approved facts (the QA targets) grouped by risk priority.

## Execution plan

See [`plan.md`](./plan.md) — approved. Baseline → matrix doc → 4 risk-tiered suite steps → close-out, with concrete scoped verify commands and flagged risks (test debt, RLS-not-DB-enforced, mock-only blind spot, web-vite RAM, manual-only facts).

## Done condition

- `test-matrix.md` exists and is gated: every `facts.md` fact maps to ≥1 surface row; every inventory surface (24 forms, 52 dialogs, 4 wizards, 12 uploads, 45 flags, 9 roles, 60+ namespaces, 18 adapters, 8 webhook providers, 10 jobs) appears; each row marked `auto` / `manual` / `mock-only`.
- Tier 1–4 automated tests are written and pass under scoped `pnpm --filter` runs, extending (not duplicating) the 6 baseline `*.security.test.ts`.
- New tests are test-only (wiki-exempt); any product-code fix carries its wiki update + `pnpm check:wiki-brain` in the same change set.
- Remaining failures are either fixed or quarantined-and-documented as a findings list; no new red is attributable to this work beyond the established Step-0 baseline.
