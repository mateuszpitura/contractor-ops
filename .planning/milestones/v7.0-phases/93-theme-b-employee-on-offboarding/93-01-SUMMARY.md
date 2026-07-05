# Plan 93-01 Summary — Wave 0 RED scaffolds

**Wave:** 1 · **Status:** complete (terminal-RED as designed)

## What shipped

Five failing (RED) test files pinning the observable behavior of every Phase 93 seam
before implementation:

| File | Pins | RED reason |
|------|------|------------|
| `packages/api/src/routers/workflow/__tests__/worker-start-run.test.ts` | EMP-OFF-02 worker `startWorkflowRun` helper (entityType EMPLOYEE, workerId, contractorId null; contractor regression) | `startWorkflowRun` not exported yet → `is not a function` |
| `packages/api/src/routers/integrations/__tests__/worker-deprovisioning.test.ts` | worker cooldown gate reads `terminatedAt`, blocks pre-cooldown, writes `{workerId, contractorId:null, assignmentId:null}`, `COUNTRY_TZ.US` | schema still mandates `assignmentId`; worker branch + `COUNTRY_TZ` export/US absent |
| `packages/api/src/services/__tests__/statutory-cert-pdf.test.ts` | cert immutable-snapshot + CAS double-render guard + `emp-cert/<orgId>/` key + `*Last4`-only | `../statutory-cert-pdf` module absent |
| `packages/api/src/services/__tests__/gov-stubs.test.ts` | 5 gov stubs return `{source:'STUB',available:false,note}`, PII last-2 mask, no network | stub modules absent |
| `packages/api/src/routers/__tests__/employee-lifecycle-cross-org.test.ts` | two-org IDOR isolation for StatutoryCertificate + per-market templates; org-scoped R2 key | `statutory-cert-pdf` module + `statutoryCertificate` prisma model absent |

## Verification

- `pnpm -F @contractor-ops/api test worker-start-run statutory-cert-pdf gov-stubs employee-lifecycle-cross-org worker-deprovisioning` → all RED for the documented (missing-implementation) reasons, collected by vitest (not skipped-empty).
- api tsconfig excludes `src/**/__tests__/**` → typecheck unaffected by the scaffolds.

## Notes

- worker-deprovisioning + employee-lifecycle-cross-org use the established `createCallerFactory(appRouter)` / `vi.hoisted` mock-prisma harness (mirrors `idp-deprovision-connections.test.ts`).
- statutory-cert-pdf mirrors the shipped Wave-0 sibling `form-1042s-pdf.test.ts` (structural db double + mocked R2).
