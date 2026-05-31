---
phase: 72-f1-compliance-reminder-cascade-payment-block
plan: 04
subsystem: api
tags: [payments, compliance, feature-flags, lint-guards, trpc, audit, i18n]

requires:
  - phase: 72-02
    provides: ContractorComplianceItem severity/status the helper queries
provides:
  - assertContractorPaymentEligibility single payment-block guard (COMPL-05)
  - payment.create hard-gate wiring
  - isPaymentBlockEnforced flag resolver in feature-flags
  - payment-gate-guard CI lint guard (helper-coverage at payment-write entry points)
  - COMPLIANCE_PAYMENT_BLOCKED error constant + Errors.compliancePaymentBlocked in 4 locales
affects: [72-06, 72-07]

tech-stack:
  added: []
  patterns:
    - "Single canonical payment-block guard called from every payment-write entry point; CI lint guard enforces presence"
    - "Flag-OFF would-block soft-warn path: WARN log + best-effort AuditLog, never throws"
    - "Procedure-extraction lint guard matches at router-object indentation (brace-depth 1 inside router({...}))"

key-files:
  created:
    - packages/api/src/services/compliance-payment-gate.ts
    - packages/lint-guards/src/payment-gate-guard/run-guard.ts
    - packages/lint-guards/src/payment-gate-guard/format-offence.ts
    - packages/lint-guards/src/__fixtures__/payment-router-missing-gate.ts
  modified:
    - packages/api/src/services/__tests__/compliance-payment-gate.test.ts
    - packages/api/src/routers/finance/payment.ts
    - packages/api/src/errors.ts
    - packages/feature-flags/src/registry.ts
    - packages/feature-flags/src/index.ts
    - packages/lint-guards/src/index.ts
    - packages/lint-guards/src/__tests__/payment-gate-guard.test.ts
    - apps/web-vite/messages/{en,de,pl,ar}.json

key-decisions:
  - "TRPCError message routed through packages/api/src/errors.ts (COMPLIANCE_PAYMENT_BLOCKED) — the repo biome plugin forbids hardcoded TRPCError messages (goals/i18n-system-messages). Added the matching Errors.compliancePaymentBlocked key to all 4 locales to keep i18n parity."
  - "Lint-guard procedure extraction matches at the router-object indentation (procedures live at brace-depth 1 inside `router({...})`), not depth 0 — the plan's depth===0 gate extracted zero procedures (false-negative). Verified against both a fixture and the real router."
  - "Generated i18n types (apps/web-vite/src/generated/i18n/*) are gitignored build artifacts — regenerated to confirm the new key flows through, not committed."
  - "isPaymentBlockEnforced returns false in production until Plan 72-08 registers the PENDING entry; FLAG_SIGNOFF_BYPASS=local forces ON in dev."

patterns-established:
  - "Twin-write enforcement: a new payment-write entry point must update both the procedure AND PAYMENT_WRITE_PROCEDURES, or the CI guard fails"

requirements-completed: [COMPL-05]

duration: ~45 min
completed: 2026-05-31
---

# Phase 72 Plan 04: Payment-Block Helper + CI Lint Guard Summary

**`assertContractorPaymentEligibility` — the single canonical payment-block guard (throws PRECONDITION_FAILED with the D-10 cause shape when a contractor has a BLOCKING+EXPIRED compliance item, or takes the flag-OFF would-block soft-warn path), wired into `payment.create` and enforced across all payment-write entry points by the new `payment-gate-guard` CI lint guard.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-05-31
- **Tasks:** 5
- **Files modified:** 15

## Accomplishments
- `compliance-payment-gate.ts` — helper returning `{ blocked, wouldBlock, contractorReasons }`; flag ON throws, flag OFF warns + audits
- `payment.create` wired to assert eligibility on the invoices' distinct contractors before the run-creation transaction
- `isPaymentBlockEnforced()` flag resolver in feature-flags (FLAG_SIGNOFF_BYPASS=local override) + barrel re-export
- `payment-gate-guard` (run-guard + format-offence + barrel + fixture) — reports payment-write procedures missing the helper
- `COMPLIANCE_PAYMENT_BLOCKED` error constant + `Errors.compliancePaymentBlocked` in en/de/pl/ar (parity held at 270 Errors keys each)
- 8 GREEN gate tests + 3 GREEN guard tests; api/feature-flags/lint-guards typecheck clean; biome clean

## Task Commits
1. **Helper + flag resolver + payment.create wiring + lint guard + error constant + i18n + GREEN tests (Tasks 72-04-01..05)** - `69e3f3fa` (feat)

## Decisions Made
See key-decisions frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lint-guard extracted zero procedures (depth===0 gate)**
- Found during: Task 72-04-04. The plan's `extractProcedures` gated on `depth === 0`, but router procedures live inside `router({...})` at brace-depth 1 — the gate matched nothing, so the guard never reported offences (false-negative confirmed against fixture + real router).
- Fix: drop the depth gate; start a new block on each `<name>: <procedureBuilder>` match at router-object indentation.
- Verification: fixture reports `payment.create` (missing helper) and not `payment.lockAndExport` (has it); real router reports only `payment.lockAndExport` (wired in 72-06).
- Committed in: `69e3f3fa`.

**2. [Rule 2 - Missing critical] Hardcoded TRPCError message rejected by repo biome plugin**
- Found during: Task 72-04-01. Repo plugin forbids hardcoded TRPCError messages (i18n-system-messages goal).
- Fix: added `COMPLIANCE_PAYMENT_BLOCKED` to `packages/api/src/errors.ts` and `Errors.compliancePaymentBlocked` to all 4 locale catalogs (i18n parity preserved). Regenerated the gitignored i18n types to confirm the key flows through.
- Committed in: `69e3f3fa`.

**3. [Rule 1 - Bug] Plan code used unavailable imports/permission**
- Found during: Task 72-04-01. The plan's `type Prisma`/`PrismaClient` value-import and a derived TxClient simplified to `Prisma.TransactionClient`; no `compliance:read` permission exists (helper uses the existing RBAC gates).
- Fix: clean separate `import type { Prisma }`; `TxClient = Prisma.TransactionClient`.
- Committed in: `69e3f3fa`.

---

**Total deviations:** 3 auto-fixed (2 bug, 1 missing-critical).
**Impact on plan:** Helper behaviour and the D-10 cause shape are exactly as specified. Deviations were integration corrections. No scope creep.

## Issues Encountered
- The broad api test suite cannot be run by `--testNamePattern` because of a PRE-EXISTING Phase 76 collection failure: `payment.test.ts` (and others) import `appRouter` → `deprovisioning.ts` which calls `getIdpAuditLogger()`, but those tests' `vi.mock('@contractor-ops/logger')` omit that export. Introduced by Phase 76 (`646c17ba`/`70-08`), NOT this plan — verified my own test files pass in isolation. Flagged for the Phase 76 owner; tracked as a phase-level note.

## User Setup Required
None. (Production hard-block stays OFF until legal sign-off flips the flag — deferred per Standing Constraint; dev uses FLAG_SIGNOFF_BYPASS=local.)

## Next Phase Readiness
- Wave 2 complete. Wave 3: Plan 72-05 (approval operator registry + recovery) and Plan 72-07 (block-modal UI) — both now unblocked.

---
*Phase: 72-f1-compliance-reminder-cascade-payment-block*
*Completed: 2026-05-31*
