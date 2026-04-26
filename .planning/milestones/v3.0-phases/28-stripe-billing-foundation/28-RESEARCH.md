# Phase 28: Stripe Billing Foundation - Research

**Researched:** 2026-04-01
**Domain:** Stripe subscription billing, usage-based metering, webhook-driven state management
**Confidence:** HIGH

## Summary

Phase 28 implements subscription billing as a separate bounded context using Stripe as the single source of truth. The architecture centers on three Stripe primitives: **Products/Prices** (tier structure with flat + per-seat pricing), **Meters** (OCR credit tracking via `stripe.billing.meterEvents.create`), and **Checkout Sessions** (payment collection). Internal state is maintained via webhook events processed idempotently, with Stripe's hosted billing portal handling payment methods, invoices, and cancellation.

The project already has strong infrastructure to build on: multi-tenant organization model with `billingEmail`, QStash for async processing, tRPC routers with tenant middleware, notification service (in-app + email), and a Settings page with URL-synced tabs. The Stripe integration is explicitly a **separate bounded context** (D-20) with its own webhook route, NOT through the existing integration adapter pipeline.

**Primary recommendation:** Use Stripe Checkout (hosted) for all payment collection, Stripe Meters for OCR usage tracking, and a dedicated `billing.prisma` schema file with idempotency keys on all webhook-mutated records. Keep Stripe as the source of truth for subscription state -- internal DB caches the subscription status for fast auth checks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Three tiers: Starter (199 PLN/mo), Pro (449 PLN/mo), Enterprise (849 PLN/mo) -- flat platform fee + per-seat add-on
- **D-02:** Included seats before per-seat charges: Starter: 2, Pro: 5, Enterprise: 15
- **D-03:** Per-seat pricing is tier-specific: Starter: 19 PLN/seat, Pro: 29 PLN/seat, Enterprise: 49 PLN/seat
- **D-04:** Hybrid differentiation -- tiers differ by both capacity limits AND feature access
- **D-05:** Feature gates: Starter = core contractor ops (CRUD, contracts, invoices, approvals, payments). Pro = all Starter + integrations + OCR + advanced workflows. Enterprise = all Pro + audit log export + API access
- **D-06:** OCR credit allowance per tier: Starter: 20/mo, Pro: 100/mo, Enterprise: 500/mo
- **D-07:** 14-day free trial for all new orgs
- **D-08:** Trial gets full Pro-tier features but capacity limited: 2 users, 5 contractors, 5 OCR credits
- **D-09:** Trial end triggers immediate soft block -- app works but every action shows upgrade modal. Data preserved, persistent nudge until subscription starts
- **D-10:** Trial-ending notifications at 7, 3, and 1 days before expiry -- in-app banner + email to billing contact
- **D-11:** 1 credit = 1 invoice extraction, regardless of page count (per-extraction, not per-page)
- **D-12:** Metering via Stripe Meters -- each OCR call reports a usage event to Stripe
- **D-13:** Top-up bundles: manual purchase available for all tiers. Pro/Enterprise can optionally enable auto-renewal with configurable threshold and bundle size
- **D-14:** Hard-block when credits exhausted: inline message at OCR trigger point with upgrade and top-up buttons. Rest of app works normally
- **D-15:** Billing management lives as a new "Billing" sub-tab under Settings
- **D-16:** Upgrade prompts: contextual inline prompts at feature gates. Premium features marked with a diamond icon throughout the UI
- **D-17:** Global banner appears only during trial-ending period (last 7 days)
- **D-18:** In-app plan comparison UI with feature matrix and pricing, then redirect to Stripe Checkout for payment collection
- **D-19:** Admin upgrade/downgrade with proration preview shown before confirming via Stripe Checkout
- **D-20:** Stripe billing is a separate bounded context -- dedicated webhook route (`/api/webhooks/stripe`), NOT through the integration adapter pipeline
- **D-21:** Stripe webhook events update internal subscription state with database-level idempotency
- **D-22:** Admin can access Stripe-hosted billing portal for payment method management, invoice history, and cancellation

### Claude's Discretion
- Stripe product/price object structure and naming conventions
- Database schema for subscription and credit tracking models
- Webhook event handling implementation details (which events to listen for)
- Top-up bundle sizes and pricing
- Plan comparison UI layout and responsive behavior
- Proration calculation display format
- Soft-block modal design and copy
- Credit reset timing (calendar month vs billing cycle)

### Deferred Ideas (OUT OF SCOPE)
- **BILL-09:** Feature gating middleware with graceful upgrade prompts -- Phase 35
- **BILL-10:** Usage dashboard with current plan, seat count, OCR credits used/remaining, billing date -- Phase 35
- Open banking / payment initiation for contractor payments -- v4+
- Stripe Connect for contractor payouts -- out of scope (Polish B2B uses bank transfers)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BILL-01 | System manages subscription tiers (Starter/Pro/Enterprise) with flat + per-seat pricing via Stripe | Stripe Products/Prices with `recurring` mode, metered billing for per-seat; Prisma `Subscription` model caches state |
| BILL-02 | Admin can upgrade or downgrade plan with proration preview | `stripe.subscriptions.retrieve` with `proration_behavior`, Stripe Checkout in `subscription` mode for plan changes |
| BILL-03 | New org starts with free trial with trial-ending notifications | `subscription_data.trial_period_days: 14` on Checkout, `customer.subscription.trial_will_end` webhook + custom cron for 7/3/1-day notifications |
| BILL-04 | System meters AI/OCR usage per org via Stripe Meters and reports events on each OCR call | `stripe.billing.meterEvents.create` with `event_name: 'ocr_extraction'` after successful extraction |
| BILL-05 | Each plan tier includes N free OCR credits/month with configurable auto-renewal top-up bundles | Meter-based pricing on subscription + local credit tracking, one-time Checkout for top-up bundles |
| BILL-06 | System hard-blocks OCR when credits exhausted with upgrade/top-up prompt | Credit check in `triggerOcrExtraction` before QStash dispatch, `CreditExhaustedInline` component |
| BILL-07 | Stripe webhook events drive internal subscription state with database-level idempotency | Dedicated `/api/webhooks/stripe` route, `stripeEventId` unique constraint, transactional processing |
| BILL-08 | Admin can access Stripe-hosted billing portal for payment method, invoices, and cancellation | `stripe.billingPortal.sessions.create` with return URL to `/settings?tab=billing` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Monorepo with Turborepo:** New billing package or service module must follow existing package boundaries
- **Schema validation:** All Stripe webhook payloads, API inputs, and env variables must be validated with Zod
- **Security:** Never expose Stripe secret key client-side; webhook signature verification mandatory; least-privilege access (only admin can manage billing)
- **Integer grosze for money:** All PLN amounts stored as grosze (integer). Stripe also uses smallest currency unit (grosze for PLN), so no conversion needed
- **Observability:** Proper logging on webhook processing, credit deductions, subscription state changes. No silent failures
- **Performance:** Cache subscription status for fast middleware checks, avoid hitting Stripe API on every request
- **Accessibility:** Plan comparison cards with radiogroup role, alert roles on trial banner, focus trap on soft-block modal (detailed in UI-SPEC)
- **i18n:** All billing UI copy in Polish + English

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | 21.0.1 | Server-side Stripe API client | Official Node.js SDK, typed, covers all billing APIs |
| `@stripe/stripe-js` | 9.0.1 | Client-side Stripe.js loader | Required for Checkout redirect, loads Stripe.js asynchronously |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Prisma | (existing) | Billing schema models, idempotent webhook writes | New `billing.prisma` schema file |
| tRPC | (existing) | Billing router for plan management, portal session, credit queries | New `billing.ts` router |
| QStash | (existing) | Async webhook processing, trial notification scheduling | Webhook event processing, scheduled trial notifications |
| Zod | (existing) | Webhook payload validation, billing settings schema | All Stripe data boundaries |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Checkout (hosted) | Stripe Elements (embedded) | Checkout is faster to implement, handles 3DS/SCA, lower PCI scope. Elements give more UI control but require more code |
| Stripe Meters | Local-only credit tracking | Meters keep Stripe as source of truth and enable invoice-level usage line items. Local-only loses billing integration |
| Stripe billing portal (hosted) | Custom payment method UI | Portal is free, PCI-compliant, handles invoices. Custom UI requires Stripe Elements + more PCI work |

**Installation:**
```bash
pnpm add stripe --filter @contractor-ops/api
pnpm add @stripe/stripe-js --filter web
```

**Version verification:** `stripe@21.0.1` (verified via npm registry 2026-04-01), `@stripe/stripe-js@9.0.1` (verified 2026-04-01).

## Architecture Patterns

### Recommended Project Structure

```
packages/api/src/
  services/
    stripe-client.ts          # Singleton Stripe client initialization
    billing-service.ts        # Subscription CRUD, proration preview, portal session
    credit-service.ts         # OCR credit check, deduction, meter event reporting
    billing-webhook.ts        # Webhook event handlers (subscription, invoice, meter)
  routers/
    billing.ts                # tRPC billing router

packages/db/prisma/schema/
  billing.prisma              # Subscription, OcrCreditLedger, StripeEvent models

apps/web/src/
  app/[locale]/(dashboard)/settings/
    page.tsx                  # Add Billing tab (existing file, modified)
  app/api/webhooks/stripe/
    route.ts                  # Dedicated Stripe webhook endpoint (NOT [provider])
  components/billing/
    billing-tab.tsx
    plan-comparison-grid.tsx
    plan-card.tsx
    current-plan-summary.tsx
    credit-usage-card.tsx
    trial-banner.tsx
    soft-block-modal.tsx
    proration-preview.tsx
    premium-badge.tsx
    credit-exhausted-inline.tsx
    top-up-dialog.tsx
```

### Pattern 1: Stripe as Source of Truth with Local Cache

**What:** Stripe owns subscription and meter state. The local DB caches a denormalized `Subscription` record for fast access (middleware checks, UI rendering). Webhooks keep the cache in sync.

**When to use:** Every read of subscription status in the app.

**Example:**
```typescript
// packages/api/src/services/stripe-client.ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
  typescript: true,
});
```

```typescript
// Webhook handler pattern: idempotent upsert
async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEnd: subscription.trial_end 
        ? new Date(subscription.trial_end * 1000) 
        : null,
      stripePriceId: subscription.items.data[0]?.price.id ?? null,
      updatedAt: new Date(),
    },
    create: {
      organizationId: resolveOrgId(subscription.metadata),
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      status: subscription.status,
      // ... same fields
    },
  });
}
```

### Pattern 2: Idempotent Webhook Processing

**What:** Every webhook event is tracked by `stripeEventId` with a unique constraint. Processing is wrapped in a transaction that first checks for the event, then processes and marks it complete atomically.

**When to use:** All webhook event handlers.

**Example:**
```typescript
// apps/web/src/app/api/webhooks/stripe/route.ts
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  // Verify signature
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );

  // Idempotency check: skip if already processed
  const existing = await prisma.stripeEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ received: true });
  }

  // Record event and process in transaction
  await prisma.$transaction(async (tx) => {
    await tx.stripeEvent.upsert({
      where: { stripeEventId: event.id },
      update: {},
      create: {
        stripeEventId: event.id,
        eventType: event.type,
        payloadJson: event.data.object as any,
      },
    });

    await routeEvent(event, tx);

    await tx.stripeEvent.update({
      where: { stripeEventId: event.id },
      data: { processedAt: new Date() },
    });
  });

  return NextResponse.json({ received: true });
}
```

### Pattern 3: Credit Check Before OCR Dispatch

**What:** Insert a credit availability check in `triggerOcrExtraction` before the QStash dispatch. This is a synchronous check against the local credit cache, not a Stripe API call.

**When to use:** Every OCR extraction trigger (both admin and portal).

**Example:**
```typescript
// packages/api/src/services/credit-service.ts
export async function checkAndDeductCredit(organizationId: string): Promise<{
  allowed: boolean;
  remaining: number;
  reason?: string;
}> {
  const subscription = await prisma.subscription.findFirst({
    where: { organizationId, status: { in: ["active", "trialing"] } },
    include: { organization: true },
  });

  if (!subscription) {
    return { allowed: false, remaining: 0, reason: "no_subscription" };
  }

  const usage = await prisma.ocrCreditLedger.aggregate({
    where: {
      organizationId,
      periodStart: { lte: new Date() },
      periodEnd: { gte: new Date() },
    },
    _sum: { credits: true },
  });

  const used = Math.abs(usage._sum.credits ?? 0);
  const allowance = getTierAllowance(subscription.tier);
  const remaining = allowance - used;

  if (remaining <= 0) {
    return { allowed: false, remaining: 0, reason: "credits_exhausted" };
  }

  // Deduct credit locally
  await prisma.ocrCreditLedger.create({
    data: {
      organizationId,
      credits: -1,
      reason: "OCR_EXTRACTION",
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
    },
  });

  // Report to Stripe Meter (fire-and-forget)
  stripe.billing.meterEvents.create({
    event_name: "ocr_extraction",
    payload: {
      stripe_customer_id: subscription.stripeCustomerId,
      value: "1",
    },
  }).catch((err) => console.error("[billing] Meter event failed:", err));

  return { allowed: true, remaining: remaining - 1 };
}
```

### Pattern 4: Stripe Checkout for Plan Changes

**What:** Use Stripe Checkout in `subscription` mode for new subscriptions and plan changes. For upgrades/downgrades of existing subscriptions, use `stripe.subscriptions.update` with proration preview first, then redirect to Checkout if payment is needed.

**When to use:** All plan selection and change flows.

**Example:**
```typescript
// Proration preview (no charge, just calculation)
const preview = await stripe.invoices.createPreview({
  customer: subscription.stripeCustomerId,
  subscription: subscription.stripeSubscriptionId,
  subscription_items: [{
    id: subscription.stripeSubscriptionItemId,
    price: newPriceId,
  }],
  subscription_proration_behavior: "create_prorations",
});
// preview.lines contains proration line items with amounts
```

### Anti-Patterns to Avoid

- **Polling Stripe for subscription status:** Cache locally, update via webhooks. Never call `stripe.subscriptions.retrieve` on every page load.
- **Processing webhooks synchronously with heavy logic:** Return 200 immediately, process async via QStash. Stripe retries if it does not get 200 within 30 seconds.
- **Trusting client-side plan selection:** Always verify the price ID server-side before creating a Checkout session. Client can send any price ID.
- **Storing card numbers or PCI-sensitive data:** Stripe Checkout and Portal handle all PCI scope. Never build custom card input forms.
- **Using legacy usage records API:** Removed in API version 2025-03-31.basil. Use Stripe Meters exclusively.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment collection UI | Custom card input form | Stripe Checkout (hosted) | PCI-DSS compliance, 3DS/SCA handling, mobile optimization |
| Payment method management | Custom card update flow | Stripe Billing Portal | Free, PCI-compliant, handles invoices and cancellation |
| Proration calculation | Manual pro-rata math | `stripe.invoices.createPreview` | Stripe handles edge cases (mid-cycle, tax, coupons) |
| Usage metering | Custom meter + cron aggregation | Stripe Meters API | Integrates with Stripe invoicing, handles billing period alignment |
| Retry logic for failed payments | Custom dunning system | Stripe Smart Retries | ML-based retry timing, configurable in Stripe Dashboard |
| Webhook signature verification | Custom HMAC | `stripe.webhooks.constructEvent` | Handles timing attacks, replay protection, key rotation |
| Invoice generation | Custom PDF invoices | Stripe Invoices | Automatic with subscriptions, hosted invoice page |

**Key insight:** Stripe's hosted surfaces (Checkout, Portal) eliminate PCI scope, handle regulatory complexity (SCA/3DS), and reduce implementation to ~80% less code than custom solutions. The cost is less UI control, which is acceptable for a B2B SaaS billing page.

## Common Pitfalls

### Pitfall 1: Webhook Event Ordering
**What goes wrong:** Stripe does not guarantee event delivery order. A `customer.subscription.updated` might arrive before `customer.subscription.created`.
**Why it happens:** Stripe uses distributed event dispatch with retry queues.
**How to avoid:** Use `upsert` (not `create`) for all webhook handlers. Design handlers to be idempotent and order-independent. Store `stripeEventId` with unique constraint to deduplicate.
**Warning signs:** Prisma unique constraint violations on webhook processing.

### Pitfall 2: Webhook Timeout (30 seconds)
**What goes wrong:** If the webhook endpoint does not respond within 30 seconds, Stripe marks it as failed and retries.
**Why it happens:** Heavy processing (DB writes, external API calls) in the webhook handler.
**How to avoid:** Return 200 immediately after signature verification and event logging. Queue heavy processing via QStash (existing pattern).
**Warning signs:** Stripe Dashboard shows high webhook failure rate.

### Pitfall 3: Race Condition on Credit Deduction
**What goes wrong:** Two concurrent OCR requests both check credits, both see 1 remaining, both deduct -- resulting in negative balance.
**Why it happens:** Read-then-write without locking.
**How to avoid:** Use Prisma `$transaction` with serializable isolation or a database-level atomic decrement. Alternatively, use an advisory lock or a `SELECT ... FOR UPDATE` on the credit record.
**Warning signs:** Negative credit balances in the ledger.

### Pitfall 4: Missing Stripe Customer Creation
**What goes wrong:** Trying to create a Checkout session without a Stripe customer, or creating duplicate customers for the same org.
**Why it happens:** Customer creation not tied to org creation lifecycle.
**How to avoid:** Create Stripe customer when org is created (or lazily on first billing action). Store `stripeCustomerId` on the Organization or Subscription model. Use `metadata.organizationId` for reverse lookup.
**Warning signs:** Multiple Stripe customers for one org.

### Pitfall 5: Trial Period Not Matching Subscription Period
**What goes wrong:** Local trial tracking diverges from Stripe's trial state.
**Why it happens:** Hardcoding trial dates locally instead of reading from Stripe subscription.
**How to avoid:** Set trial via `subscription_data.trial_period_days: 14` on Checkout session. Read trial state from `subscription.trial_end` via webhook. Stripe sends `customer.subscription.trial_will_end` 3 days before expiry.
**Warning signs:** App shows "trial active" but Stripe has already ended the trial.

### Pitfall 6: Currency Mismatch
**What goes wrong:** Creating prices in wrong currency or converting grosze incorrectly.
**Why it happens:** Stripe uses smallest unit (grosze for PLN) but developer forgets.
**How to avoid:** All prices in grosze. 199 PLN = 19900 grosze in Stripe. This aligns with the project's existing integer grosze convention (no conversion needed).
**Warning signs:** Prices showing as 1/100th of expected amount.

### Pitfall 7: Stripe API Version Mismatch
**What goes wrong:** Using legacy APIs or getting unexpected response shapes.
**Why it happens:** Default API version differs from what webhook events use.
**How to avoid:** Pin API version in Stripe client constructor: `apiVersion: "2025-06-30.basil"`. Use the same version in webhook endpoint construction. Legacy usage records API removed in 2025-03-31.basil -- must use Meters.
**Warning signs:** TypeScript type mismatches, missing fields in responses.

## Code Examples

### Stripe Checkout Session Creation (Subscription)

```typescript
// Source: Stripe official docs - Build subscriptions with Checkout
const session = await stripe.checkout.sessions.create({
  customer: stripeCustomerId,
  mode: "subscription",
  line_items: [
    {
      price: priceId, // Stripe price ID for the selected tier
      quantity: 1,    // Platform fee (flat)
    },
  ],
  subscription_data: {
    trial_period_days: isNewOrg ? 14 : undefined,
    metadata: { organizationId },
  },
  success_url: `${appUrl}/settings?tab=billing&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${appUrl}/settings?tab=billing`,
  currency: "pln",
  allow_promotion_codes: true,
});
// Redirect user to session.url
```

### Stripe Billing Portal Session

```typescript
// Source: Stripe official docs - Customer portal
const portalSession = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${appUrl}/settings?tab=billing`,
});
// Redirect user to portalSession.url
```

### Stripe Meter Event for OCR

```typescript
// Source: Stripe Meters API docs
await stripe.billing.meterEvents.create({
  event_name: "ocr_extraction",
  payload: {
    stripe_customer_id: stripeCustomerId,
    value: "1", // 1 extraction = 1 credit
  },
});
```

### Webhook Signature Verification

```typescript
// Source: Stripe webhook docs
import Stripe from "stripe";

const event = stripe.webhooks.constructEvent(
  rawBody,           // Raw request body as string
  signature,         // stripe-signature header
  webhookSecret,     // STRIPE_WEBHOOK_SECRET env var
);
// Throws Stripe.errors.StripeSignatureVerificationError on failure
```

### Database Schema Design

```prisma
// packages/db/prisma/schema/billing.prisma

model Subscription {
  id                       String             @id @default(cuid())
  organizationId           String             @unique
  stripeCustomerId         String
  stripeSubscriptionId     String             @unique
  stripeSubscriptionItemId String?
  stripePriceId            String?
  tier                     SubscriptionTier
  status                   SubscriptionStatus
  currentPeriodStart       DateTime
  currentPeriodEnd         DateTime
  trialEnd                 DateTime?
  cancelAtPeriodEnd        Boolean            @default(false)
  seatCount                Int                @default(1)
  createdAt                DateTime           @default(now())
  updatedAt                DateTime           @updatedAt

  organization             Organization       @relation(fields: [organizationId], references: [id])

  @@index([stripeCustomerId])
  @@index([status])
}

model OcrCreditLedger {
  id             String   @id @default(cuid())
  organizationId String
  credits        Int      // positive = allocation/top-up, negative = usage
  reason         String   // MONTHLY_ALLOWANCE, OCR_EXTRACTION, TOP_UP, ADJUSTMENT
  periodStart    DateTime
  periodEnd      DateTime
  stripeEventId  String?  // Link to meter event or invoice
  createdAt      DateTime @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@index([organizationId, periodStart, periodEnd])
}

model StripeEvent {
  id            String    @id @default(cuid())
  stripeEventId String    @unique
  eventType     String
  payloadJson   Json
  processedAt   DateTime?
  createdAt     DateTime  @default(now())

  @@index([eventType])
}

enum SubscriptionTier {
  STARTER
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  UNPAID
  INCOMPLETE
  INCOMPLETE_EXPIRED
  PAUSED
}
```

## Stripe Product/Price Structure (Recommended)

Stripe Dashboard configuration (prices in grosze for PLN):

| Product | Price Name | Amount (grosze) | Billing | Type |
|---------|-----------|-----------------|---------|------|
| Contractor Ops Starter | starter_monthly | 19900 | monthly | recurring/flat |
| Contractor Ops Pro | pro_monthly | 44900 | monthly | recurring/flat |
| Contractor Ops Enterprise | enterprise_monthly | 84900 | monthly | recurring/flat |
| Per-Seat Add-on Starter | starter_seat | 1900 | monthly | recurring/per-seat |
| Per-Seat Add-on Pro | pro_seat | 2900 | monthly | recurring/per-seat |
| Per-Seat Add-on Enterprise | enterprise_seat | 4900 | monthly | recurring/per-seat |
| OCR Credit Top-up | ocr_topup_10 | TBD | one-time | one-time |
| OCR Meter | ocr_extraction | metered | monthly | usage-based |

**Per-seat pricing approach:** The flat platform fee covers included seats (2/5/15). The per-seat add-on is a separate subscription item with `quantity` set to the number of extra seats (total - included). Seat count updates happen via `stripe.subscriptions.update` with quantity change.

## Webhook Events to Handle

| Event | Purpose | Handler Action |
|-------|---------|----------------|
| `checkout.session.completed` | New subscription or top-up purchased | Create/update local Subscription record, allocate initial credits |
| `customer.subscription.created` | Subscription created (may come after checkout) | Upsert Subscription record |
| `customer.subscription.updated` | Plan change, status change, trial end | Upsert Subscription record, update tier/status |
| `customer.subscription.deleted` | Subscription canceled at period end | Mark subscription as canceled |
| `customer.subscription.trial_will_end` | 3 days before trial ends | Trigger in-app + email notification (Stripe only sends this at 3 days) |
| `invoice.paid` | Successful payment | Update subscription status to active, log payment |
| `invoice.payment_failed` | Payment declined | Update status to past_due, notify admin |
| `invoice.payment_action_required` | 3DS/SCA required | Notify admin to complete authentication |

**Note on trial notifications:** Stripe only sends `trial_will_end` at 3 days before expiry. For 7-day and 1-day notifications (D-10), implement a daily cron job (QStash scheduled) that checks `trialEnd` dates and dispatches notifications via the existing notification service.

## Credit Reset Strategy (Claude's Discretion)

**Recommendation: Billing cycle alignment.** Reset credits at each billing period start (when `invoice.paid` fires for the subscription renewal), not on a calendar month boundary. This is simpler and aligns with Stripe's metering periods.

When `invoice.paid` fires for a subscription renewal:
1. Insert a positive `OcrCreditLedger` entry for the tier's allowance
2. The meter resets automatically in Stripe (per billing period)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Usage records API (`stripe.subscriptionItems.createUsageRecord`) | Stripe Meters (`stripe.billing.meterEvents.create`) | API version 2025-03-31.basil | Legacy API removed; all new metered billing must use Meters |
| Embedded card Elements for checkout | Stripe Checkout (hosted) with flexible billing | 2025 | Simpler integration, better conversion, automatic SCA/3DS |
| Custom billing portal | Stripe Billing Portal (hosted) | 2020+ | Free, PCI-compliant, eliminates custom payment UI |
| Manual proration calculation | `stripe.invoices.createPreview` | Current | Accurate prorations with tax, coupons, mid-cycle changes |

**Deprecated/outdated:**
- `stripe.subscriptionItems.createUsageRecord`: Removed in API 2025-03-31.basil. Use Meters.
- `stripe.checkout.sessions.create` without `billing_mode`: Should use `subscription_data.billing_mode.type: "flexible"` for predictable behavior on newer API versions.

## Open Questions

1. **Top-up bundle sizes and pricing**
   - What we know: Manual purchase for all tiers, auto-renewal for Pro/Enterprise (D-13)
   - What's unclear: Specific bundle sizes (10? 25? 50?) and price per credit
   - Recommendation: Start with a single bundle size (e.g., 10 credits) at a reasonable markup. This is Claude's discretion -- implement with a configurable `CREDIT_BUNDLES` constant that can be adjusted without code changes

2. **Per-seat metering vs. manual quantity**
   - What we know: Seats have included tiers (2/5/15) with per-seat overage pricing
   - What's unclear: Whether to use Stripe metered pricing for seats or manual quantity updates
   - Recommendation: Use manual quantity on a separate subscription item. Update quantity when members are added/removed via a hook in the member creation flow. Metered pricing adds complexity without benefit for seats (they are predictable, not usage-based)

3. **Billing portal configuration**
   - What we know: Admin needs payment methods, invoices, cancellation (D-22)
   - What's unclear: What to allow/restrict in portal configuration
   - Recommendation: Configure portal via Stripe Dashboard to allow: update payment method, view invoices, cancel subscription. Disallow: plan changes (handle in-app for proration preview UX)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v24.11.0 | -- |
| pnpm | Package manager | Yes | 9.15.0 | -- |
| Stripe CLI | Local webhook testing | Yes | 1.39.0 | -- |
| Stripe account | All billing features | TBD | -- | Must create/configure before implementation |
| Neon PostgreSQL | Billing schema | Yes (existing) | -- | -- |
| QStash (Upstash) | Async webhook processing | Yes (existing) | -- | -- |

**Missing dependencies with no fallback:**
- Stripe account must be configured with: Products, Prices, Meter, Webhook endpoint, Billing Portal configuration, and API keys in `.env`

**Missing dependencies with fallback:**
- None -- all infrastructure is available

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (not yet configured in project) |
| Config file | none -- see Wave 0 |
| Quick run command | `pnpm exec vitest run --reporter=verbose` |
| Full suite command | `pnpm exec vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-01 | Subscription tier management with correct pricing | unit | `vitest run packages/api/src/services/__tests__/billing-service.test.ts -t "tier management"` | No -- Wave 0 |
| BILL-02 | Proration preview calculation and plan change | unit | `vitest run packages/api/src/services/__tests__/billing-service.test.ts -t "proration"` | No -- Wave 0 |
| BILL-03 | Trial period setup and notification scheduling | unit | `vitest run packages/api/src/services/__tests__/billing-service.test.ts -t "trial"` | No -- Wave 0 |
| BILL-04 | Meter event creation on OCR extraction | unit | `vitest run packages/api/src/services/__tests__/credit-service.test.ts -t "meter event"` | No -- Wave 0 |
| BILL-05 | Credit allowance per tier and top-up logic | unit | `vitest run packages/api/src/services/__tests__/credit-service.test.ts -t "allowance"` | No -- Wave 0 |
| BILL-06 | Hard-block when credits exhausted | unit | `vitest run packages/api/src/services/__tests__/credit-service.test.ts -t "exhausted"` | No -- Wave 0 |
| BILL-07 | Webhook idempotent processing | unit | `vitest run packages/api/src/services/__tests__/billing-webhook.test.ts` | No -- Wave 0 |
| BILL-08 | Billing portal session creation | unit | `vitest run packages/api/src/services/__tests__/billing-service.test.ts -t "portal"` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm exec vitest run --reporter=verbose` (billing tests only)
- **Per wave merge:** Full test suite
- **Phase gate:** All billing tests green + manual Stripe CLI webhook test

### Wave 0 Gaps

- [ ] `packages/api/vitest.config.ts` -- vitest configuration for API package
- [ ] `packages/api/src/services/__tests__/billing-service.test.ts` -- covers BILL-01, BILL-02, BILL-03, BILL-08
- [ ] `packages/api/src/services/__tests__/credit-service.test.ts` -- covers BILL-04, BILL-05, BILL-06
- [ ] `packages/api/src/services/__tests__/billing-webhook.test.ts` -- covers BILL-07
- [ ] `packages/api/src/services/__tests__/test-helpers.ts` -- Stripe mock/stub utilities
- [ ] Framework install: `pnpm add -D vitest --filter @contractor-ops/api`

## Sources

### Primary (HIGH confidence)
- [Stripe Meters API Reference](https://docs.stripe.com/api/billing/meter) -- Meter event creation, rate limits, constraints
- [Stripe Meter Events API](https://docs.stripe.com/api/billing/meter-event) -- `meterEvents.create` parameters and idempotency
- [Record usage for billing with the API](https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api) -- Node.js usage recording patterns, 35-day window constraint
- [Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) -- Complete event lifecycle for subscriptions
- [Build subscriptions with Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions) -- Checkout session creation for subscriptions
- [How subscriptions work](https://docs.stripe.com/billing/subscriptions/overview) -- Subscription lifecycle, statuses, trial handling
- npm registry -- `stripe@21.0.1`, `@stripe/stripe-js@9.0.1` (verified 2026-04-01)

### Secondary (MEDIUM confidence)
- [Stripe webhook best practices](https://docs.stripe.com/webhooks) -- Retry behavior, signature verification, timeout handling
- [Usage-based billing overview](https://docs.stripe.com/billing/subscriptions/usage-based) -- Meters vs legacy usage records, migration notes
- [Stripe payment integration guide 2026](https://www.digitalapplied.com/blog/stripe-payment-integration-developer-guide-2026) -- Current best practices cross-reference

### Tertiary (LOW confidence)
- None -- all findings verified with official Stripe documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Stripe SDK versions verified against npm registry, API version confirmed current
- Architecture: HIGH -- Patterns derived from official Stripe docs and existing project infrastructure
- Pitfalls: HIGH -- Documented in official Stripe docs (webhook ordering, timeout, idempotency)

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (Stripe APIs are stable, 30-day validity appropriate)
