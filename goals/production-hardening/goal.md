# Production Hardening

Drive the app from "audit-closed, launch-ready" to production-grade by (1) reconciling existing audit docs against the current code so the open backlog is honest, (2) shipping every procedural fix that needs no design discussion — FE↔BE mutation hygiene, audit-log helper enforcement, resilience helper rollout, idempotency unification, advisory-lock shim cleanup, requestId propagation, webhook silent-catch fixes, plus pre-push lint guards to prevent regressions — and (3) adding hardening that touches infrastructure boundaries: nonce-based CSP, full security-header set, Dependabot, axe-core a11y gate, error/loading/not-found boundary coverage, bundle budgets + Web Vitals, explicit cache-control, hot-path tenant cache routing, plus a written infra-recommendations doc covering worker scaling, OTel, replica rollout, SLOs.

## Artifacts

- **Shared understanding:** [`facts.md`](./facts.md) — every verifiable outcome across Phase A (reconciliation), Phase B (procedural fixes), Phase C (hardening adds), Phase D (infra-recommendation doc).
- **Execution plan:** [`plan.md`](./plan.md) — branch model, ordered atomic commits per phase, per-step verification, risk notes, and the two out-of-band gates (B.5 env confirmation, C.1.c 48h CSP observation).

## Scope

- Single branch `feat/production-hardening` cut from current `main` HEAD; the in-flight typed-i18n working-tree changes are not touched.
- Atomic commits, conventional-commits style, one fix per commit.
- No `render.yaml` edits, no DB migrations, no dependency version bumps (Dependabot config only). All infra changes are recommendations in Phase D.
- Tier-2 audit items (read-replica routing rollout, RLS `CREATE POLICY` migration, full circuit-breaker rollout to remaining raw-fetch sites) stay deferred; they are scoped into Phase D's follow-up list.

## Done condition

- All facts in `facts.md` Phase A, B, and C are satisfied, with each fact tied to a commit on `feat/production-hardening`.
- CI is green on the branch (lint, typecheck, build, tests, plus the new lint guards and axe-core gate).
- Phase D doc (`docs/INFRA-RECOMMENDATIONS.md`) is committed and the maintainer has either accepted, rejected, or queued each recommendation. No infra commits ship as part of this goal.
- The two gated steps (B.5 advisory-lock cleanup, C.1.c CSP enforce flip) have either landed after their out-of-band prerequisite was met, or are explicitly deferred to a named follow-up PR with the deferral recorded in `docs/PRODUCTION-CHECKLIST.md`.
- `docs/PRODUCTION-CHECKLIST.md` Summary table reflects the post-goal state with no `[ ]` row missing an evidence pointer.

---

Done! Launch a goal with `/goal goals/production-hardening/goal.md`
