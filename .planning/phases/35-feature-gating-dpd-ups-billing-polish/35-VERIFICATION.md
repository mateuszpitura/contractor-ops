---
phase: 35-feature-gating-dpd-ups-billing-polish
verified: 2026-04-05T12:00:00Z
status: human_needed
score: 13/13 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 12/13
  gaps_closed:
    - "Carrier credential forms let admin save DPD/UPS API credentials with test connection — testCourierConnection procedure added to equipment router at line 1533 with full implementation, input validation, and 4-case test suite"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to Settings > Integrations, expand a carrier credential card, fill in credentials, and click 'Test connection'"
    expected: "Button shows loading spinner, then a success or failure toast ('Connection verified' or 'Connection failed') — no tRPC error"
    why_human: "Runtime behavior of the new testCourierConnection procedure against actual UI rendering requires a running app"
  - test: "Create a DPD or UPS shipment for an equipment item with a PRO subscription"
    expected: "Shipment is created, tracking number appears, equipment status changes to IN_TRANSIT"
    why_human: "End-to-end flow requires live DPD/UPS sandbox credentials and a configured courier config in DB"
  - test: "Wrap a UI element with FeatureGate requiredTier='Pro' while org is on STARTER plan"
    expected: "UpgradeInlineBanner renders with Gem icon, feature name, and 'Upgrade Plan' CTA linking to /settings?tab=billing"
    why_human: "Visual rendering and accurate tier state require a running app with a STARTER org session"
  - test: "Navigate to Settings > Billing with a PRO subscription"
    expected: "UsageDashboard renders 4 KPI cards with real data: current plan name, active contractor count, OCR credits progress bar in correct color, and next billing date"
    why_human: "Dashboard requires live subscription data; color thresholds and formatting require visual inspection"
---

# Phase 35: Feature Gating, DPD/UPS Couriers, Billing Polish — Verification Report

**Phase Goal:** Paywall is enforced per subscription tier, remaining courier integrations ship, and billing UX is polished for launch
**Verified:** 2026-04-05T12:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (previous status: gaps_found, score: 12/13)

## Re-verification Summary

| Item | Previous | Now | Change |
|------|----------|-----|--------|
| `testCourierConnection` tRPC procedure | MISSING | VERIFIED | Gap closed |
| All other 12 truths | VERIFIED | VERIFIED (regression check passed) | No change |

### Gap Closed: testCourierConnection

The previously missing `testCourierConnection` procedure has been added to `packages/api/src/routers/equipment.ts` (line 1533). Verification:

- **Exists:** `testCourierConnection: adminProcedure` at line 1533
- **Substantive:** 29-line implementation — accepts `z.union([dpdConfigSchema, upsConfigSchema])`, calls `getCourierClient(carrier, credentials)`, probes with `client.getStatus("TEST_CONNECTION_PROBE")`, returns `{ success: true }` when auth succeeds (including when probe returns 404/not-found), and `{ success: false, error: "Connection failed. Check your credentials." }` on auth failure — sanitized, no internal leak
- **Wired:** `getCourierClient` imported at line 33; schemas imported at lines 15-16; frontend `carrier-credential-form.tsx` calls it via `equipmentProxy.testCourierConnection.mutationOptions({ onSuccess, onError })` with toast feedback at lines 157-166
- **Tests:** `packages/api/src/routers/__tests__/equipment-test-connection.test.ts` — 339 lines, 4 cases: DPD valid credentials, UPS valid credentials, 404-as-success (auth succeeded), and 401 auth failure

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | tRPC procedures gated with requireTier reject requests from orgs with insufficient tier | VERIFIED | `tier.ts` line 31: `requireTier` checks TIER_RANK and throws TIER_REQUIRED FORBIDDEN with requiredTier/currentTier |
| 2  | requireTier returns structured JSON error with requiredTier and currentTier fields | VERIFIED | `tier.ts` lines 40-46, 52-58: `JSON.stringify({ type: "TIER_REQUIRED", requiredTier, currentTier })` |
| 3  | getUsageDashboard endpoint returns subscription, credits, active contractors, and plan config in one call | VERIFIED | `billing.ts` lines 330-353: `Promise.all([getSubscription, getCreditBalance, prisma.contractor.count])` |
| 4  | DPDClient implements CourierClient interface with createShipment, getLabel, getStatus, cancelShipment | VERIFIED | `dpd-client.ts`: `export class DPDClient implements CourierClient` |
| 5  | UPSClient implements CourierClient interface with OAuth 2.0 token caching | VERIFIED | `ups-client.ts`: `UPSClient implements CourierClient` with `tokenCache` and `expiresAt - 5 * 60_000` |
| 6  | DPD and UPS status mappers convert carrier-specific statuses to unified ShipmentStatus values | VERIFIED | DPD_STATUS_MAP has 9 entries; UPS_STATUS_MAP has 7 entries |
| 7  | Polling services replicate the InPost polling pattern for DPD and UPS shipments | VERIFIED | `dpd-polling-service.ts:58`, `ups-polling-service.ts:58` export `pollDpdShipmentStatuses` / `pollUpsShipmentStatuses` |
| 8  | Carrier-specific Zod schemas validate DPD address+size and UPS address+size+serviceCode inputs | VERIFIED | `validators/src/equipment.ts` lines 250-315: all 5 schemas present |
| 9  | Admin can create DPD/UPS shipments via tRPC gated to PRO tier | VERIFIED | `equipment.ts` lines 1101-1103, 1288-1290: both procedures chain `.use(requireTier("PRO"))` |
| 10 | Courier polling cron polls all three carriers with error isolation | VERIFIED | `inpost-status-poll/route.ts` lines 103, 112: both DPD/UPS poll calls with `.catch()` error isolation |
| 11 | FeatureGate wrapper renders children when tier qualifies, UpgradeInlineBanner when it does not | VERIFIED | `feature-gate.tsx` uses TIER_RANK comparison, renders `<UpgradeInlineBanner>` on insufficient tier |
| 12 | Usage dashboard displays 4 KPI cards: Current Plan, Active Seats, OCR Credits, Next Billing Date | VERIFIED | `usage-dashboard.tsx` line 82: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, all 4 card components rendered |
| 13 | Carrier credential forms let admin save DPD/UPS API credentials with test connection | VERIFIED | `saveCourierConfig` wired correctly; `testCourierConnection` procedure now exists at `equipment.ts:1533`, called from `carrier-credential-form.tsx:157-166` with success/error toasts |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/middleware/tier.ts` | requireTier factory + proProcedure/enterpriseProcedure | VERIFIED | Exports requireTier, proProcedure, enterpriseProcedure; TIER_RANK Record |
| `packages/api/src/middleware/__tests__/tier.test.ts` | Unit tests (min 60 lines, 7+ tests) | VERIFIED | 228 lines, 8 test blocks |
| `packages/api/src/routers/billing.ts` | getUsageDashboard tRPC endpoint | VERIFIED | getUsageDashboard with Promise.all aggregation |
| `packages/api/src/routers/__tests__/billing-dashboard.test.ts` | Unit tests (min 40 lines) | VERIFIED | 223 lines, 5 test blocks |
| `packages/api/src/services/courier/dpd-client.ts` | DPDClient implementing CourierClient | VERIFIED | `export class DPDClient implements CourierClient`; DPD_SIZE_MAP; sandbox URL |
| `packages/api/src/services/courier/ups-client.ts` | UPSClient with OAuth token caching | VERIFIED | OAuth getToken, tokenCache, 5*60_000 buffer, sandbox/production URLs |
| `packages/api/src/services/courier/dpd-status-mapper.ts` | DPD_STATUS_MAP + mapDpdStatus | VERIFIED | 9 status entries, mapDpdStatus exported |
| `packages/api/src/services/courier/ups-status-mapper.ts` | UPS_STATUS_MAP + mapUpsStatus | VERIFIED | 7 type codes, mapUpsStatus exported |
| `packages/api/src/services/courier/dpd-polling-service.ts` | pollDpdShipmentStatuses | VERIFIED | Exported at line 58 |
| `packages/api/src/services/courier/ups-polling-service.ts` | pollUpsShipmentStatuses | VERIFIED | Exported at line 58 |
| `packages/api/src/services/courier/carrier-factory.ts` | getCourierClient factory | VERIFIED | `export function getCourierClient` at line 21 |
| `packages/api/src/services/courier/courier-client.ts` | DPDShipmentParams, UPSShipmentParams, AddressShipmentParams | VERIFIED | All three interfaces at lines 80-96 |
| `packages/validators/src/equipment.ts` | dpdShipmentCreateSchema + upsShipmentCreateSchema | VERIFIED | Both schemas at lines 265 and 292 |
| `packages/api/src/routers/equipment.ts` | createDpdShipment, createUpsShipment, saveCourierConfig, getCourierConfigs, testCourierConnection | VERIFIED | All five procedures present; testCourierConnection at line 1533 with full implementation |
| `packages/api/src/routers/__tests__/equipment-test-connection.test.ts` | Unit tests for testCourierConnection (4 cases) | VERIFIED | 339 lines; DPD valid, UPS valid, 404-as-success, 401-failure |
| `apps/web/src/app/api/cron/inpost-status-poll/route.ts` | Multi-carrier polling (InPost + DPD + UPS) | VERIFIED | Lines 103, 112: both DPD and UPS polled with .catch() |
| `apps/web/src/components/billing/feature-gate.tsx` | FeatureGate client wrapper | VERIFIED | TIER_RANK, getSubscription query, renders UpgradeInlineBanner on insufficient tier (67 lines) |
| `apps/web/src/components/billing/upgrade-inline-banner.tsx` | Inline upgrade banner with Gem icon | VERIFIED | Gem icon, border-l-4, bg-primary/5, role="status", aria-live="polite", Link to /settings?tab=billing |
| `apps/web/src/components/billing/usage-dashboard.tsx` | 4-card usage dashboard | VERIFIED | getUsageDashboard via billingProxy, grid-cols-1 sm:grid-cols-2 lg:grid-cols-4, loading/error/empty states (219 lines) |
| `apps/web/src/components/billing/credit-progress-bar.tsx` | Green/yellow/red progress bar | VERIFIED | var(--success), var(--warning), var(--destructive) thresholds |
| `apps/web/src/components/billing/seat-count-card.tsx` | Seat count with overage | VERIFIED | activeContractors prop, overage calculation, aria attributes |
| `apps/web/src/components/billing/billing-date-card.tsx` | Billing date with context | VERIFIED | `export function BillingDateCard` |
| `apps/web/src/components/billing/usage-kpi-card.tsx` | Generic KPI card shell | VERIFIED | `export function UsageKpiCard` |
| `apps/web/src/components/billing/billing-tab.tsx` | UsageDashboard integrated | VERIFIED | Import and `<UsageDashboard />` render |
| `apps/web/src/components/equipment/carrier-shipment-form.tsx` | Unified carrier shipment form | VERIFIED | configuredCarriers, createDpdShipment, createUpsShipment, max-w-lg |
| `apps/web/src/components/equipment/dpd-fieldset.tsx` | DPD address + parcel size fields | VERIFIED | DpdFieldset, street, postalCode |
| `apps/web/src/components/equipment/ups-fieldset.tsx` | UPS address + parcel size + service type | VERIFIED | UpsFieldset, serviceCode, Standard |
| `apps/web/src/components/settings/carrier-credential-form.tsx` | Carrier credential cards with test/save | VERIFIED | saveCourierConfig and testCourierConnection both wired; toasts on success/error |
| `apps/web/src/components/settings/default-return-carrier-select.tsx` | Default return carrier selection | VERIFIED | DefaultReturnCarrierSelect, defaultReturnCarrier key |
| `apps/web/messages/en.json` | Billing.gate, usage, credits; Equipment.carrier, dpd, ups; Settings.carriers, returnCarrier | VERIFIED | All namespaces confirmed present |
| `apps/web/messages/pl.json` | Polish translations for all new keys | VERIFIED | All namespaces confirmed present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tier.ts` | `billing-service.ts` | `getSubscription(ctx.organizationId)` | WIRED | Line 33: `getSubscription((ctx as { organizationId: string }).organizationId)` |
| `billing.ts` | `credit-service.ts` | `getCreditBalance` in getUsageDashboard | WIRED | `getCreditBalance(ctx.organizationId)` |
| `dpd-client.ts` | `courier-client.ts` | `implements CourierClient` | WIRED | `export class DPDClient implements CourierClient` |
| `ups-client.ts` | `courier-client.ts` | `implements CourierClient` | WIRED | `export class UPSClient implements CourierClient` |
| `dpd-polling-service.ts` | `dpd-client.ts` | `new DPDClient` | WIRED | Polling service instantiates DPDClient from courier config |
| `equipment.ts` | `dpd-client.ts` | `new DPDClient(configJson)` | WIRED | Line 1124: `const client = new DPDClient(configJson)` |
| `equipment.ts` | `ups-client.ts` | `new UPSClient(configJson)` | WIRED | Line 1311: `const client = new UPSClient(configJson)` |
| `equipment.ts` | `tier.ts` | `requireTier("PRO")` | WIRED | Lines 1103, 1290: `.use(requireTier("PRO"))` |
| `equipment.ts` | `carrier-factory.ts` | `getCourierClient(carrier, credentials)` | WIRED | Line 33 import; line 1538: `getCourierClient(carrier, credentials)` in testCourierConnection |
| `usage-dashboard.tsx` | `billing.ts` | `trpc.billing.getUsageDashboard.queryOptions()` | WIRED | billingProxy.getUsageDashboard.queryOptions() |
| `feature-gate.tsx` | `billing.ts` | `trpc.billing.getSubscription.queryOptions()` | WIRED | Line 43: `trpc.billing.getSubscription.queryOptions()` |
| `carrier-shipment-form.tsx` | `equipment.ts` | `createDpdShipment / createUpsShipment` | WIRED | equipmentProxy.createDpdShipment/createUpsShipment mutation calls |
| `carrier-credential-form.tsx` | `equipment.ts` | `saveCourierConfig / getCourierConfigs` | WIRED | Lines 26-27: saveCourierConfig and getCourierConfigs proxy |
| `carrier-credential-form.tsx` | `equipment.ts` | `testCourierConnection` | WIRED | Lines 157-166: mutationOptions with onSuccess/onError toasts; backend procedure at equipment.ts:1533 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `usage-dashboard.tsx` | dashboard (subscription, credits, activeContractors) | `getUsageDashboard` -> `getSubscription`, `getCreditBalance`, `prisma.contractor.count` | Yes — real DB queries via Promise.all | FLOWING |
| `feature-gate.tsx` | subscription | `trpc.billing.getSubscription` -> billing-service.ts | Yes — DB-backed subscription lookup | FLOWING |
| `seat-count-card.tsx` | activeContractors, includedSeats | Props from UsageDashboard via getUsageDashboard | Yes — real contractor count from DB | FLOWING |
| `credit-progress-bar.tsx` | used, total | Props from UsageDashboard via getCreditBalance | Yes — real credit balance from credit-service.ts | FLOWING |
| `carrier-credential-form.tsx` | testMutation result | `testCourierConnection` -> `getCourierClient` -> `client.getStatus("TEST_CONNECTION_PROBE")` | Yes — live carrier API probe | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — all entry points require a running Next.js/tRPC server. Static analysis confirms wiring; runtime testing routed to human verification.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| BILL-09 | 35-01, 35-03, 35-04 | Middleware gates features by org's active subscription tier with graceful upgrade prompts | SATISFIED | requireTier middleware (tier.ts), FeatureGate + UpgradeInlineBanner components (feature-gate.tsx, upgrade-inline-banner.tsx) |
| BILL-10 | 35-01, 35-04 | Admin sees usage dashboard with current plan, seat count, OCR credits used/remaining, and billing date | SATISFIED | getUsageDashboard endpoint (billing.ts) + UsageDashboard with 4 KPI cards (usage-dashboard.tsx, seat-count-card.tsx, credit-progress-bar.tsx, billing-date-card.tsx) |
| EQUIP-06 | 35-02, 35-03, 35-05 | System integrates with DPD API for shipment creation, label generation, and status tracking | SATISFIED | DPDClient (dpd-client.ts), status mapper, polling service, createDpdShipment router procedure, CarrierShipmentForm UI, testCourierConnection procedure |
| EQUIP-07 | 35-02, 35-03, 35-05 | System integrates with UPS API for shipment creation and status tracking | SATISFIED | UPSClient with OAuth (ups-client.ts), status mapper, polling service, createUpsShipment router procedure, UpsFieldset UI, testCourierConnection procedure |

All four requirement IDs claimed in plan frontmatter are accounted for. No orphaned requirements found — REQUIREMENTS.md marks all four as Phase 35 / Complete.

### Anti-Patterns Found

No anti-patterns found. All previously identified blockers have been resolved. No TODO/FIXME/placeholder comments in any implemented files. No empty return stubs. All handlers call real mutations and queries.

### Human Verification Required

#### 1. Test Connection Button (Gap Closure Verification)

**Test:** Navigate to Settings > Integrations, expand a DPD or UPS carrier credential card, enter any credentials, and click "Test connection"
**Expected:** Loading spinner appears, then either "Connection verified" or "Connection failed" toast — no console errors or tRPC procedure-not-found errors
**Why human:** The `testCourierConnection` procedure was the single blocker; it is now implemented and wired. Runtime behavior with actual React Query mutation lifecycle requires a running app to confirm the toast flow works end-to-end.

#### 2. DPD/UPS Shipment Creation End-to-End

**Test:** With a PRO org and a configured courier config record in the DB, use CarrierShipmentForm to create a DPD or UPS shipment for an active equipment item
**Expected:** Shipment is created, tracking number appears, equipment status transitions to IN_TRANSIT, ShipmentEvent and AuditLog records are created
**Why human:** Requires live sandbox credentials and a configured CourierConfig DB record

#### 3. FeatureGate Visual Behavior

**Test:** Wrap a page section with `<FeatureGate requiredTier="Pro" featureName="DPD Shipping">` while logged in as an org with a STARTER subscription
**Expected:** UpgradeInlineBanner renders with Gem icon, "DPD Shipping requires Pro.", and "Upgrade Plan" button linking to /settings?tab=billing; no flash of the gated content
**Why human:** Requires a running app with an authenticated STARTER org session

#### 4. UsageDashboard Live Rendering

**Test:** Navigate to Settings > Billing with a PRO subscription that has used some OCR credits
**Expected:** 4 KPI cards render with correct data; CreditProgressBar shows yellow or green based on remaining credits; SeatCountCard shows actual active contractor count; BillingDateCard shows next renewal date
**Why human:** Requires live subscription, credit, and contractor data; color thresholds and number formatting require visual inspection

### Gaps Summary

No gaps remain. The single blocker from the initial verification — the missing `testCourierConnection` tRPC procedure — has been implemented and fully wired:

- Backend: `packages/api/src/routers/equipment.ts` line 1533 — `adminProcedure` accepting `z.union([dpdConfigSchema, upsConfigSchema])`, instantiating the correct carrier client via `getCourierClient`, probing with `getStatus("TEST_CONNECTION_PROBE")`, and returning structured `{ success: boolean, error?: string }` without leaking internals.
- Tests: `packages/api/src/routers/__tests__/equipment-test-connection.test.ts` — 4 cases covering DPD valid, UPS valid, 404-as-success (auth OK), and 401-failure (bad credentials).
- Frontend: `carrier-credential-form.tsx` lines 157-166 — mutation wired with `onSuccess`/`onError` toast handlers.

All 13 truths are now VERIFIED. Phase goal is achieved at the static-analysis level. Remaining items are human-verification confirmations of live runtime behavior, not blocking gaps.

---

_Verified: 2026-04-05T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
