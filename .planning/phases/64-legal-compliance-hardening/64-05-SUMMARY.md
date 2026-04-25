---
plan: 64-05
phase: 64-legal-compliance-hardening
status: complete
commit: 02eeb70a
completed_at: 2026-04-26
---

# Plan 64-05: Next.js Route Flag Gates + FeatureGate RSC + Nav Item + ToS

## What Was Built

Created three classification layout.tsx files that evaluate `module.classification-engine` server-side and call `notFound()` when the flag is off — one for each classification route tree. Each layout also renders `ClassificationAdvisoryBanner` above children (stub until Plan 64-06). Created `FeatureGate` async RSC component that returns null (not CSS hidden) when a flag is off. Added `ShieldCheck` icon and `module.classification-engine` nav item to `navigation.ts` — hidden automatically by the existing nav filtering logic when flag is off. Created `tos.ts` with `TOS_CURRENT_VERSION = '2026.1.0'`. Created `advisory-banner.tsx` stub (replaced by Plan 64-06). Added `flag-gate.test.ts` with 4 tests asserting `notFound()` is called when flag is off. `feature-flags-init.ts` already exists from Plan 64-01.

## Key Files Created

- `apps/web/src/app/[locale]/(dashboard)/classification/layout.tsx`
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/classification/layout.tsx`
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/classification/layout.tsx`
- `apps/web/src/components/feature-gate.tsx` — FeatureGate async RSC
- `apps/web/src/components/classification/advisory-banner.tsx` — stub
- `apps/web/src/lib/tos.ts` — TOS_CURRENT_VERSION
- `apps/web/src/app/[locale]/(dashboard)/classification/__tests__/flag-gate.test.ts`

## Key Files Modified

- `apps/web/src/lib/navigation.ts` — ShieldCheck + classification nav item

## Deviations

- `feature-flags-init.ts` already existed from Plan 64-01 — no changes needed.
- Root layout already imports `feature-flags-init` from Plan 64-01.

## Manual-Only Verifications

None required.

## Self-Check: PASSED

- Three layout files call notFound() when flag off ✓
- All three layouts call evaluate('module.classification-engine') ✓
- FeatureGate returns null/fallback — no CSS hiding ✓
- navigation.ts has 'module.classification-engine' nav item ✓
- TOS_CURRENT_VERSION = '2026.1.0' in tos.ts ✓
- feature-flags-init.ts imports registerClassificationDisclaimerGate + isAllApproved ✓
- flag-gate.test.ts has 4 tests, biome clean ✓
