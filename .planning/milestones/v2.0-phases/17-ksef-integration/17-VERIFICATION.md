---
phase: 17-ksef-integration
verified: 2026-03-27T18:48:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "KSeF connect flow in Settings > Integrations"
    expected: "Setup dialog opens, token entry works, Save Credentials authenticates and stores connection, provider card shows connected state with Sync Now button"
    why_human: "Requires live KSeF test environment credentials or mocked network; full credential-verify path cannot be asserted from static analysis"
  - test: "Hourly QStash cron triggers sync"
    expected: "After connecting, a QStash schedule at 'cron: 0 * * * *' is created and fires /api/ksef/_sync with organizationId + connectionId payload, invoices appear in invoice list"
    why_human: "Requires QStash integration and live network; cannot verify cron scheduling or actual invoice creation programmatically"
  - test: "Invoice table shows KSeF badge for KSEF-sourced rows"
    expected: "Rows with source=KSEF render the ShieldCheck + KSeF tooltip badge; other rows show no badge"
    why_human: "Conditional column rendering requires browser/component rendering environment"
  - test: "Invoice detail shows KSeF metadata section with copy buttons"
    expected: "KseF reference number and UPO are copyable; clipboard.writeText fires on click; Check icon appears for 2 seconds"
    why_human: "Clipboard API interaction and icon swap animation require browser environment"
  - test: "Duplicate banner voids invoice via confirmation dialog"
    expected: "Alert dialog prompts for confirmation; onVoid callback fires only after user confirms"
    why_human: "AlertDialog interaction flow requires browser/component rendering"
---

# Phase 17: KSeF Integration Verification Report

**Phase Goal:** Invoices issued to the org's NIP are automatically pulled from the national KSeF system and flow into the existing matching and approval pipeline
**Verified:** 2026-03-27T18:48:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | KSeF API client can authenticate via token-based RSA-OAEP challenge flow | VERIFIED | `ksef-api-client.ts:71` implements `authenticate()` with `RSA_PKCS1_OAEP_PADDING`; base URL `ksef.mf.gov.pl/api/v2`; 11 tests pass |
| 2 | KSeF API client can query invoices by NIP and date range | VERIFIED | `ksef-api-client.ts:209` implements `queryInvoices(nip, dateFrom, dateTo)` with polling |
| 3 | FA(3) XML is parsed into a Zod-validated typed structure with all invoice fields | VERIFIED | `ksef-xml-parser.ts` uses `XMLParser` + `Math.round` for grosze; validated via `ksefParsedInvoiceSchema.parse()`; 4 XML parser tests pass |
| 4 | KSeF adapter is registered in the global adapter registry | VERIFIED | `register-all.ts:30` calls `registerAdapter(new KsefAdapter())` |
| 5 | Hourly QStash cron triggers KSeF sync that fetches and stores new invoices | VERIFIED | `ksef.ts router:147` creates QStash schedule `cron: "0 * * * *"` on connect; `/api/ksef/_sync/route.ts` handles callback with `verifySignatureAppRouter` |
| 6 | Manual "Sync Now" triggers immediate KSeF sync via tRPC mutation | VERIFIED | `ksef.ts router:233` implements `triggerSync` calling `qstash.publishJSON` immediately; UI wired in `integrations-tab.tsx:87` |
| 7 | KSeF reference stored in externalInvoiceId and UPO in sourceReference | VERIFIED | `ksef-sync-orchestrator.ts:144` sets `externalInvoiceId: metadata.ksefReferenceNumber`; `ksef-xml-parser.ts:189` sets `sourceReference: parsed.upoNumber ?? null` |
| 8 | Cross-source duplicate detection flags invoices matching by invoiceNumber + sellerTaxId | VERIFIED | `ksef-duplicate-detection.ts:36` uses `invoiceNumber: { equals, mode: "insensitive" }` + `sellerTaxId`; bidirectional `flagsJson.duplicateOf` linking in `linkDuplicateInvoices` |
| 9 | Batch notification dispatched after sync with count of new invoices | VERIFIED | `ksef-sync-orchestrator.ts:292` dispatches `type: "KSEF_SYNC_COMPLETE"` when `invoicesCreated > 0`; type added to `notification.ts:14` |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/validators/src/ksef.ts` | KSeF Zod schemas | VERIFIED | Exports `ksefConnectionConfigSchema`, `ksefParsedInvoiceSchema`, `ksefSyncParamsSchema`, type aliases |
| `packages/integrations/src/services/ksef-api-client.ts` | KSeF REST API v2 client | VERIFIED | `KsefApiClient` class with `authenticate`, `queryInvoices`, `downloadInvoiceXml`, `verifyCredentials`, `terminateSession` |
| `packages/integrations/src/services/ksef-xml-parser.ts` | FA(3) XML to typed JSON parser | VERIFIED | `parseFa3Xml` + `mapKsefToInvoiceFields`, grosze conversion via `Math.round`, Zod validation on output |
| `packages/integrations/src/adapters/ksef-adapter.ts` | KSeF adapter for integration registry | VERIFIED | `KsefAdapter extends BaseAdapter`, `slug="ksef"`, `supportsOAuth=false`, `getHealthStatus` from sync logs |
| `packages/api/src/services/ksef-sync-orchestrator.ts` | End-to-end KSeF sync | VERIFIED | `processKsefSync`: auth, query, parse, deduplicate-check, create invoice, auto-match, notify |
| `packages/api/src/services/ksef-duplicate-detection.ts` | Cross-source duplicate detection | VERIFIED | `checkCrossSourceDuplicate` + `linkDuplicateInvoices` with bidirectional flagsJson |
| `packages/api/src/routers/ksef.ts` | tRPC router for KSeF | VERIFIED | `ksefRouter` with `connect`, `disconnect`, `triggerSync`, `syncHistory`, `connectionStatus`; registered in `root.ts:69` |
| `apps/web/src/app/api/ksef/_sync/route.ts` | QStash callback endpoint | VERIFIED | `verifySignatureAppRouter` wrapping `processKsefSync`; `export const POST` |
| `apps/web/src/components/settings/ksef-setup-dialog.tsx` | KSeF credential entry dialog | VERIFIED | `KsefSetupDialog` with `trpc.ksef.connect`, `DialogContent`, `sm:max-w-lg`, NIP display |
| `apps/web/src/components/settings/ksef-sync-history.tsx` | Sync history section | VERIFIED | `KsefSyncHistory` with `Collapsible`, `trpc.ksef.syncHistory` query |
| `apps/web/src/components/invoices/ksef-badge.tsx` | KSeF source badge | VERIFIED | `KsefSourceBadge` with `ShieldCheck`, `Tooltip` |
| `apps/web/src/components/invoices/ksef-metadata-section.tsx` | KSeF metadata card | VERIFIED | `KsefMetadataSection` with `border-l-primary`, "KSeF Data" heading, `CopyableField` |
| `apps/web/src/components/invoices/ksef-duplicate-banner.tsx` | Duplicate warning banner | VERIFIED | `KsefDuplicateBanner` with amber border, `AlertDialog` for void confirmation |
| `apps/web/src/components/shared/copyable-field.tsx` | Clipboard copy utility | VERIFIED | `CopyableField` with `navigator.clipboard.writeText`, `aria-label` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ksef-xml-parser.ts` | `validators/ksef.ts` | imports `ksefParsedInvoiceSchema` | WIRED | `ksef-xml-parser.ts:5` imports from `@contractor-ops/validators` |
| `register-all.ts` | `ksef-adapter.ts` | registers `KsefAdapter` | WIRED | `register-all.ts:30` calls `registerAdapter(new KsefAdapter())` |
| `ksef-sync-orchestrator.ts` | `ksef-api-client.ts` | imports `KsefApiClient` | WIRED | `ksef-sync-orchestrator.ts:3,7` imports `KsefApiClient` from `@contractor-ops/integrations` |
| `ksef-sync-orchestrator.ts` | `ksef-xml-parser.ts` | imports `parseFa3Xml` | WIRED | `ksef-sync-orchestrator.ts:4` imports `parseFa3Xml` from `@contractor-ops/integrations` |
| `ksef-sync-orchestrator.ts` | `invoice-matching.ts` | imports `runAutoMatch` | WIRED | `ksef-sync-orchestrator.ts:11` imports `runAutoMatch` from `./invoice-matching.js` |
| `/api/ksef/_sync/route.ts` | `ksef-sync-orchestrator.ts` | imports `processKsefSync` | WIRED | `route.ts:5` imports from `@contractor-ops/api/services/ksef-sync-orchestrator` |
| `ksef-setup-dialog.tsx` | `ksef.ts` router | `trpc.ksef.connect.mutationOptions()` | WIRED | `ksef-setup-dialog.tsx:56` uses `trpc.ksef.connect.mutationOptions()` |
| `integrations-tab.tsx` | `ksef-setup-dialog.tsx` | renders `KsefSetupDialog` | WIRED | `integrations-tab.tsx:13,62` imports and renders `KsefSetupDialog` |
| `ksef-metadata-section.tsx` | `copyable-field.tsx` | renders `CopyableField` | WIRED | `ksef-metadata-section.tsx:13,65,75` imports and renders `CopyableField` |
| `invoice columns.tsx` | `ksef-badge.tsx` | renders `KsefSourceBadge` for source=KSEF | WIRED | `columns.tsx:19,334-335` imports and conditionally renders `KsefSourceBadge` |
| `invoices/[id]/page.tsx` | `ksef-metadata-section.tsx` | renders `KsefMetadataSection` | WIRED | `page.tsx:19,276` imports and renders conditionally |
| `invoices/[id]/page.tsx` | `ksef-duplicate-banner.tsx` | renders `KsefDuplicateBanner` | WIRED | `page.tsx:20,253` imports and renders when `flagsJson.duplicateSource === "KSEF"` |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| KSEF-01 | 17-01, 17-02 | System auto-fetches invoices issued to org's NIP from national KSeF system | SATISFIED | `processKsefSync` queries by org NIP, downloads/parses XML, creates Invoice records; hourly QStash cron in `ksef.ts router connect` |
| KSEF-02 | 17-01 | System parses KSeF FA(3) XML into invoice data model | SATISFIED | `parseFa3Xml` + `mapKsefToInvoiceFields` in `ksef-xml-parser.ts`; all FA(3) fields mapped with grosze conversion; 4 tests pass |
| KSEF-03 | 17-02, 17-03 | Invoice displays KSeF reference number and UPO receipt | SATISFIED | `externalInvoiceId` stores KSeF reference; `sourceReference` stores UPO; `KsefMetadataSection` renders both with `CopyableField` on invoice detail page |
| KSEF-04 | 17-02, 17-03 | System detects duplicates between KSeF-pulled and manually uploaded invoices | SATISFIED | `checkCrossSourceDuplicate` uses invoiceNumber+sellerTaxId business key; `linkDuplicateInvoices` sets bidirectional `flagsJson.duplicateOf`; `KsefDuplicateBanner` shows on manual invoice when KSeF duplicate found |

All 4 requirements are satisfied. No orphaned requirements detected (KSEF-05, KSEF-06 are mapped to a future phase and not claimed by any plan in phase 17).

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ksef-api-client.ts` | 178, 187, 195 | `TODO: Full XAdES implementation` + throws `"not yet implemented"` for certificate auth | Info | Certificate-based authentication is not functional. Token auth (the primary path per D-01) is fully implemented. Per plan decision D-01, this is a deliberate scoped stub. |
| `packages/api/src/services/__tests__/ksef-sync.test.ts` | All tests | All 12 tests are `it.todo(...)` | Warning | No passing tests for sync orchestrator behavior. The PLAN required "test stubs" per plan spec — this matches the intent but provides no automated regression coverage for the sync pipeline. |
| `packages/api/src/services/__tests__/ksef-duplicate.test.ts` | All tests | All 7 tests are `it.todo(...)` | Warning | No passing tests for duplicate detection. Same situation as above — plan-specified stubs. |

**Note on certificate stub:** The `authenticateWithCertificate` method is not a blocker for the phase goal. The plan explicitly deferred XAdES as `TODO per D-01` and the connect UI and orchestrator use token auth. The stub correctly throws a descriptive error if certificate auth is attempted.

**Note on todo test stubs:** Plans 02 explicitly called for test stubs (`it.todo`). The XML parser and API client tests (Plan 01) have 11 passing tests covering the core parsing and auth logic. The todo stubs for the orchestrator and duplicate detection reduce confidence for regression but do not block the phase goal.

---

### Human Verification Required

#### 1. KSeF Connect Flow (Settings > Integrations)

**Test:** Navigate to Settings > Integrations, click "Connect" on the KSeF provider card, enter a KSeF API token, click "Save Credentials"
**Expected:** Dialog opens with NIP display, token textarea, and Save button; on success: dialog closes, provider card shows "Connected" status with "Sync Now" button and sync history section
**Why human:** Requires KSeF test credentials or network mock; credential verify path calls KSeF API v2 live

#### 2. Hourly QStash Cron Activation

**Test:** After connecting KSeF, verify a QStash schedule exists in the Upstash dashboard for `/api/ksef/_sync` with `cron: "0 * * * *"`
**Expected:** Schedule created with retries=2, payload containing organizationId and connectionId
**Why human:** Cannot verify QStash external state from codebase; requires Upstash dashboard access

#### 3. KSeF Badge in Invoice Table

**Test:** Navigate to Invoices list with at least one KSEF-source invoice; verify the source column shows the ShieldCheck + "KSeF" badge with tooltip
**Expected:** Badge renders with `text-primary/80`, tooltip shows "Fetched from KSeF on [date]"; non-KSeF invoices show no badge in that column
**Why human:** Conditional column rendering requires browser environment

#### 4. Copyable Fields on Invoice Detail

**Test:** Open a KSEF-sourced invoice detail page; click the copy icon next to the KSeF Reference field
**Expected:** KsefMetadataSection card renders with left primary border; clicking copy icon writes reference to clipboard; Check icon appears for 2 seconds then reverts
**Why human:** Clipboard API interaction and icon animation require browser environment

#### 5. Duplicate Banner Void Confirmation

**Test:** Open a manually-uploaded invoice that has a KSeF duplicate; click "Void This Invoice" in the KsefDuplicateBanner
**Expected:** AlertDialog opens with confirmation; after confirming, `onVoid` callback fires
**Why human:** AlertDialog interaction requires browser/component rendering

---

## Summary

Phase 17 goal is **achieved**. All 9 observable truths are verified against actual codebase:

- The KSeF core engine (Plan 01) is fully implemented: `KsefApiClient` with RSA-OAEP token auth, `parseFa3Xml` with Zod-validated grosze conversion, `KsefAdapter` registered in the global registry, and 11 passing tests.
- The sync pipeline (Plan 02) is fully wired: `processKsefSync` orchestrates auth → query → parse → create → auto-match → cross-source deduplicate → notify; `ksefRouter` exposes all 5 tRPC procedures; QStash cron scheduling on connect; `KSEF_SYNC_COMPLETE` notification type added and dispatched.
- The UI layer (Plan 03) is fully wired: all 6 components exist with real tRPC calls; KSeF provider card in integrations tab; KSeF badge in invoice table; KseF metadata section and duplicate banner wired to invoice detail page; EN + PL i18n complete.

Two known acceptable gaps: (1) certificate auth is intentionally stubbed per D-01 (token auth is the primary and fully functional path); (2) API test files contain `it.todo()` stubs per plan specification (XML parser and API client have 11 real passing tests). Neither gap blocks the phase goal.

---

_Verified: 2026-03-27T18:48:00Z_
_Verifier: Claude (gsd-verifier)_
