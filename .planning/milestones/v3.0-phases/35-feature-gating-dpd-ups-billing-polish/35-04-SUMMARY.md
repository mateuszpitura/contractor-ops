---
phase: 35-feature-gating-dpd-ups-billing-polish
plan: 04
subsystem: ui
tags: [react, billing, feature-gating, usage-dashboard, i18n, next-intl, progress-bar]

# Dependency graph
requires:
  - phase: 35-01
    provides: billing tRPC endpoints (getSubscription, getUsageDashboard, getCreditBalance)
provides:
  - FeatureGate client wrapper component for tier-based UI gating
  - UpgradeInlineBanner with Gem icon and Upgrade Plan CTA
  - UsageDashboard with 4 KPI cards (plan, seats, credits, billing date)
  - CreditProgressBar with green/yellow/red thresholds
  - SeatCountCard displaying auto-calculated active contractors
  - BillingDateCard with renewal/trial context
  - UsageKpiCard generic KPI card shell
  - BillingTab integration with UsageDashboard
  - Billing i18n keys (gate, usage, credits) in en.json and pl.json
affects: [billing-tab, feature-gating, settings-page]

# Tech tracking
tech-stack:
  added: []
  patterns: [FeatureGate wrapper with TIER_RANK comparison, billingProxy typed any cast for stale API dist]

key-files:
  created:
    - apps/web/src/components/billing/feature-gate.tsx
    - apps/web/src/components/billing/upgrade-inline-banner.tsx
    - apps/web/src/components/billing/usage-dashboard.tsx
    - apps/web/src/components/billing/usage-kpi-card.tsx
    - apps/web/src/components/billing/credit-progress-bar.tsx
    - apps/web/src/components/billing/seat-count-card.tsx
    - apps/web/src/components/billing/billing-date-card.tsx
  modified:
    - apps/web/src/components/billing/billing-tab.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "FeatureGate renders children during loading to avoid flashing upgrade banner"
  - "CreditProgressBar uses inline style override on ProgressIndicator for dynamic color"
  - "UsageDashboard uses typed any proxy for getUsageDashboard until API dist is rebuilt"

patterns-established:
  - "FeatureGate pattern: TIER_RANK Record<string, number> for numeric tier comparison in client components"
  - "base-ui Button render prop for Link composition (no asChild)"

requirements-completed: [BILL-09, BILL-10]

# Metrics
duration: 5min
completed: 2026-04-05
---

# Phase 35 Plan 04: Feature Gating UI + Usage Dashboard Summary

**FeatureGate wrapper with tier-based inline upgrade banners and 4-card usage dashboard (plan, seats, credits, billing date) with green/yellow/red credit progress bar**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T10:47:51Z
- **Completed:** 2026-04-05T10:53:18Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- FeatureGate wrapper checks org tier via getSubscription and renders children or UpgradeInlineBanner
- UsageDashboard displays 4 KPI cards with loading/error/empty states, plus PlanComparisonGrid
- CreditProgressBar shifts green/yellow/red based on credit depletion thresholds per UI-SPEC
- SeatCountCard shows auto-calculated active contractors with overage indicator (per D-15/D-16)
- All en/pl i18n keys added under Billing.gate, Billing.usage, Billing.credits namespaces

## Task Commits

Each task was committed atomically:

1. **Task 1: FeatureGate wrapper + UpgradeInlineBanner components** - `c54d51f` (feat)
2. **Task 2: Usage dashboard with KPI cards, CreditProgressBar, and BillingTab integration + i18n** - `c29f4d5` (feat)

## Files Created/Modified
- `apps/web/src/components/billing/feature-gate.tsx` - FeatureGate client wrapper with TIER_RANK comparison
- `apps/web/src/components/billing/upgrade-inline-banner.tsx` - Inline upgrade banner with Gem icon, feature name, tier, CTA
- `apps/web/src/components/billing/usage-dashboard.tsx` - Full usage dashboard with 4 KPI cards and plan comparison
- `apps/web/src/components/billing/usage-kpi-card.tsx` - Generic KPI card shell (icon, label, value, subText)
- `apps/web/src/components/billing/credit-progress-bar.tsx` - Progress bar with green/yellow/red color thresholds
- `apps/web/src/components/billing/seat-count-card.tsx` - Active seats display with overage indicator
- `apps/web/src/components/billing/billing-date-card.tsx` - Billing date with renewal/trial context
- `apps/web/src/components/billing/billing-tab.tsx` - Updated to render UsageDashboard as primary content
- `apps/web/messages/en.json` - Added Billing namespace with gate, usage, credits keys
- `apps/web/messages/pl.json` - Added Billing namespace with Polish translations

## Decisions Made
- FeatureGate renders children during loading to avoid flashing the upgrade banner on page load
- CreditProgressBar uses inline style override on base-ui ProgressIndicator for dynamic bar color
- Used billingProxy typed any cast for getUsageDashboard since API dist types may not be rebuilt yet (consistent with Phase 32 pattern)
- base-ui Button uses render prop for Link composition instead of asChild (base-ui pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Button asChild to render prop**
- **Found during:** Task 1 (UpgradeInlineBanner)
- **Issue:** Plan specified `<Button asChild>` but base-ui Button component uses `render` prop pattern, not Radix asChild
- **Fix:** Changed to `<Button render={<Link href="..." />}>` per base-ui API
- **Files modified:** apps/web/src/components/billing/upgrade-inline-banner.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** c54d51f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor API adaptation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components wire to real tRPC endpoints (getSubscription, getUsageDashboard).

## Next Phase Readiness
- FeatureGate and UpgradeInlineBanner ready to wrap any sub-feature in the app
- UsageDashboard integrated into BillingTab with live data from billing endpoints
- i18n keys in place for both English and Polish

## Self-Check: PASSED

All 10 files verified on disk. Both commit hashes (c54d51f, c29f4d5) found in git log.

---
*Phase: 35-feature-gating-dpd-ups-billing-polish*
*Completed: 2026-04-05*
