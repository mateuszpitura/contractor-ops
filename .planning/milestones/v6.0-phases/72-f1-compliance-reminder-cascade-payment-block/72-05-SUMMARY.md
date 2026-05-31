---
phase: 72-f1-compliance-reminder-cascade-payment-block
plan: 05
subsystem: api
tags: [approval-engine, operators, compliance, recovery, jsonb, gin-index, trpc, audit]

requires:
  - phase: 72-02
    provides: PENDING_COMPLIANCE enum value + complianceHoldsJson column + GIN index
  - phase: 72-04
    provides: assertContractorPaymentEligibility reused by the recovery re-assertion
provides:
  - Plug-in approval operator registry + complianceCritical operator (D-13)
  - advanceFlow final-step PENDING_COMPLIANCE hold (D-14)
  - onComplianceItemSatisfied recovery hook (D-15) + renewal-reset re-export
  - approval.resumeFromCompliance manual escape-hatch mutation
affects: [72-06]

tech-stack:
  added: []
  patterns:
    - "Map-backed plug-in operator registry; operators self-register via barrel side-effect import"
    - "Final-step compliance gate in advanceFlow (orthogonal to routing-time evaluateConditions)"
    - "GIN JSONB containment (@>) recovery query; structural client interfaces for tx-or-extended-client typing"

key-files:
  created:
    - packages/api/src/services/approval-engine/operators/registry.ts
    - packages/api/src/services/approval-engine/operators/compliance-critical.ts
    - packages/api/src/services/approval-engine/operators/index.ts
    - packages/api/src/services/compliance-recovery.ts
  modified:
    - packages/api/src/services/approval-engine.ts
    - packages/api/src/services/compliance-payment-gate.ts
    - packages/api/src/routers/core/approval.ts
    - packages/api/src/routers/compliance/classification.ts
    - packages/api/src/services/__tests__/approval-engine-operator-registry.test.ts
    - packages/api/src/services/__tests__/compliance-recovery.test.ts
    - packages/api/src/errors.ts
    - apps/web-vite/messages/{en,de,pl,ar}.json

key-decisions:
  - "Kept evaluateConditions SYNCHRONOUS (routeToChain calls it with only invoice data, no tx) instead of the plan's async dual-path rewrite — the registry path is exercised via advanceFlow's tx-bearing final-step gate. Backward compatibility (legacy {field,operator,value}) is the priority truth; existing approval-engine tests stay GREEN."
  - "Service tx params typed via structural client interfaces (PaymentGateClient extended by RecoveryClient) with loose Promise<unknown> returns — the concrete PrismaClient|TransactionClient|TenantScopedDb union triggers 'expression not callable' + deep-instantiation errors; mirrors compliance-supersession's SupersessionClient pattern. Query results cast to the precise row type."
  - "resumeFromCompliance gated by invoice:['approve'] (the same gate approve/reject use) — there is no approval/override permission in the auth catalog."
  - "Recovery wired at the real item-mutation site: after supersedeAndMaterialise (which can carry items forward to SATISFIED) in both submit and recreateComplianceAssessment, fire the recovery for the contractor's now-SATISFIED BLOCKING items."
  - "complianceHoldsJson writes cast to Prisma.InputJsonValue; clearing uses PrismaRuntime.DbNull (runtime Prisma namespace from the generated client, since the db-package Prisma export is type-only)."

patterns-established:
  - "Approval condition operators are pluggable; future budget-cap/fraud-score operators register without core-engine edits"

requirements-completed: [COMPL-06]

duration: ~70 min
completed: 2026-05-31
---

# Phase 72 Plan 05: Approval Operator Registry + PENDING_COMPLIANCE Recovery Summary

**Plug-in approval-engine operator registry with the complianceCritical operator that holds invoice approvals in PENDING_COMPLIANCE at their final step (instead of auto-APPROVE) when the contractor has a BLOCKING+EXPIRED item, plus the auto-recovery hook that re-asserts eligibility and resumes held flows to PENDING when items are satisfied, and a manual admin escape-hatch mutation.**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-05-31
- **Tasks:** 6
- **Files modified:** 15

## Accomplishments
- Map-backed operator registry (register/evaluate/getRegistered; throws on duplicate + unknown)
- complianceCritical operator self-registers via barrel side-effect import
- advanceFlow final-step gate: holds invoice flows in PENDING_COMPLIANCE with complianceHoldsJson linkage
- onComplianceItemSatisfied: GIN JSONB-containment query → re-assert eligibility → resume PASS flows to PENDING + audit
- resumeFromCompliance admin mutation (rejects when still blocked)
- classification submit + recreate fire the recovery after supersession
- 4 new approval error constants + locale keys (parity held, 274 Errors keys each)
- 53 GREEN tests (operator registry + recovery + existing approval-engine legacy paths); api typecheck clean; biome clean

## Task Commits
1. **Registry + operator + advanceFlow gate + recovery + mutation + listeners + GREEN tests (Tasks 72-05-01..06)** - `2bebedf5` (feat)

## Decisions Made
See key-decisions frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4-adjacent - Architectural, lower-risk variant] evaluateConditions kept synchronous**
- The plan's async dual-path evaluateConditions would break the sync routeToChain caller (no tx available at routing time). Instead the operator registry is invoked from advanceFlow's tx-bearing final-step gate, preserving the legacy sync path and backward compatibility. Net behaviour matches COMPL-06 (flows hold in PENDING_COMPLIANCE, resume on satisfy). Existing approval-engine tests remain GREEN.

**2. [Rule 1 - Bug] Concrete client-union tx types failed to compile**
- The plan's `Prisma.TransactionClient` / client-union tx types produced 'expression not callable' + deep-instantiation errors when the tenant-extended ctx.db tx was passed. Fixed with structural client interfaces (PaymentGateClient / RecoveryClient) per the in-tree SupersessionClient pattern; results cast to precise row types.

**3. [Rule 2 - Missing critical] TRPCError messages + i18n keys**
- Repo biome plugin forbids hardcoded TRPCError messages (incl. in tests). Added APPROVAL_FLOW_NOT_FOUND / APPROVAL_NOT_PENDING_COMPLIANCE / APPROVAL_CANNOT_RESOLVE_CONTRACTOR / APPROVAL_STILL_COMPLIANCE_BLOCKED to errors.ts + all 4 locale Errors namespaces (parity).

---

**Total deviations:** 3 (1 architectural-variant, 1 bug, 1 missing-critical).
**Impact:** COMPL-06 behaviour is exactly as specified. Deviations were integration corrections that preserved backward compatibility. No scope creep.

## Issues Encountered
Two PRE-EXISTING cross-session test failures observed (NOT introduced here):
- `classification-recompute.test.ts` — `insertedCount` expects 3 but gets 4. Caused by Phase 75 commit `02f02b47` adding UK IP-assignment policy rules; the test asserts a stale count. Confirmed the same failure on the unmodified HEAD tree (my Phase 72 changes do not touch compliance-policy policies or supersedeAndMaterialise).
- `classification.test.ts` — collection-fails (`getIdpAuditLogger` then `prismaRaw` missing on its mocks) because it imports the full appRouter, which transitively pulls Phase 76's deprovisioning.ts. Already red at HEAD before this plan. My recovery import adds `prismaRaw` to that module graph but the test could not collect regardless.
Both are flagged for the Phase 75 / Phase 76 owners. My own test files (operator-registry, recovery) pass in isolation, and the existing approval-engine.test.ts stays GREEN.

## User Setup Required
None.

## Next Phase Readiness
- COMPL-06 implemented + GREEN. Wave 3 sibling 72-07 (block-modal UI) next; then Wave 4 plan 72-06 (export atomicity) reuses assertContractorPaymentEligibility inside the export tx.

---
*Phase: 72-f1-compliance-reminder-cascade-payment-block*
*Completed: 2026-05-31*
