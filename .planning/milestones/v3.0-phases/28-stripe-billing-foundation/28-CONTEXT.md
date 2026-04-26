# Phase 28: Stripe Billing Foundation - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Subscription lifecycle (Starter/Pro/Enterprise with flat + per-seat pricing), AI/OCR credit metering via Stripe Meters, free trial with soft-block conversion, Stripe webhook-driven state management, and Stripe-hosted billing portal access. This phase builds the billing infrastructure and in-app plan management UI. Feature gating middleware (BILL-09) and usage dashboard (BILL-10) are Phase 35.

</domain>

<decisions>
## Implementation Decisions

### Pricing tier structure
- **D-01:** Three tiers: Starter (199 PLN/mo), Pro (449 PLN/mo), Enterprise (849 PLN/mo) — flat platform fee + per-seat add-on
- **D-02:** Included seats before per-seat charges: Starter: 2, Pro: 5, Enterprise: 15
- **D-03:** Per-seat pricing is tier-specific: Starter: 19 PLN/seat, Pro: 29 PLN/seat, Enterprise: 49 PLN/seat
- **D-04:** Hybrid differentiation — tiers differ by both capacity limits AND feature access
- **D-05:** Feature gates: Starter = core contractor ops (CRUD, contracts, invoices, approvals, payments). Pro = all Starter + integrations + OCR + advanced workflows. Enterprise = all Pro + audit log export + API access
- **D-06:** OCR credit allowance per tier: Starter: 20/mo, Pro: 100/mo, Enterprise: 500/mo

### Trial experience
- **D-07:** 14-day free trial for all new orgs
- **D-08:** Trial gets full Pro-tier features but capacity limited: 2 users, 5 contractors, 5 OCR credits
- **D-09:** Trial end triggers immediate soft block — app works but every action shows upgrade modal. Data preserved, persistent nudge until subscription starts
- **D-10:** Trial-ending notifications at 7, 3, and 1 days before expiry — in-app banner + email to billing contact

### OCR credit model
- **D-11:** 1 credit = 1 invoice extraction, regardless of page count (per-extraction, not per-page)
- **D-12:** Metering via Stripe Meters — each OCR call reports a usage event to Stripe
- **D-13:** Top-up bundles: manual purchase available for all tiers. Pro/Enterprise can optionally enable auto-renewal with configurable threshold and bundle size
- **D-14:** Hard-block when credits exhausted: inline message at OCR trigger point ("OCR credits exhausted") with upgrade and top-up buttons. Rest of app works normally

### Billing UX
- **D-15:** Billing management lives as a new "Billing" sub-tab under Settings (alongside Profile, Users, Roles, etc.)
- **D-16:** Upgrade prompts: contextual inline prompts at feature gates. Premium features marked with a diamond icon throughout the UI
- **D-17:** Global banner appears only during trial-ending period (last 7 days) — "X days left in trial — Upgrade"
- **D-18:** In-app plan comparison UI with feature matrix and pricing, then redirect to Stripe Checkout for payment collection
- **D-19:** Admin upgrade/downgrade with proration preview shown before confirming via Stripe Checkout

### Webhook & infrastructure
- **D-20:** Stripe billing is a separate bounded context — dedicated webhook route (`/api/webhooks/stripe`), NOT through the integration adapter pipeline
- **D-21:** Stripe webhook events (subscription changes, payment failures, trial endings) update internal subscription state with database-level idempotency
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Billing requirements
- `.planning/REQUIREMENTS.md` — BILL-01 through BILL-08 define acceptance criteria for this phase
- `.planning/ROADMAP.md` §Phase 28 — Success criteria and dependency info

### Existing infrastructure
- `packages/integrations/src/services/ocr-service.ts` — Current OCR extraction service that needs credit checking integration
- `packages/integrations/src/adapters/claude-ocr-adapter.ts` — Claude Vision OCR adapter where usage events will be emitted
- `apps/web/src/app/api/webhooks/[provider]/route.ts` — Existing webhook infrastructure (Stripe gets its own route, not this one)
- `packages/db/prisma/schema/organization.prisma` — Organization model that needs subscription fields
- `packages/api/src/services/ocr-extraction.ts` — OCR extraction orchestration in API layer

### Project context
- `.planning/PROJECT.md` — Key decisions: QStash for async, AES-256-GCM encryption, provider adapter pattern
- `.planning/STATE.md` — Decision: "Stripe billing is separate bounded context"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/integrations/` — Full integration framework with adapters, credential store, webhook pipeline, health monitoring. Stripe does NOT use this (separate bounded context) but patterns are informative
- `apps/web/src/app/api/webhooks/` — Webhook route infrastructure with QStash async processing
- `packages/db/prisma/schema/organization.prisma` — Organization model with `billingEmail` field already present
- Notification system (Phase 7) — in-app + email notifications can be reused for trial-ending alerts
- Settings page with tab navigation — existing pattern for adding the Billing sub-tab

### Established Patterns
- Multi-tenant: all queries scoped to `organization_id` via AsyncLocalStorage + Prisma extension
- tRPC routers in `packages/api/src/routers/` — new billing router follows same pattern
- Prisma multi-file schema — new billing models go in `packages/db/prisma/schema/billing.prisma`
- QStash for async processing — webhook processing can use same pattern
- Integer grosze for all money values — Stripe amounts also in smallest currency unit

### Integration Points
- OCR service (`ocr-service.ts`) — credit check must happen before extraction call
- Organization model — needs subscription status, trial dates, Stripe customer ID
- Settings page — new Billing tab alongside existing tabs
- Notification service — trial-ending notifications via existing in-app + email channels
- Auth middleware — subscription status check for soft-block enforcement

</code_context>

<specifics>
## Specific Ideas

- Premium features should be marked with a diamond icon throughout the UI — visual indicator that a feature requires a higher tier
- Global upgrade banner appears only during the trial-ending period (last 7 days), not permanently
- Soft block on trial end = app works but every action shows upgrade modal, not a hard lockout
- Prices (199/449/849 PLN) and all tier parameters configurable in Stripe dashboard without code changes

</specifics>

<deferred>
## Deferred Ideas

- **BILL-09:** Feature gating middleware with graceful upgrade prompts — Phase 35
- **BILL-10:** Usage dashboard with current plan, seat count, OCR credits used/remaining, billing date — Phase 35
- Open banking / payment initiation for contractor payments — v4+
- Stripe Connect for contractor payouts — out of scope (Polish B2B uses bank transfers)

</deferred>

---

*Phase: 28-stripe-billing-foundation*
*Context gathered: 2026-04-01*
