# Goal — FE↔BE Integration Audit

Audit every frontend action in `apps/web` (dashboard + portal), `apps/public-api`, and `apps/landing` for correct integration with the tRPC backend in `packages/api`: success/failure toasts, query invalidation, loading/disabled states, destructive-action confirmations, and orphan backend procedures with no FE consumer. Produce a severity-classified audit report, then apply fixes for every detected gap in atomic commits.

## Shared understanding

See [facts.md](./facts.md) — full set of testable outcomes the goal must produce.

## Execution plan

See [plan.md](./plan.md) — 9-step ordered execution with file touches, verification commands, and known risks.

## Done condition

- `goals/fe-be-integration-audit/AUDIT.md` exists and covers 100% of routers + 100% of mutation call sites in scope.
- All HIGH and MED findings have a corresponding fix commit.
- LOW findings are either fixed or explicitly deferred with rationale in the report.
- `pnpm run typecheck` passes at root.
- `pnpm run lint` passes at root.
