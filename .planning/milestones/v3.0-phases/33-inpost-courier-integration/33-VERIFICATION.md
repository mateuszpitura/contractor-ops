---
phase: 33-inpost-courier-integration
verified: 2026-04-04T23:30:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 33: InPost Courier Integration Verification Report

**Phase Goal:** Integrate InPost courier service for equipment shipments — API client, webhook/polling status tracking, admin shipment creation, contractor return flow via portal, offboarding auto-shipment at D-10.
**Verified:** 2026-04-04T23:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | CourierClient interface exists with createShipment, getLabel, getStatus, cancelShipment methods | VERIFIED | `packages/api/src/services/courier/courier-client.ts` — all 4 methods declared, exported |
| 2  | InPostClient implements CourierClient and sends correct ShipX payloads | VERIFIED | `inpost-client.ts` — `class InPostClient implements CourierClient`, correct ShipX URLs and bodies, 6 tests passing |
| 3  | All ShipX statuses map to ShipmentStatus enum values without throwing | VERIFIED | `inpost-status-mapper.ts` — 17-entry INPOST_STATUS_MAP, `mapInPostStatus` returns null (not throws) for unknowns, 22 mapper tests passing |
| 4  | Webhook handler creates ShipmentEvents and deduplicates by status | VERIFIED | `inpost-webhook-handler.ts` — dedup check via `shipmentEvent.findFirst`, 7 webhook tests passing including dedup test |
| 5  | Polling service fetches active InPost shipments and creates missing events | VERIFIED | `inpost-polling-service.ts` — queries carrier=InPost, status NOT IN terminals, externalId NOT NULL; 5 polling tests passing |
| 6  | Shipment model has externalId and courier config fields | VERIFIED | `equipment.prisma` lines 57-58 — `externalId String?` and `labelUrl String?` |
| 7  | Admin can create an InPost shipment via equipment router with Paczkomat target point | VERIFIED | `equipment.ts` router — `createInPostShipment` mutation at line 886 using `InPostClient.createShipment` |
| 8  | Webhook endpoint receives ShipX status pushes and creates ShipmentEvents | VERIFIED | `apps/web/src/app/api/webhooks/inpost/route.ts` — POST handler, imports and calls `handleInPostWebhook` fire-and-forget |
| 9  | QStash cron endpoint polls active InPost shipments hourly | VERIFIED | `apps/web/src/app/api/cron/inpost-status-poll/route.ts` — POST handler with QStash signature verification, calls `pollInPostShipmentStatuses` |
| 10 | Contractor can list assigned equipment via portal router | VERIFIED | `portal.ts` — `listEquipment` queries `prisma.equipmentAssignment.findMany` with real DB data |
| 11 | Contractor can request a return via portal (creates PENDING_APPROVAL ReturnRequest) | VERIFIED | `portal.ts` — `requestReturn` mutation creates `ReturnRequest` with PENDING_APPROVAL; test confirms RETURN_ALREADY_PENDING guard |
| 12 | Admin can approve a return request which creates an InPost shipment | VERIFIED | `equipment.ts` — `approveReturnRequest` mutation loads ReturnRequest, calls `InPostClient.createShipment`, creates Shipment records |
| 13 | Admin can reject a return request | VERIFIED | `equipment.ts` — `rejectReturnRequest` mutation transitions to REJECTED with reason |
| 14 | Offboarding-triggered returns skip approval and create shipment directly | VERIFIED | `equipment-workflow.ts` — `autoCreateInPostReturnShipment` called at offboarding, creates ReturnRequest with SHIPMENT_CREATED; offboarding test passes |
| 15 | Contractor sees assigned equipment in portal Equipment tab and can initiate return via portal | VERIFIED | `portal-equipment-tab.tsx` (309 lines) + `portal-return-flow.tsx` (357 lines), portal page at `/portal/equipment`, navigation link in `portal-top-bar.tsx` |

**Score:** 15/15 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/services/courier/courier-client.ts` | CourierClient interface | VERIFIED | 55 lines, exports CourierClient, CreateShipmentParams, CourierShipmentResult, LabelFormat |
| `packages/api/src/services/courier/inpost-client.ts` | InPost ShipX API HTTP client | VERIFIED | 198 lines, class InPostClient implements CourierClient, sandbox URL correct |
| `packages/api/src/services/courier/inpost-status-mapper.ts` | ShipX status mapping | VERIFIED | 59 lines, INPOST_STATUS_MAP (17 entries), mapInPostStatus, NOTIFICATION_STATUSES |
| `packages/api/src/services/courier/inpost-webhook-handler.ts` | Webhook event processing | VERIFIED | 201 lines, verifyInPostSignature, handleInPostWebhook, deduplication logic |
| `packages/api/src/services/courier/inpost-polling-service.ts` | QStash-triggered polling | VERIFIED | 179 lines, pollInPostShipmentStatuses, batch of 50, terminal status guard |
| `apps/web/src/app/api/webhooks/inpost/route.ts` | Dedicated InPost webhook endpoint | VERIFIED | 140 lines, exports POST, imports handleInPostWebhook and verifyInPostSignature |
| `apps/web/src/app/api/cron/inpost-status-poll/route.ts` | QStash-scheduled polling endpoint | VERIFIED | 91 lines, exports POST via verifySignatureAppRouter, calls pollInPostShipmentStatuses |
| `packages/api/src/routers/equipment.ts` | Extended with InPost endpoints | VERIFIED | createInPostShipment (line 886), approveReturnRequest (1089), rejectReturnRequest (1297), listReturnRequests (1400), getShipmentLabel (1448) |
| `packages/api/src/routers/portal.ts` | Extended with equipment/return endpoints | VERIFIED | listEquipment (1223), getReturnStatus (1270), requestReturn (1300), cancelReturn (1408), getReturnLabel (1478) |
| `packages/api/src/services/equipment-workflow.ts` | Offboarding auto-shipment | VERIFIED | InPostClient imported, autoCreateInPostReturnShipment function, SHIPMENT_CREATED status, preferredPaczkomatId check |
| `apps/web/src/components/equipment/paczkomat-picker.tsx` | InPost Geowidget modal wrapper | VERIFIED | 195 lines (min: 60), GEOWIDGET_ORIGIN constant, postMessage with origin validation, iframe with sandbox attribute |
| `apps/web/src/components/equipment/inpost-shipment-form.tsx` | InPost shipment creation dialog | VERIFIED | 222 lines (min: 80), calls createInPostShipment, PaczkomatPicker nested, parcelSize radio group |
| `apps/web/src/components/equipment/shipment-label-view.tsx` | Label/QR display with download and print | VERIFIED | 185 lines (min: 40), base64ToBlob, blob URL download, print window, LabelDisplay export |
| `apps/web/src/components/equipment/return-approval-banner.tsx` | Admin return approval/rejection banner | VERIFIED | 184 lines (min: 40), approveReturnRequest mutation, rejectReturnRequest mutation, AlertDialog confirm |
| `apps/web/src/components/portal/portal-equipment-tab.tsx` | Contractor equipment list | VERIFIED | 309 lines (min: 60), listEquipment query, getReturnStatus query, empty state via i18n |
| `apps/web/src/components/portal/portal-return-flow.tsx` | Multi-step return modal | VERIFIED | 357 lines (min: 100), 3-step flow, PaczkomatPicker, requestReturn mutation, getReturnLabel query |
| `apps/web/src/app/[locale]/(portal)/portal/equipment/page.tsx` | Portal equipment route page | VERIFIED | Renders PortalEquipmentTab, server component pattern |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `inpost-client.ts` | `courier-client.ts` | `class InPostClient implements CourierClient` | WIRED | Pattern found at line 43 |
| `inpost-webhook-handler.ts` | `inpost-status-mapper.ts` | `mapInPostStatus` call | WIRED | Import line 5, used in handler body line 137 |
| `apps/web/.../webhooks/inpost/route.ts` | `inpost-webhook-handler.ts` | `handleInPostWebhook` import | WIRED | Lines 5-8, called at line 132 |
| `apps/web/.../cron/inpost-status-poll/route.ts` | `inpost-polling-service.ts` | `pollInPostShipmentStatuses` import | WIRED | Line 5, called at lines 42 and 59 |
| `equipment.ts` router | `inpost-client.ts` | `InPostClient` usage | WIRED | Import lines 21-22, used in createInPostShipment, approveReturnRequest, getShipmentLabel |
| `portal.ts` router | Prisma ReturnRequest model | `prisma.returnRequest` queries | WIRED | requestReturn creates, getReturnStatus queries, cancelReturn updates |
| `equipment-workflow.ts` | `inpost-client.ts` | `InPostClient.createShipment` in autoCreateInPostReturnShipment | WIRED | Import line 1-2, used at line 331 |
| `paczkomat-picker.tsx` | `https://geowidget.inpost.pl` | iframe src + postMessage origin check | WIRED | GEOWIDGET_ORIGIN constant at line 38, src at line 117, origin guard at line 77 |
| `inpost-shipment-form.tsx` | `equipment.ts` router | `createInPostShipment` tRPC mutation | WIRED | equipmentProxy.createInPostShipment used at line 97 |
| `portal-return-flow.tsx` | `portal.ts` router | `requestReturn` tRPC mutation | WIRED | portalProxy.requestReturn.mutationOptions at line 136 |
| `return-approval-banner.tsx` | `equipment.ts` router | `approveReturnRequest` / `rejectReturnRequest` mutations | WIRED | Both mutations imported via equipmentProxy at lines 17-18, called at lines 102 and 109 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `portal-equipment-tab.tsx` | `equipmentQuery.data` | `portal.listEquipment` tRPC query | Yes — `prisma.equipmentAssignment.findMany` with DB join on equipment + shipments | FLOWING |
| `portal-equipment-tab.tsx` | `returnStatusQuery.data` | `portal.getReturnStatus` tRPC query | Yes — `prisma.returnRequest.findFirst` with real DB query | FLOWING |
| `portal-return-flow.tsx` | `labelData` (step 3) | `portal.getReturnLabel` tRPC query | Yes — `InPostClient.getLabel` fetches from ShipX API, returns base64 buffer | FLOWING |
| `inpost-shipment-form.tsx` | form submission | `equipment.createInPostShipment` mutation | Yes — `InPostClient.createShipment` POSTs to ShipX, creates Shipment in DB | FLOWING |
| `inpost-polling-service.ts` | `activeShipments` | `prisma.shipment.findMany` | Yes — real DB query filtering carrier=InPost, non-terminal, externalId not null | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All courier service tests pass (44 tests) | `pnpm vitest run src/services/courier/__tests__/` | 4 files, 44 tests, 0 failures | PASS |
| Portal equipment and return router tests pass (11 tests) | `pnpm vitest run src/routers/__tests__/portal-equipment.test.ts src/routers/__tests__/equipment-return.test.ts` | 2 files, 11 tests, 0 failures | PASS |
| Offboarding auto-shipment test confirms SHIPMENT_CREATED status | See test output — `[equipment-workflow] Auto-created InPost return shipment...` logged | ReturnRequest with SHIPMENT_CREATED asserted in test | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EQUIP-05 | 33-01, 33-02, 33-03 | System integrates with InPost ShipX API for shipment creation, Parcel Locker selection, and auto-status tracking | SATISFIED | InPostClient (ShipX API), PaczkomatPicker (Geowidget), webhook+polling (auto-status), all wired end-to-end |
| EQUIP-11 | 33-02, 33-03 | Contractor can initiate equipment return via portal and receive shipping label | SATISFIED | portal.requestReturn creates ReturnRequest, portal.getReturnLabel returns label, ShipmentLabelView renders with download/print |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `inpost-webhook-handler.ts` | 5 | `NOTIFICATION_STATUSES` imported but never applied inside handler (no dispatch call for DELIVERED/FAILED/RETURNED) | Warning | Notifications for terminal shipment statuses via webhooks are silently skipped. Plan step 9 ("fire notification via dispatch()") was not implemented. Polling service also does not dispatch notifications. Portal label is available for download but contractor is not proactively notified via notification system when their shipment reaches terminal status. This is a plan incompleteness, not a phase goal blocker. |
| `inpost-webhook-handler.ts` | N/A | `checkShipmentTaskCompletion` call from plan step 8 absent — workflow task auto-completion from webhooks is not implemented in the handler | Warning | Workflow tasks linked to shipments via `workflowTaskRunId` are not auto-completed when shipment status reaches DELIVERED via webhook. The offboarding auto-shipment creates the ReturnRequest correctly, but the task-completion loop is incomplete for the webhook path. The portal goal (SC-2) is still achieved — contractor receives label regardless. |

### Human Verification Required

None — all plan items covering the two success criteria are verified programmatically. Plan 03 Task 3 was a checkpoint:human-verify gate that was marked approved by the user during execution. Visual behavior of Geowidget iframe, Paczkomat map rendering, and label download/print are not re-verifiable programmatically.

### Gaps Summary

No goal-blocking gaps. Both ROADMAP success criteria are fully achieved:

1. **EQUIP-05 fully satisfied:** InPostClient wraps ShipX API with correct payloads, PaczkomatPicker embeds Geowidget iframe with origin-validated postMessage, webhook endpoint and QStash cron both process status updates, admin createInPostShipment mutation wires all pieces together.

2. **EQUIP-11 fully satisfied:** Contractor portal at `/portal/equipment` lists assigned items, `requestReturn` creates a ReturnRequest with PENDING_APPROVAL, admin approves via `approveReturnRequest` which calls InPostClient, `getReturnLabel` fetches label from ShipX, ShipmentLabelView renders with working download and print.

Two warning-level anti-patterns exist (NOTIFICATION_STATUSES unused in webhook handler, missing `checkShipmentTaskCompletion` call) but neither blocks the phase goal. Both are plan-level completeness gaps that do not prevent the user-facing flows from working. They are candidates for a follow-up gap plan if notification dispatch and workflow auto-completion via webhook path are required.

---

_Verified: 2026-04-04T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
