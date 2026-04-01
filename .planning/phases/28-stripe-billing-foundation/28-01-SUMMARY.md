---
phase: 28-stripe-billing-foundation
plan: 01
subsystem: payments
tags: [stripe, billing, subscriptions, webhooks, tRPC, prisma, qstash, cron]

# Dependency graph
requires:
  - phase: 11-notifications-email-slack
    provides: notification dispatch service (in-app + email + Slack)
  - phase: 13-integration-framework
    provides: QStash for async processing, webhook pipeline patterns
provides:
  - Subscription, OcrCreditLedger, StripeEvent Prisma models
  - Stripe SDK client singleton
  - Billing constants (TIER_CREDIT_ALLOWANCE, TRIAL_CREDIT_ALLOWANCE, PRICE_TO_TIER_MAP)
  - Billing service (checkout, proration preview, portal, customer management)
  - Webhook handler with idempotent event processing
  - Trial notification cron (7-day and 1-day)
  - tRPC billing router with 5 procedures
affects: [28-02-credit-metering, 28-03-billing-ui]

# Tech tracking
tech-stack:
  added: [stripe@21.0.1]
  patterns: [dedicated webhook route per provider, SubscriptionWithPeriod type extension for Stripe SDK v21 compatibility, billing-constants single source of truth]

key-files:
  created:
    - packages/db/prisma/schema/billing.prisma
    - packages/api/src/services/stripe-client.ts
    - packages/api/src/services/billing-constants.ts
    - packages/api/src/services/billing-service.ts
    - packages/api/src/services/billing-webhook.ts
    - packages/api/src/routers/billing.ts
    - apps/web/src/app/api/webhooks/stripe/route.ts
    - apps/web/src/app/api/cron/trial-notifications/route.ts
    - packages/api/src/services/__tests__/test-helpers.ts
    - packages/api/src/services/__tests__/billing-service.test.ts
    - packages/api/src/services/__tests__/billing-webhook.test.ts
  modified:
    - packages/db/prisma/schema/organization.prisma
    - packages/api/src/root.ts
    - packages/api/package.json
    - packages/validators/src/notification.ts
    - .env.example

key-decisions:
  - "Stripe SDK v21 uses apiVersion 2026-03-25.dahlia -- adapted from plan's 2025-06-30.basil"
  - "SubscriptionWithPeriod interface extends Stripe.Subscription for period fields still present in webhook payloads but removed from SDK types"
  - "Invoice subscription ID extracted via invoice.parent.subscription_details.subscription (v21 API change)"
  - "Added TRIAL_ENDING and PAYMENT_FAILED notification types to validators for type-safe dispatch"

patterns-established:
  - "billing-constants.ts as single source of truth: all billing constants imported from one file"
  - "SubscriptionWithPeriod type pattern: extend Stripe types for fields present in webhooks but absent from SDK"
  - "Dedicated webhook route per payment provider: /api/webhooks/stripe separate from [provider] route"

requirements-completed: [BILL-01, BILL-02, BILL-03, BILL-07, BILL-08]

# Metrics
duration: 13min
completed: 2026-04-01
---

# Phase 28 Plan 01: Billing Backend Foundation Summary

**Stripe billing backend with subscription schema, idempotent webhook processing, trial credits, trial notification cron, and tRPC billing router**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-01T19:02:49Z
- **Completed:** 2026-04-01T19:15:42Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Prisma billing schema with Subscription (org-unique), OcrCreditLedger, and StripeEvent models
- Idempotent Stripe webhook processing with deduplication via StripeEvent table and transaction-wrapped handlers
- checkout.session.completed creates 5-credit trial ledger entry for trialing subscriptions (D-08)
- Trial notification cron sends 7-day and 1-day reminders via both in-app and email (D-10)
- tRPC billing router with 5 procedures: getSubscription, createCheckoutSession, getProrationPreview, createPortalSession, getPlanConfig
- Billing constants file as single source of truth for TIER_CREDIT_ALLOWANCE (20/100/500), TRIAL_CREDIT_ALLOWANCE (5), and PRICE_TO_TIER_MAP

## Task Commits

Each task was committed atomically:

1. **Task 1: Billing schema, Stripe client, billing constants, and billing service** - `1f9063a` (feat)
2. **Task 2: Webhook route, webhook handler, trial notification cron, tRPC router, and test scaffolds** - `cfbbbde` (feat)

## Files Created/Modified
- `packages/db/prisma/schema/billing.prisma` - Subscription, OcrCreditLedger, StripeEvent models with SubscriptionTier and SubscriptionStatus enums
- `packages/api/src/services/stripe-client.ts` - Singleton Stripe SDK client (apiVersion 2026-03-25.dahlia)
- `packages/api/src/services/billing-constants.ts` - Single source of truth for tier credit allowances, trial credits, price-to-tier mapping
- `packages/api/src/services/billing-service.ts` - Checkout sessions, proration preview, portal sessions, customer management
- `packages/api/src/services/billing-webhook.ts` - Event routing with handlers for subscription lifecycle, trial credits, invoice credits, payment failures
- `packages/api/src/routers/billing.ts` - tRPC billing router with 5 admin/tenant procedures
- `apps/web/src/app/api/webhooks/stripe/route.ts` - Dedicated Stripe webhook endpoint with signature verification and idempotency
- `apps/web/src/app/api/cron/trial-notifications/route.ts` - Daily QStash cron for 7-day and 1-day trial notifications
- `packages/api/src/services/__tests__/test-helpers.ts` - Mock factories for Stripe events, subscriptions, invoices
- `packages/api/src/services/__tests__/billing-service.test.ts` - Test scaffolds for BILL-01/02/03/08
- `packages/api/src/services/__tests__/billing-webhook.test.ts` - Test scaffolds for BILL-07/08 including trial credits and notifications
- `packages/db/prisma/schema/organization.prisma` - Added subscription and ocrCreditLedger relations
- `packages/api/src/root.ts` - Registered billingRouter as 28th router
- `packages/api/package.json` - Added stripe dependency and service exports
- `packages/validators/src/notification.ts` - Added TRIAL_ENDING and PAYMENT_FAILED notification types
- `.env.example` - Added 6 Stripe-related environment variables

## Decisions Made
- Used Stripe SDK apiVersion "2026-03-25.dahlia" (plan specified "2025-06-30.basil" but the installed SDK v21 requires dahlia)
- Created SubscriptionWithPeriod interface to handle current_period_start/end fields present in webhook payloads but removed from SDK types in v21
- Extracted invoice subscription ID from invoice.parent.subscription_details.subscription (v21 API change from direct invoice.subscription)
- Used subscription_details.items and subscription_details.proration_behavior for invoice preview (v21 API change)
- Added TRIAL_ENDING and PAYMENT_FAILED to notification types in validators package for type-safe dispatch

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stripe SDK v21 API version mismatch**
- **Found during:** Task 1 (Stripe client creation)
- **Issue:** Plan specified apiVersion "2025-06-30.basil" but installed stripe@21.0.1 requires "2026-03-25.dahlia"
- **Fix:** Updated apiVersion to "2026-03-25.dahlia"
- **Files modified:** packages/api/src/services/stripe-client.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** cfbbbde

**2. [Rule 1 - Bug] Stripe SDK v21 removed current_period_start/end from Subscription type**
- **Found during:** Task 2 (Webhook handler)
- **Issue:** Stripe.Subscription no longer has current_period_start and current_period_end in SDK types
- **Fix:** Created SubscriptionWithPeriod interface extending Stripe.Subscription with these fields (still present in webhook payloads)
- **Files modified:** packages/api/src/services/billing-webhook.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** cfbbbde

**3. [Rule 1 - Bug] Stripe SDK v21 moved invoice.subscription to invoice.parent.subscription_details**
- **Found during:** Task 2 (Webhook handler)
- **Issue:** invoice.subscription property removed in v21 API, moved to parent.subscription_details.subscription
- **Fix:** Created getSubscriptionIdFromInvoice() helper to extract from new location
- **Files modified:** packages/api/src/services/billing-webhook.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** cfbbbde

**4. [Rule 1 - Bug] Stripe SDK v21 changed invoice preview API parameters**
- **Found during:** Task 2 (Billing service proration preview)
- **Issue:** subscription_items and subscription_proration_behavior moved to subscription_details nested object
- **Fix:** Updated to use subscription_details.items and subscription_details.proration_behavior
- **Files modified:** packages/api/src/services/billing-service.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** cfbbbde

**5. [Rule 2 - Missing Critical] Added billing notification types to validators**
- **Found during:** Task 2 (Webhook handler notifications)
- **Issue:** NOTIFICATION_TYPES array lacked TRIAL_ENDING and PAYMENT_FAILED, causing type errors when dispatching billing notifications
- **Fix:** Added both types to NOTIFICATION_TYPES in validators/notification.ts
- **Files modified:** packages/validators/src/notification.ts
- **Verification:** TypeScript compilation passes, validators build succeeds
- **Committed in:** cfbbbde

---

**Total deviations:** 5 auto-fixed (4 bugs from Stripe SDK v21 changes, 1 missing critical)
**Impact on plan:** All auto-fixes necessary for correctness with current Stripe SDK version. No scope creep.

## Issues Encountered
- Stripe SDK v21 has significant type changes from the version assumed in the plan (multiple properties relocated/renamed). All resolved by adapting to the current SDK types while maintaining runtime compatibility with webhook payloads.

## User Setup Required

**External services require manual configuration.** The plan's `user_setup` section describes:
- Adding STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET to .env
- Creating 3 Products (Starter, Pro, Enterprise) with monthly recurring Prices in PLN in Stripe Dashboard
- Creating per-seat add-on Prices for each tier
- Creating an 'ocr_extraction' Meter in Stripe Billing
- Configuring the Billing Portal
- Adding webhook endpoint pointing to /api/webhooks/stripe

## Known Stubs

None - all code paths are wired to real Stripe SDK calls and notification dispatch.

## Next Phase Readiness
- Billing schema, Stripe client, constants, and webhook infrastructure ready for Plan 02 (credit metering)
- billing-constants.ts exports TIER_CREDIT_ALLOWANCE and TRIAL_CREDIT_ALLOWANCE for Plan 02's credit-service.ts
- tRPC billing router ready for Plan 03 (billing UI) to consume

---
*Phase: 28-stripe-billing-foundation*
*Completed: 2026-04-01*
