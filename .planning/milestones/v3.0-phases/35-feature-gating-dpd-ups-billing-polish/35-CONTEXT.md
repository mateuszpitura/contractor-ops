# Phase 35: Feature Gating + DPD/UPS + Billing Polish - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Paywall is enforced per subscription tier, remaining courier integrations (DPD + UPS) ship using the proven CourierClient pattern, and billing UX is polished with a usage dashboard for launch. Feature gating middleware (BILL-09), usage dashboard (BILL-10), DPD integration (EQUIP-06), and UPS integration (EQUIP-07).

</domain>

<decisions>
## Implementation Decisions

### Feature Gating Strategy
- **D-01:** Hybrid gating — Next.js middleware for page-level gates (redirect to upgrade page for entirely gated pages) + tRPC `requireTier('PRO')` middleware for API-level gates (inline upgrade prompts for sub-features within accessible pages)
- **D-02:** Inline banner at trigger point for upgrade prompts — small banner replaces the gated UI element: "This feature requires Pro — Upgrade" with diamond icon. No modal, no page redirect. Consistent with Phase 28 D-16
- **D-03:** Lazy check on next action for mid-session tier changes — subscription state is cached per-request from DB. If tier changes (downgrade, trial expiry), the next action against a gated feature gets the upgrade prompt. No real-time push needed
- **D-04:** Feature gate config lives in code constants — PLAN_CONFIG already has features/excludedFeatures per tier. Feature gates reference these constants. Type-safe, changes require deploy but tier structure rarely changes

### DPD/UPS Delivery Model
- **D-05:** Carrier-specific param types — separate InPostParams, DPDParams, UPSParams extending a base interface. More type-safe than optional fields on a single type. Each carrier client accepts its own param type
- **D-06:** Abstract parcel sizes (small/medium/large) mapped per carrier — each courier client maps abstract sizes to carrier-specific dimensions/weight limits. Consistent UX across carriers, carrier details hidden from admin
- **D-07:** Polling only for DPD/UPS status tracking — QStash-scheduled polling (every 30-60 min), no webhook registration. DPD/UPS webhook setup is more complex and polling is sufficient for door-to-door delivery timelines
- **D-08:** Org-level credentials in credential store — each org configures their own DPD/UPS account in Settings > Integrations, stored encrypted in the existing credential store. Multi-tenant — different orgs use different courier accounts

### Courier Selection UX
- **D-09:** Carrier dropdown with dynamic form — dropdown at top of shipment form. Selecting InPost shows Paczkomat picker + size. Selecting DPD/UPS shows delivery address fields + size. Form sections adapt to chosen carrier
- **D-10:** Only configured carriers shown in dropdown — carriers without org-level credentials are hidden. No dead-end selections, clean UX
- **D-11:** Org sets default return carrier — org configures a preferred return carrier in Settings. All portal return flows use that carrier regardless of outbound carrier. Admin control over return logistics

### Usage Dashboard (BILL-10)
- **D-12:** KPI cards row + details below layout — top row: 4 cards (Current Plan, Active Contractors/Seats, OCR Credits, Next Billing Date). Below: plan comparison table with current tier highlighted + upgrade CTA. Matches existing Dashboard page KPI pattern
- **D-13:** OCR credits shown as progress bar with numbers — visual bar showing used/total (e.g., "73/100 credits used") with color shifting green → yellow → red as credits deplete. Plus "Buy more" button when below threshold
- **D-14:** Current billing period only — no historical usage charts at launch. Historical can be added later; Stripe hosted portal covers billing history
- **D-15:** Seat count = active contractors, automatically calculated — no manual seat management. Dashboard displays "X active contractors / Y included, Z billed" alongside tier info
- **D-16:** Seat count syncs to Stripe on contractor create/archive — when a contractor is added or archived/deactivated, automatically update Stripe subscription quantity to match active contractor count. Proration handled by Stripe

### Claude's Discretion
- DPD/UPS API client implementation details (authentication methods, API version selection)
- DPD/UPS status mapping to unified ShipmentStatus enum
- Exact abstract size → carrier dimension/weight mappings
- Feature gate error response format and frontend error boundary design
- Usage dashboard responsive layout and card styling
- Progress bar color threshold breakpoints
- Polling frequency tuning (30 vs 60 min)
- Carrier credential setup form design in Settings > Integrations
- Default return carrier setting location within Settings

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Billing requirements
- `.planning/REQUIREMENTS.md` — BILL-09 (feature gating middleware), BILL-10 (usage dashboard)
- `.planning/ROADMAP.md` §Phase 35 — Success criteria, dependencies on Phase 28/30/33

### Billing foundation (Phase 28)
- `packages/db/prisma/schema/billing.prisma` — Subscription, OcrCreditLedger, StripeEvent models, SubscriptionTier/SubscriptionStatus enums
- `packages/api/src/routers/billing.ts` — Billing router with PLAN_CONFIG (tier features, pricing, excluded features)
- `packages/api/src/services/billing-service.ts` — Stripe integration (checkout, portal, proration, seat count update)
- `packages/api/src/services/credit-service.ts` — OCR credit balance queries
- `packages/api/src/services/billing-constants.ts` — TIER_CREDIT_ALLOWANCE, KNOWN_SUBSCRIPTION_PRICE_IDS, KNOWN_TOPUP_PRICE_IDS
- `packages/api/src/services/billing-webhook.ts` — Stripe webhook event handling
- `.planning/phases/28-stripe-billing-foundation/28-CONTEXT.md` — Phase 28 decisions (tier pricing D-01–D-06, trial D-07–D-10, OCR credits D-11–D-14, billing UX D-15–D-22)

### Equipment & courier requirements
- `.planning/REQUIREMENTS.md` — EQUIP-06 (DPD integration), EQUIP-07 (UPS integration)
- `.planning/phases/30-equipment-tracking-foundation/30-CONTEXT.md` — Equipment status model, unified ShipmentStatus enum, workflow auto-triggers
- `.planning/phases/33-inpost-courier-integration/33-CONTEXT.md` — CourierClient pattern, InPost implementation decisions

### Courier infrastructure (Phase 33)
- `packages/api/src/services/courier/courier-client.ts` — CourierClient interface (createShipment, getLabel, getStatus, cancelShipment), CreateShipmentParams, CourierShipmentResult
- `packages/api/src/services/courier/inpost-client.ts` — InPostClient reference implementation
- `packages/api/src/services/courier/inpost-status-mapper.ts` — Status mapping pattern to follow for DPD/UPS
- `packages/api/src/services/courier/inpost-polling-service.ts` — QStash polling pattern to replicate for DPD/UPS
- `packages/api/src/services/courier/inpost-webhook-handler.ts` — Webhook handler (reference only, DPD/UPS use polling)

### Equipment foundation
- `packages/db/prisma/schema/equipment.prisma` — Equipment, Shipment, ShipmentEvent models
- `packages/api/src/routers/equipment.ts` — Equipment/shipment CRUD, carrier field (string type)
- `packages/api/src/services/equipment-workflow.ts` — Workflow auto-completion on shipment delivery

### Auth/middleware
- `packages/api/src/middleware/rbac.ts` — adminProcedure pattern (reference for requireTier middleware)
- `packages/api/src/middleware/tenant.ts` — tenantProcedure with org context (subscription data accessible here)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CourierClient` interface: Proven with InPost — DPD/UPS clients implement the same interface
- `InPostClient`: Reference implementation for new courier clients
- `inpost-status-mapper.ts`: Pattern for mapping carrier-specific statuses to unified ShipmentStatus enum
- `inpost-polling-service.ts`: QStash polling pattern — replicate for DPD/UPS
- `PLAN_CONFIG` in billing.ts: Already defines features/excludedFeatures per tier — foundation for feature gates
- `billing-service.ts`: `updateSubscriptionSeatCount` already exists — use for auto-sync on contractor changes
- `credit-service.ts`: `getCreditBalance` for OCR credit display on dashboard
- Settings page tab infrastructure: Ready for billing dashboard content

### Established Patterns
- Multi-tenant: All queries scoped by organizationId via AsyncLocalStorage + Prisma extension
- tRPC middleware chain: `tenantProcedure` → `adminProcedure` — `requireTier` adds another layer
- QStash for scheduled tasks: KSeF sync, InPost polling — same pattern for DPD/UPS polling
- Credential store: OAuth credential management via integration framework — use for courier API tokens
- Fire-and-forget: Integration side-effects never block user mutations
- Carrier field is string (not enum) on Shipment model — supports adding DPD/UPS as carrier values

### Integration Points
- Contractor router: Hook into contractor create/archive to sync seat count to Stripe
- Equipment router: Extend shipment creation with carrier selection and carrier-specific params
- Billing router: Add usage dashboard endpoint(s)
- Settings page: Billing tab gets usage dashboard, Integrations tab gets DPD/UPS credential setup
- Next.js middleware: Page-level feature gating
- tRPC middleware: Procedure-level feature gating

</code_context>

<specifics>
## Specific Ideas

- Seat count is NOT manually managed — it's automatically calculated from active contractors in the org, synced to Stripe on contractor create/archive
- Diamond icon (from Phase 28 D-16) marks premium features throughout the UI
- Progress bar for OCR credits shifts green → yellow → red as credits deplete
- Only configured carriers appear in the carrier dropdown — no dead-end UX

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-feature-gating-dpd-ups-billing-polish*
*Context gathered: 2026-04-05*
