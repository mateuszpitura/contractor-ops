---
plan: 64-01
phase: 64-legal-compliance-hardening
status: complete
commit: a295d2d1
completed_at: 2026-04-26
---

# Plan 64-01: Feature Flag Registry + API Kill-Switch Middleware

## What Was Built

Registered `module.classification-engine` in the feature flag registry with `default: false`, `jurisdiction: ANY`, `category: module`, `owner: legal-platform`. Created `classificationProcedure` middleware that evaluates the flag at request time and throws `FORBIDDEN/CLASSIFICATION_ENGINE_DISABLED` when disabled. Retrofitted all 7 classification tRPC routers to use `classificationProcedure` as their base procedure. Added `FLAG_OFF` early-return guards to both classification cron routes. Added the `classificationEngineDisclaimerGate` override in `evaluator.ts` that blocks flag ON when any disclaimer is PENDING. Created `feature-flags-init.ts` that registers the gate at app boot via the root layout import.

## Key Files Created

- `packages/api/src/middleware/require-classification-flag.ts` — `classificationProcedure`
- `packages/api/src/routers/__tests__/classification-flag-coverage.test.ts` — coverage assertions
- `apps/web/src/lib/feature-flags-init.ts` — disclaimer gate registration

## Key Files Modified

- `packages/feature-flags/src/registry.ts` — flag definition + `CLASSIFICATION_ENGINE_FLAG` alias
- `packages/feature-flags/src/evaluator.ts` — `registerClassificationDisclaimerGate` + gate override
- `packages/feature-flags/src/index.ts` — new exports
- `packages/api/src/routers/classification.ts` — classificationProcedure
- `packages/api/src/routers/classification-dashboard.ts` — classificationProcedure
- `packages/api/src/routers/classification-document.tsx` — classificationProcedure
- `packages/api/src/routers/ir35-chain.ts` — classificationProcedure
- `packages/api/src/routers/ir35-other-client-attestation.ts` — classificationProcedure
- `packages/api/src/routers/economic-dependency-alert.ts` — classificationProcedure
- `packages/api/src/routers/reassessment-trigger.ts` — classificationProcedure
- `packages/api/src/routers/statusfeststellungsverfahren.ts` — classificationProcedure
- `apps/web/src/app/api/cron/classification-economic-dependency/route.ts` — FLAG_OFF gate
- `apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts` — FLAG_OFF gate
- `apps/web/src/app/layout.tsx` — feature-flags-init import

## Deviations

None. All must_haves satisfied.

## Manual-Only Verifications

None required.

## Self-Check: PASSED

- `module.classification-engine` in FLAGS registry with default: false ✓
- `classificationProcedure` middleware throws FORBIDDEN/CLASSIFICATION_ENGINE_DISABLED ✓
- All 7 classification routers use classificationProcedure ✓
- coverage test exists and asserts middleware usage ✓
- Both cron routes return `{ skipped: true, reason: 'FLAG_OFF' }` when flag disabled ✓
- `registerClassificationDisclaimerGate` in evaluator ✓
- `feature-flags-init` imported in root layout ✓
- TypeScript compiles without new errors ✓
