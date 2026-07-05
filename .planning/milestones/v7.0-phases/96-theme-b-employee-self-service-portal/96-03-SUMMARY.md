---
phase: 96-theme-b-employee-self-service-portal
plan: 03
subsystem: api
tags: [portal, employee-portal, idor, tdd, red-net, security, tests]
requirements: [EMP-PORTAL-01, EMP-PORTAL-02, EMP-PORTAL-03]
dependency_graph:
  requires:
    - phase: 96-02
      provides: "portalEmployeeProcedure / portalManagerProcedure + discriminated validatePortalSession"
  provides:
    - "The security RED net: two-employee IDOR fence, manager reporting-line IDOR + approve, time-off session-scoping, akta section-allowlist, pay-stub-unavailable, per-request flag gating — all RED via missing routers"
    - "portal-fixtures.ts: a two-employee (peer) + manager (one report) + two-org fixture with a where-honouring mock prisma so IDOR scoping is a real assertion"
  affects:
    - "96-04 (flips portal-employee-idor / portal-timeoff-request / portal-root-gating GREEN)"
    - "96-05 (flips portal-akta-selfview / portal-paystub-unavailable GREEN)"
    - "96-06 (flips portal-manager-idor / portal-manager-approve GREEN)"
tech_stack:
  patterns:
    - "where-honouring mock prisma (Proxy over fixture arrays) so a read scoped to one workerId returns only that worker's rows — the IDOR fence is a real mock-based assertion, not a stub"
    - "hoisted-holder module mocks (db/session/flags/audit read a beforeEach-injected holder) — no imports referenced inside vi.mock factories, so vitest hoisting is safe"
    - "the tRPC caller resolves a not-yet-built namespace to a 'No procedure found on path' TRPCError — a clean RED that carries no tsc break (packages/api excludes src/**/__tests__/**)"
key_files:
  created:
    - "packages/api/src/routers/portal/__tests__/portal-fixtures.ts"
    - "packages/api/src/routers/portal/__tests__/portal-employee-idor.test.ts"
    - "packages/api/src/routers/portal/__tests__/portal-manager-idor.test.ts"
    - "packages/api/src/routers/portal/__tests__/portal-manager-approve.test.ts"
    - "packages/api/src/routers/portal/__tests__/portal-timeoff-request.test.ts"
    - "packages/api/src/routers/portal/__tests__/portal-akta-selfview.test.ts"
    - "packages/api/src/routers/portal/__tests__/portal-paystub-unavailable.test.ts"
    - "packages/api/src/routers/portal/__tests__/portal-root-gating.test.ts"
decisions:
  - "The net is mock-based (portal tests mock @contractor-ops/db; no live DB). IDOR is asserted by a where-honouring mock prisma: a query for worker A's rows returns ONLY A's rows, so an unscoped router would fail the fence. The DB one-of CHECK is out of scope here (asserted in 96-02 via a rejecting create mock)."
  - "Added portal-manager-approve.test.ts beyond the plan's declared file list — 96-06's verify command greps for `portal-manager-approve`, so the approval-reuse + audit RED lives in its own file alongside portal-manager-idor."
  - "The gating suite exercises the per-request flag re-assertion (layer 2: flag ON at import so the namespace mounts, then flipped OFF per request → FORBIDDEN). The boot-time dark-mount (layer 1: METHOD_NOT_FOUND when unregistered) is the conditional-registration pattern, not unit-testable post-import."
requirements_completed: []
completed: 2026-07-05
---

# Phase 96 Plan 03: The employee-portal security RED net

**Seeded the failing security-first net the router waves must flip GREEN: the load-bearing two-employee IDOR fence (an employee sees ONLY its own records), the manager reporting-line fence (a manager touches ONLY direct reports), time-off session-scoping, the akta section-allowlist, pay-stub-unavailable, and per-request flag gating — every case RED via a not-yet-built router, none bricking `tsc`.**

## Accomplishments

- **Two-employee IDOR fence** (`portal-employee-idor.test.ts`) — employee A reads only A's leave requests / time / balance; a client-supplied `workerId` is rejected; a cross-org (org C) session reads only its own org, never A's rows. RED via `No procedure found on path "portalEmployee,…"`.
- **Manager reporting-line fence** (`portal-manager-idor.test.ts` + `portal-manager-approve.test.ts`) — manager M lists/approves for its one report (A), never a peer (B) or a cross-org worker (X); a non-manager (B) has no `portalManager` surface; approve/reject go through the shared transition + `writeAuditLog` (EMPLOYEE actor). RED.
- **Time-off from portal** (`portal-timeoff-request.test.ts`) — `submitTimeOffRequest` has NO `workerId` input, derives the subject from the session, creates the request + an EMPLOYEE audit row; a smuggled `workerId` is a `.strict()` rejection. RED.
- **Akta self-view + pay-stub** (`portal-akta-selfview.test.ts`, `portal-paystub-unavailable.test.ts`) — `getMyAkta` returns the caller's SECTION_A doc but never the SECTION_C doc (allowlist); `getPayStubAvailability` returns `{ available:false, reason:'EXTERNAL_PAYROLL' }`. RED.
- **Flag gating** (`portal-root-gating.test.ts`) — flag ON → the procedure is reachable; flag OFF → the procedure throws FORBIDDEN (per-request re-assert). RED (a missing procedure yields NOT_FOUND, not the expected FORBIDDEN).
- **Shared fixture** (`portal-fixtures.ts`) — org A with employee A (managed by M), peer B (not managed by M), manager M (manages exactly A); org C with employee X. Each seeded with a leave request/balance, a personnel file with a SECTION_A + SECTION_C document, a time entry, and a token → EMPLOYEE-session resolver. A `where`-honouring mock prisma makes the IDOR scope a real assertion.

## Verification

- `pnpm --filter @contractor-ops/api test <the 7 portal RED files>` — 16 failed / 8 passed (24). The 16 are the load-bearing positive/gating assertions, RED via missing routers; the 8 passing are the negative guards (a bad-input / cross-subject call rejects both now and in GREEN).
- `pnpm typecheck --filter=@contractor-ops/api` — 0 errors (the `src/**/__tests__/**` exclusion holds; the RED scaffolds do not brick the package typecheck).
- `pnpm exec biome check` on the 8 new files — clean (no errors, no warnings).
- `pnpm lint:no-breadcrumbs` — my 8 files are clean (no phase/plan/wave/req IDs in comments). The ~47 remaining violations are pre-existing other-stream files, untouched.
- No wiki change (test-only files are doc-exempt).

## Notes / deviations

- **Worktree was stale (docs-91) and fast-forwarded to `main` (e1376fd62, contains 96-01 + 96-02).** The worktree branch was a clean ancestor of main with an empty tree, so `git merge --ff-only main` was non-destructive. Then `pnpm install`, `pnpm --filter @contractor-ops/db build`, and a root `.env` symlink restored the environment (same setup 96-01 documented).
- **`portal-manager-approve.test.ts` added** beyond the plan's declared file list to satisfy 96-06's `test portal-manager-idor portal-manager-approve` verify command.
- **Two generated files drifted during `pnpm install`** (`packages/validators/src/legal/de.{d.ts,js}`) via the postinstall build; they are not part of this plan and were left unstaged.
