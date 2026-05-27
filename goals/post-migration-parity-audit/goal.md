# Goal — Post-migration parity audit (apps/web → apps/web-vite + apps/api)

## Goal

Exhaustively reconcile every legacy `apps/web` (Next.js 16) artifact from the pre-cutover commit `62a97d73^` against the current `apps/web-vite` (Vite + React SPA) and `apps/api` (Fastify) trees, produce a discovery report at `goals/post-migration-parity-audit/audit-report.md` listing every gap as a stable `GAP-<AREA>-<NNN>` row with severity (P0 / P1 / P2) and evidence, and inline-fix every P0 (auth break, payment / money flow break, data loss / tenant leak, regulatory webhook break) during the audit. The 2026-05-25 handover declared "full functional parity"; the spot-checks that triggered this goal already disproved that — the audit assumes nothing is parity-verified until proven and accounts for every legacy page, route handler, middleware behavior block, locale message key, Sentry scrub rule, and test file.

## Shared understanding

- **Facts:** see [`facts.md`](./facts.md) — the agreed list of testable outcomes (report deliverables, page parity, API route parity, middleware parity, i18n parity, observability parity, security parity, test coverage parity, P0 fix protocol, done condition).

## Execution plan

- **Plan:** see [`plan.md`](./plan.md) — branch + scratch-dir setup, baseline inventory extraction from `62a97d73^`, per-area sweep steps (pages → routes → middleware → i18n → observability → security → tests), the interleaved P0 inline-fix protocol, the final report assembly and verification, with the risks and open questions worth flagging up-front (cron callbacks moved off HTTP, messages-path redirection, server-action call-sites, Better Auth bridge sub-paths, locale-loader regex, test-run memory pressure).

## Done condition

`goals/post-migration-parity-audit/audit-report.md` exists with the severity rubric, a summary table, and per-area sections covering every legacy artifact — each row either ✓ ported (in the per-area appendix) or `GAP-<AREA>-<NNN>` with all required fields (legacy path, new path or `MISSING`, severity, evidence, status, remediation). Every P0 row has status `inline-fixed` (with the fix commit SHA on `audit/post-migration-parity`) or `open` with an explicit escalation note naming the blocker; no P0 sits open without escalation. `pnpm typecheck`, `pnpm --filter @contractor-ops/api-server test`, `pnpm --filter @contractor-ops/cron-worker test`, `pnpm --filter @contractor-ops/web-vite test` (path-scoped per the memory-pressure rule), and both `check:web-vite-data-layer` + `check:web-vite-page-shells` quality gates pass on the audit branch head. The user signs off on `audit-report.md` via `plannotator annotate ... --gate`.
