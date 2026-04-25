---
plan: 64-04
phase: 64-legal-compliance-hardening
status: complete
commit: 0d95ba6a
completed_at: 2026-04-26
---

# Plan 64-04: tRPC Mutations — Escalation, SDS Approval, DRV Upload, ToS

## What Was Built

Added `logEscalation` mutation to classification router (append-only escalation event audit trail using `classificationEscalationEvent.create`). Added `approveSds` mutation that creates `SdsApproval` row with frozen `SDS_APPROVAL_STATEMENT_EN` snapshot at approval time; throws CONFLICT if approval already exists. Added SDS_NOT_APPROVED guard to `generateSds` — PRECONDITION_FAILED when no SdsApproval row exists. Added `uploadDrvDecisionLetter` mutation with MIME magic-byte validation, 10MB cap, content-addressed R2 upload, and DB rollback on failure. Added `DRV_DECISION_LETTER` to `KIND_PATH_SEGMENT` in classification-document-keys.ts. Added `recordToS` mutation to consent router with YYYY.N.N version validation creating ConsentEvent rows. Added conditional classification router registration in `root.ts` — all 8 classification routers wrapped in `CLASSIFICATION_ENABLED` flag spread (D-05).

## Key Files Modified

- `packages/api/src/routers/classification.ts` — logEscalation, approveSds mutations
- `packages/api/src/routers/classification-document.tsx` — SDS_NOT_APPROVED guard, uploadDrvDecisionLetter
- `packages/api/src/services/classification-document-keys.ts` — DRV_DECISION_LETTER kind segment
- `packages/api/src/routers/consent.ts` — recordToS mutation
- `packages/api/src/root.ts` — conditional classification router registration

## Deviations

- `recordToS` stores `ipAddress: null` / `userAgent: null` — `tenantProcedure` ctx does not expose raw request headers. Fields are nullable in schema so this is acceptable; a future iteration can add headers via tRPC context enrichment.

## Manual-Only Verifications

None required.

## Self-Check: PASSED

- logEscalation uses classificationProcedure + classificationEscalationEvent.create ✓
- approveSds uses classificationProcedure + requirePermission(contractor:update) ✓
- SDS_APPROVAL_STATEMENT_EN snapshot stored in SdsApproval.approvalStatementSnapshot ✓
- CONFLICT thrown on duplicate assessmentId (P2002 catch) ✓
- generateSds throws SDS_NOT_APPROVED PRECONDITION_FAILED when no SdsApproval ✓
- uploadDrvDecisionLetter MIME magic-byte validation + 10MB cap ✓
- DRV_DECISION_LETTER in KIND_PATH_SEGMENT ✓
- recordToS creates ConsentEvent with scope=TOS ✓
- root.ts CLASSIFICATION_ENABLED conditional spread ✓
- No console.* calls ✓
