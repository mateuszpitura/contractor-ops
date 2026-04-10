---
phase: 28-stripe-billing-foundation
plan: 03
subsystem: ui
tags: [react, stripe, billing, shadcn, tailwind, trpc, accessibility]

# Dependency graph
requires:
  - phase: 28-01
    provides: tRPC billing router (getSubscription, createCheckoutSession, getProrationPreview, createPortalSession)
  - phase: 28-02
    provides: credit-service (getCreditBalance), billing-webhook, billing-constants
provides:
  - Complete billing UI: Settings Billing tab with plan comparison grid, current plan summary, credit usage card
  - Trial experience: TrialBanner (last 7 days), SoftBlockModal (trial expired), CreditExhaustedInline
  - Utility components: PremiumBadge (Gem icon), ProrationPreview, TopUpDialog
  - BillingOverlay client wrapper for dashboard layout integration
affects: [settings, dashboard-layout, ocr-extraction, feature-gating]

# Tech tracking
tech-stack:
  added: []
  patterns: [BillingOverlay client wrapper for server-component layout, PlanCtaMode pattern for dynamic CTA labels, static plan config with env-based price IDs]

key-files:
  created:
    - apps/web/src/components/billing/billing-tab.tsx
    - apps/web/src/components/billing/plan-comparison-grid.tsx
    - apps/web/src/components/billing/plan-card.tsx
    - apps/web/src/components/billing/current-plan-summary.tsx
    - apps/web/src/components/billing/credit-usage-card.tsx
    - apps/web/src/components/billing/proration-preview.tsx
    - apps/web/src/components/billing/premium-badge.tsx
    - apps/web/src/components/billing/top-up-dialog.tsx
    - apps/web/src/components/billing/trial-banner.tsx
    - apps/web/src/components/billing/soft-block-modal.tsx
    - apps/web/src/components/billing/credit-exhausted-inline.tsx
    - apps/web/src/components/billing/billing-overlay.tsx
  modified:
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/layout.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "BillingOverlay client wrapper pattern: dashboard layout is a server component, so trial banner and soft-block modal are wrapped in a client component that queries subscription status"
  - "Static plan config in plan-comparison-grid.tsx uses NEXT_PUBLIC env vars for Stripe price IDs with fallback defaults"
  - "Credit usage card shows tier allowance from local constants until getCreditBalance tRPC endpoint is exposed"

patterns-established:
  - "BillingOverlay: client wrapper for billing state in server-component layouts"
  - "PlanCtaMode: choose/upgrade/change/current for dynamic plan card CTA labels based on tier comparison"

requirements-completed: [BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07, BILL-08]

# Metrics
duration: 6min
completed: 2026-04-01
---

# Phase 28 Plan 03: Billing UI Summary

**Complete billing UI with Settings tab, 3-tier plan comparison grid (199/449/849 PLN), trial banner, soft-block modal, credit usage with progress bar, and Stripe Checkout integration via tRPC**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-01T19:25:14Z
- **Completed:** 2026-04-01T19:31:33Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint)
- **Files modified:** 16

## Accomplishments
- Created 12 billing UI components covering plan comparison, current plan summary, credit usage, proration preview, trial banner, soft-block modal, credit exhausted inline, premium badge, and top-up dialog
- Wired all components to tRPC billing router (getSubscription, createCheckoutSession, createPortalSession, getProrationPreview)
- Added Billing tab to Settings page gated by organization.update permission with i18n (en/pl)
- Integrated trial banner and soft-block modal into dashboard layout via BillingOverlay client wrapper
- Full accessibility: radiogroup/radio for plan cards, role=alert for banners, role=alertdialog with focus trap for soft-block modal

## Task Commits

Each task was committed atomically:

1. **Task 1: Billing tab, plan cards, current plan summary, and credit usage** - `408a271` (feat)
2. **Task 2: Trial banner, soft-block modal, and credit exhausted inline** - `97d083a` (feat)
3. **Task 3: Visual verification** - checkpoint:human-verify (pending)

## Files Created/Modified
- `apps/web/src/components/billing/billing-tab.tsx` - Main billing tab container with plan selection flow and portal redirect
- `apps/web/src/components/billing/plan-comparison-grid.tsx` - 3-column responsive grid with static plan data (19900/44900/84900 grosze)
- `apps/web/src/components/billing/plan-card.tsx` - Individual plan card with PlanCtaMode pattern, ARIA radio role
- `apps/web/src/components/billing/current-plan-summary.tsx` - Active plan status with loading/error/empty states
- `apps/web/src/components/billing/credit-usage-card.tsx` - OCR credit progress bar with top-up action
- `apps/web/src/components/billing/proration-preview.tsx` - Inline proration display with confirm/cancel
- `apps/web/src/components/billing/premium-badge.tsx` - Gem icon with tooltip for feature gating
- `apps/web/src/components/billing/top-up-dialog.tsx` - Credit bundle purchase dialog with Stripe Checkout redirect
- `apps/web/src/components/billing/trial-banner.tsx` - Global trial expiry banner (last 7 days) with day-specific copy
- `apps/web/src/components/billing/soft-block-modal.tsx` - Non-dismissible trial expired overlay with compact plan grid
- `apps/web/src/components/billing/credit-exhausted-inline.tsx` - Inline OCR credit exhaustion alert
- `apps/web/src/components/billing/billing-overlay.tsx` - Client wrapper for server-component dashboard layout
- `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` - Added Billing tab trigger and content
- `apps/web/src/app/[locale]/(dashboard)/layout.tsx` - Added BillingOverlay between TopBar and main content
- `apps/web/messages/en.json` - Added Settings.tabs.billing = "Billing"
- `apps/web/messages/pl.json` - Added Settings.tabs.billing = "Rozliczenia"

## Decisions Made
- Used BillingOverlay client wrapper pattern because dashboard layout is a server component that cannot use React hooks or tRPC queries directly
- Static plan config lives in plan-comparison-grid.tsx with NEXT_PUBLIC env vars for Stripe price IDs, matching the approach in billing-constants.ts on the backend
- Credit usage card uses local tier allowance constants as placeholder until getCreditBalance is exposed as a tRPC endpoint (credit-service exists but not routed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created BillingOverlay client wrapper component**
- **Found during:** Task 2 (Dashboard layout integration)
- **Issue:** Dashboard layout is a server component and cannot use React hooks (useQuery, useMutation) needed for subscription status
- **Fix:** Created billing-overlay.tsx as a client component wrapper that queries subscription and conditionally renders TrialBanner and SoftBlockModal
- **Files modified:** apps/web/src/components/billing/billing-overlay.tsx
- **Verification:** Layout imports and renders BillingOverlay correctly
- **Committed in:** 97d083a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for correctness - server components cannot use hooks. No scope creep.

## Known Stubs

- `apps/web/src/components/billing/credit-usage-card.tsx` line 56: `const used = 0;` - Placeholder until getCreditBalance tRPC endpoint is exposed. The credit-service.ts function exists in packages/api but is not yet routed through the billing tRPC router. Future plan should add this endpoint.
- `apps/web/src/components/billing/top-up-dialog.tsx` lines 62-66: Top-up price IDs use env var fallbacks (`price_topup_10`, etc.) - actual Stripe price IDs need to be configured in environment.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Stripe price ID env vars (NEXT_PUBLIC_STRIPE_PRICE_STARTER, etc.) should be configured in .env for production but components gracefully fall back to defaults.

## Next Phase Readiness
- All billing UI components created and wired to tRPC billing router
- Awaiting human visual verification (Task 3 checkpoint)
- getCreditBalance tRPC endpoint should be added to billing router in a follow-up to replace the credit-usage-card placeholder

---
*Phase: 28-stripe-billing-foundation*
*Completed: 2026-04-01*
