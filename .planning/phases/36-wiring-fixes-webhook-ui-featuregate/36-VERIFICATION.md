---
phase: 36-wiring-fixes-webhook-ui-featuregate
verified: 2026-04-05T14:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 36: Wiring Fixes — Webhook, UI, Feature Gate — Verification Report

**Phase Goal:** Wire remaining integration gaps: Linear bidirectional webhook dispatch, DPD/UPS carrier UI mounting in Settings and equipment pages, and feature-gate enforcement on premium tRPC procedures.
**Verified:** 2026-04-05T14:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Linear inbound webhook dispatch routes through QStash processor and outbound cancelRun syncs CANCELLED to both Linear and Jira | VERIFIED | `provider === "linear"` block at line 89 of `_process/route.ts`; `syncTaskStatusToLinear(prisma, task.id, "CANCELLED")` and `transitionJiraIssue(...)` at lines 1047–1079 of `workflow.ts` |
| 2 | DPD and UPS integration cards appear in Settings > Integrations with credential management | VERIFIED | `DpdProviderSection` and `UpsProviderSection` imported and rendered at lines 224–228 of `integrations-tab.tsx`; both components exist and contain `CarrierCredentialForm` in a Dialog |
| 3 | Admin can configure DPD/UPS API credentials via CarrierCredentialForm in Settings > Integrations | VERIFIED | `dpd-provider-section.tsx` line 74: `<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />`; `ups-provider-section.tsx` line 74: `<CarrierCredentialForm carrier="ups" carrierLabel="UPS" />` — both opened via Dialog on Configure button click |
| 4 | STARTER-tier users see FeatureGate upgrade prompts instead of raw tRPC errors when accessing PRO features | VERIFIED | `requireTier("PRO")` on Linear (saveStatusMapping, saveTaskConfig), Jira (saveStatusMapping, saveTaskConfig, disconnect), Calendar (disconnect, saveTaskConfig), OCR (trigger, retrigger); `requireTier("ENTERPRISE")` on audit export; global `handleTierError` in `query-client.ts` intercepts TIER_REQUIRED and shows Sonner toast with billing link |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/app/api/webhooks/_process/route.ts` | Linear webhook dispatch block | VERIFIED | Contains `provider === "linear"` block with dynamic import of `processLinearWebhook` at line 89 |
| `packages/api/src/routers/workflow.ts` | Outbound Linear and Jira sync in cancelRun | VERIFIED | Lines 1025–1080 filter `run.tasks` for `CANCELLED`, fire-and-forget sync for both `LINEAR_ISSUE` and `JIRA_ISSUE` types |
| `apps/web/src/components/settings/dpd-provider-section.tsx` | DPD integration card with credential form dialog | VERIFIED | Exports `DpdProviderSection`; Card with Truck icon (text-red-600), Badge status, Configure button, Dialog with CarrierCredentialForm |
| `apps/web/src/components/settings/ups-provider-section.tsx` | UPS integration card with credential form dialog | VERIFIED | Exports `UpsProviderSection`; Card with Truck icon (text-amber-700), Badge status, Configure button, Dialog with CarrierCredentialForm |
| `apps/web/src/components/settings/integrations-tab.tsx` | DPD and UPS cards mounted in integrations grid | VERIFIED | Imports both provider sections; renders `<DpdProviderSection />` at line 225 and `<UpsProviderSection />` at line 228 |
| `apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx` | Ship via Carrier button and CarrierShipmentForm dialog | VERIFIED | Imports `CarrierShipmentForm`; `carrierShipmentOpen` state; `configuredCarriers.length > 0` visibility gate; renders `<CarrierShipmentForm>` with all required props |
| `apps/web/src/trpc/query-client.ts` | Global TIER_REQUIRED error handler in QueryClient | VERIFIED | `handleTierError` function parses JSON, checks `type === "TIER_REQUIRED"`, shows `toast.error` with billing link; wired into `mutations.onError` |
| `packages/api/src/routers/linear.ts` | requireTier middleware on mutation procedures | VERIFIED | 3 occurrences: import + saveStatusMapping + saveTaskConfig |
| `packages/api/src/routers/jira.ts` | requireTier middleware on mutation procedures | VERIFIED | 4 occurrences: import + saveStatusMapping + saveTaskConfig + disconnect |
| `packages/api/src/routers/calendar.ts` | requireTier middleware on mutation procedures | VERIFIED | 3 occurrences: import + disconnect + saveTaskConfig |
| `packages/api/src/routers/ocr.ts` | requireTier middleware on OCR procedures | VERIFIED | 3 occurrences: import + trigger + retrigger |
| `packages/api/src/routers/audit.ts` | requireTier ENTERPRISE on export procedure | VERIFIED | 2 occurrences: import + export mutation with `requireTier("ENTERPRISE")` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/src/app/api/webhooks/_process/route.ts` | `packages/api/src/services/linear-webhook-handler.ts` | dynamic import of processLinearWebhook | WIRED | Line 90–97: dynamic import and `await processLinearWebhook(prisma, delivery.organizationId, delivery.integrationConnectionId ?? "", delivery.payloadJson)` |
| `packages/api/src/routers/workflow.ts` | `packages/api/src/services/linear-issue-sync.ts` | fire-and-forget syncTaskStatusToLinear in cancelRun | WIRED | Line 1068–1071: dynamic import + `await syncTaskStatusToLinear(prisma, task.id, "CANCELLED")` in cancelledTasks loop |
| `apps/web/src/components/settings/dpd-provider-section.tsx` | `apps/web/src/components/settings/carrier-credential-form.tsx` | renders CarrierCredentialForm in Dialog | WIRED | Line 74: `<CarrierCredentialForm carrier="dpd" carrierLabel="DPD" />` inside Dialog |
| `apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx` | `apps/web/src/components/equipment/carrier-shipment-form.tsx` | renders CarrierShipmentForm in Dialog | WIRED | Lines 241–254: `<CarrierShipmentForm open={carrierShipmentOpen} onOpenChange={setCarrierShipmentOpen} equipmentIds={[equipment.id]} contractorName={...} direction="OUTBOUND" configuredCarriers={configuredCarriers} onSuccess={...} />` |
| `apps/web/src/trpc/query-client.ts` | `packages/api/src/middleware/tier.ts` | parses TIER_REQUIRED JSON error from requireTier middleware | WIRED | Lines 26–36: parses `parsed.type === "TIER_REQUIRED"`, shows upgrade toast with `/settings?tab=billing` link |
| `packages/api/src/routers/linear.ts` | `packages/api/src/middleware/tier.ts` | requireTier('PRO') middleware on procedures | WIRED | Line 14 import; lines 196, 263: `.use(requireTier("PRO"))` on saveStatusMapping and saveTaskConfig |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `dpd-provider-section.tsx` | `configsQuery.data` (configs array) | `equipmentProxy.getCourierConfigs.queryOptions()` — tRPC query to equipment router | Yes — getCourierConfigs queries `courierConfig` table for the org (verified in phase 35) | FLOWING |
| `ups-provider-section.tsx` | `configsQuery.data` (configs array) | Same as DPD — `getCourierConfigs.queryOptions()` | Yes — same endpoint | FLOWING |
| `equipment/[id]/page.tsx` | `configuredCarriers` | `courierConfigProxy.getCourierConfigs.queryOptions()` | Yes — maps carrier strings from DB records, gates button visibility on `configuredCarriers.length > 0` | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points available without starting server. All checks require running Next.js or tRPC. Wiring verified at code level via grep/read above.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LIN-04 | 36-01-PLAN.md | Status changes in Linear sync to linked workflow task via webhooks | SATISFIED | `processLinearWebhook` dispatched from `_process/route.ts` for `provider === "linear"` |
| LIN-05 | 36-01-PLAN.md | Status changes on workflow task sync to Linear issue via GraphQL mutation | SATISFIED | `syncTaskStatusToLinear(prisma, task.id, "CANCELLED")` in `cancelRun`; pattern also exists in completeTask/skipTask from prior phases |
| EQUIP-06 | 36-02-PLAN.md | System integrates with DPD API for shipment creation, label generation, and status tracking | SATISFIED | DPD credential form UI wired in Settings > Integrations; CarrierShipmentForm accessible from equipment detail for DPD shipments |
| EQUIP-07 | 36-02-PLAN.md | System integrates with UPS API for shipment creation and status tracking | SATISFIED | UPS credential form UI wired in Settings > Integrations; CarrierShipmentForm includes UPS in `configuredCarriers` when credentials set |
| BILL-09 | 36-03-PLAN.md | Middleware gates features by org's active subscription tier with graceful upgrade prompts | SATISFIED | `requireTier("PRO")` on 7 integration/OCR mutation procedures; `requireTier("ENTERPRISE")` on audit export; global `handleTierError` shows upgrade toast |

No orphaned requirements found — all 5 IDs declared in plan frontmatter are accounted for and verified.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No stubs, placeholders, or disconnected implementations found in any modified file |

Notable observation: `cancelRun` in `workflow.ts` correctly uses `run.tasks.filter(t => t.status === "CANCELLED")` rather than re-querying (per the documented pitfall in PLAN 01), and the Jira sync correctly uses the 5-argument `transitionJiraIssue` signature with connection lookup (deviation from plan spec was auto-fixed during execution per SUMMARY 01).

---

### Human Verification Required

#### 1. Linear webhook round-trip

**Test:** Send a Linear state-change webhook event with a valid `integrationConnectionId` that matches a connected Linear workspace. Observe that the linked workflow task status is updated in the app.
**Expected:** Task status changes to match the Linear state mapping configured for the workspace.
**Why human:** Requires a live Linear workspace connection and QStash delivery; cannot simulate end-to-end in static analysis.

#### 2. DPD/UPS credential form submission

**Test:** Navigate to Settings > Integrations, click "Configure DPD", enter test API credentials, and submit the form.
**Expected:** CarrierCredentialForm saves credentials; Badge updates to "Connected" on next page load; "Ship via Carrier" button appears on equipment detail pages.
**Why human:** Requires a rendered browser session to verify Dialog open/close behavior, form validation UX, and Badge status update.

#### 3. TIER_REQUIRED upgrade toast

**Test:** Log in as a STARTER-tier organization user. Attempt to call a PRO-gated mutation (e.g., save a Linear status mapping).
**Expected:** A Sonner toast appears with "This feature requires Pro plan." and an "Upgrade" action button that navigates to `/settings?tab=billing`. No raw tRPC error is shown.
**Why human:** Requires a live STARTER-tier org session in a running browser with React Query mutation execution.

---

### Gaps Summary

No gaps found. All 4 must-have truths are fully verified:

1. **Linear bidirectional sync** — Inbound webhook dispatch correctly routes `provider === "linear"` to `processLinearWebhook` via dynamic import. Outbound `cancelRun` correctly fires `syncTaskStatusToLinear("CANCELLED")` and `transitionJiraIssue("CANCELLED")` for each affected task using fire-and-forget pattern with proper error logging.

2. **DPD/UPS Settings UI** — Two new provider section components exist, are substantive (full Card + Badge + Dialog + CarrierCredentialForm), and are correctly mounted in `integrations-tab.tsx`. The Card pattern (rather than ProviderConnectionCard) is appropriate because DPD/UPS use the courier config endpoint, not OAuth integration health checks.

3. **CarrierCredentialForm in Settings** — Both `DpdProviderSection` and `UpsProviderSection` render `CarrierCredentialForm` with correct `carrier` and `carrierLabel` props inside a Dialog, opened by a dedicated Configure button.

4. **Feature gate enforcement** — `requireTier` middleware is applied to all specified mutation procedures across 5 routers with correct tier levels. The global `handleTierError` in `makeQueryClient` correctly parses the JSON payload, maps tier labels, and shows a Sonner toast with billing navigation. Read-only queries remain ungated as designed.

---

_Verified: 2026-04-05T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
