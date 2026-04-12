---
status: issues_found
phase: 49
depth: standard
files_reviewed: 5
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
---

# Code Review: Phase 49

## Summary

The Phase 49 gap-closure wiring (orphaned UI components, validator exports, and the Peppol tRPC router) is generally sound, but one critical miscategorisation in permission scoping exposes invoice transmission data to users without invoice read rights, and several warning-level issues exist around React Rules-of-Hooks violations, incomplete transmission logic, and weak input validation.

## Findings

### CR-001: Wrong permission scope on getTransmissionByInvoiceId
**Severity:** critical
**File:** packages/api/src/routers/peppol.ts
**Line:** 323
**Issue:** `getTransmissionByInvoiceId` is guarded by `requirePermission({ settings: ["read"] })`. This is the same permission used for Peppol connection management (connect, disconnect, getStatus). Invoice-level transmission data is invoice data — it should require `invoice: ["read"]`. Users who have settings read access but no invoice read access can retrieve the full transmission record (including `documentTypeId`, timestamps, status, and a full participant join) for any invoice in their org. Comparable routes in the codebase (e.g. `zatca.ts:103,133`) correctly use `invoice: ["read"]`.
**Fix:** Change the permission guard on `getTransmissionByInvoiceId` to `.use(requirePermission({ invoice: ["read"] }))`.

---

### WR-001: Rules of Hooks violation — useQuery called after early return
**Severity:** warning
**File:** apps/web/src/components/einvoice/compliance-widget.tsx
**Line:** 94
**Issue:** `useQuery(trpc.peppol.getStatus.queryOptions())` on line 94 is called after the `if (isLoading) return (...)` early return on line 81. React Rules of Hooks require hooks to be called in the same order on every render; an early return before a hook call is a violation that will cause a runtime error ("Rendered more hooks than during the previous render") once React transitions from loading to loaded state.
**Fix:** Move the `peppol.getStatus` query declaration above the `if (isLoading)` guard, alongside the first `useQuery` call on line 77.

---

### WR-002: retryTransmission resets DB status but never re-enqueues work
**Severity:** warning
**File:** packages/api/src/routers/peppol.ts
**Line:** 402–411
**Issue:** The `retryTransmission` mutation sets `status: "PENDING"` and clears `errorMessage`, but does not publish a new QStash message to `/api/peppol/outbound`. There is no background worker polling for PENDING transmissions. The record will remain permanently stuck in PENDING unless the cron poll happens to pick it up, which the poll route is not designed to do for outbound jobs.
**Fix:** After the `prisma.peppolTransmission.update` call, enqueue a QStash message to the outbound route with `{ organizationId, transmissionId }`. Wrap in a try/catch so a QStash failure doesn't prevent the status reset from being returned.

---

### WR-003: peppolTransmission query enabled too eagerly on invoice detail page
**Severity:** warning
**File:** apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx
**Line:** 163–168
**Issue:** `enabled: !!invoice` fires the `getTransmissionByInvoiceId` query for every invoice as soon as invoice data is loaded, regardless of whether the invoice has any Peppol relevance. This is an unnecessary API call for the vast majority of invoices (KSeF, manual upload, email). Given the permission bug in CR-001 the call also leaks intent.
**Fix:** Scope the query to only Peppol-related invoices: `enabled: !!invoice && (invoice.source === "PEPPOL" || /* check for outbound indicator */ true)`. At minimum, gate on `invoice.source === "PEPPOL"` until the outbound case can be determined without the query result.

---

### WR-004: Peppol inbound banner uses sellerTaxId as senderParticipantId
**Severity:** warning
**File:** apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx
**Line:** 319
**Issue:** `senderParticipantId={invoice.sellerTaxId ?? "Unknown sender"}` passes the raw tax ID (a TRN or NIP) as the Peppol participant ID. A Peppol participant ID has the scheme-prefixed format `0192:NNNNNNNNNNNNNNN`. The `sellerTaxId` field is the unqualified identifier. The banner will display a structurally incorrect participant ID, and any downstream copy-to-clipboard or lookup action will be broken.
**Fix:** Use the resolved `peppolTransmission.senderParticipantId` (already mapped by the router) or construct it as `` `0192:${invoice.sellerTaxId}` `` only when the source is `PEPPOL` and a proper schemed ID is unavailable. The router's `getTransmissionByInvoiceId` response already includes `receiverParticipantId`; the inbound sender should be surfaced analogously.

---

### WR-005: healthScore is hard-coded rather than derived from data
**Severity:** warning
**File:** apps/web/src/components/einvoice/compliance-widget.tsx
**Line:** 150–152
**Issue:** `healthScore` is computed as a static mapping from state string to fixed numbers (`active → 100`, `onboarding → 50`, otherwise `0`). The `peppolStatus` response includes connection metadata (`lastSyncAt`, `lastErrorAt`, `lastSuccessAt`, `lastErrorMessage`) that would allow a more meaningful health score. Displaying 0 for a `suspended` state that is merely awaiting manual reactivation is misleading.
**Fix:** Derive health score from the connection record: if `lastErrorAt` is null, health is 100; if `lastErrorAt > lastSuccessAt`, health is 0; otherwise scale by recency. Alternatively document that the static mapping is intentional and track improvements in a follow-up issue.

---

### IR-001: TRN length validation is redundant
**Severity:** info
**File:** packages/validators/src/peppol.ts
**Line:** 26–29
**Issue:** `connectPeppolSchema.trn` applies both `.length(15)` and `.regex(/^\d+$/)`. The `peppolParticipantIdSchema` already validates the full `0192:NNNNNNNNNNNNNNN` format. These two validations on the raw TRN are sufficient but the length check and regex check duplicate the guarantee provided by `peppolParticipantIdSchema`. This is not a bug but adds maintenance surface.
**Fix:** Consider using `peppolParticipantIdSchema` as the basis for the connect schema, or document that the two validations are intentionally separate because connect accepts a raw TRN, not the full participant ID.

---

### IR-002: aspProvider enum locks to a single value without future-proofing
**Severity:** info
**File:** packages/validators/src/peppol.ts
**Line:** 29
**Issue:** `aspProvider: z.enum(["storecove"])` is a single-value enum. Zod single-value enums behave correctly, but `z.literal("storecove")` would be more idiomatic and make intent clearer. If a second provider is added later, the schema and all downstream discriminated unions will need updating.
**Fix:** No immediate action required. Consider using `z.literal("storecove")` for clarity, or add a comment noting that additional providers will extend this enum.

---

### IR-003: Missing type exports for new peppol validators in index.ts
**Severity:** info
**File:** packages/validators/src/index.ts
**Line:** 467–481
**Issue:** The peppol exports are present and correct. However, the `transmitInvoiceSchema` is exported but `TransmitInvoiceInput` is the only type exported alongside it. All other schema/type pairs are symmetrically exported. No gap exists here, but verifying completeness: `peppolParticipantIdSchema` exports `PeppolParticipantId` ✓, `connectPeppolSchema` exports `ConnectPeppolInput` ✓, `transmitInvoiceSchema` exports `TransmitInvoiceInput` ✓, `getTransmissionsSchema` exports `GetTransmissionsInput` ✓, `getTransmissionByInvoiceIdSchema` exports `GetTransmissionByInvoiceIdInput` ✓, `retryTransmissionSchema` exports `RetryTransmissionInput` ✓. All symmetric. No action required — recorded for completeness.
**Fix:** No action required.

---

### IR-004: any casts on invoice and transmission data in page.tsx reduce type safety
**Severity:** info
**File:** apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx
**Line:** 130, 149, 160, 171
**Issue:** Four separate `as any` casts suppress TypeScript on the core data objects (`invoice`, `pdfUrl`, `reconciliation`, `peppolTransmission`). The Peppol-specific access patterns at lines 231–232 (`peppolTransmission.direction`, `peppolTransmission.documentTypeId`, `peppolTransmission.createdAt`) are entirely untyped. A typo or schema change would silently produce `undefined` at runtime.
**Fix:** Infer the return type from the tRPC query using `inferOutput` or the inferred router type, and replace `as any` with properly typed variables. This is a pre-existing pattern in the file but the Phase 49 additions extend it further.
