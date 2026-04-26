---
plan: 64-07
phase: 64-legal-compliance-hardening
status: complete
commit: b7b585ad
completed_at: 2026-04-26
---

# Plan 64-07: SDS Cover Page + Approval Gate UI + DRV Decision Letter Upload

## What Was Built

Extended `ir35-sds.tsx` PDF template with `SdsApprovalData` interface and `CoverPage` component — prepended as first page when `approvalData` prop is present. Cover page shows client name, approver, approvedAt date, and frozen `approvalStatementSnapshot`. Extended `generate-sds-button.tsx` with a pre-generation SDS approval gate: `SDS_APPROVAL_STATEMENT_EN` checkbox + client name input + Confirm Approval button calling `approveSds` mutation; Generate SDS button shown only after approval. Added `DRV_DECISION_LETTER` to `KIND_PATH_SEGMENT` in `classification-document-keys.ts`. Extended `drv-clearance-panel.tsx` with `DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE` amber banner when no decision letter uploaded, hidden file input (accept=.pdf,.jpg,.jpeg,.png), Upload button calling `uploadDrvDecisionLetter` with 10MB cap. Added `Legal.SdsApproval` and `Legal.DrvUpload` i18n keys to en.json + de.json.

## Key Files Modified

- `packages/api/src/pdf-templates/ir35-sds.tsx` — SdsApprovalData + CoverPage + approvalData prop
- `packages/api/src/services/classification-document-keys.ts` — DRV_DECISION_LETTER kind
- `apps/web/src/components/contractors/classification-documents/generate-sds-button.tsx` — approval gate
- `apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-panel.tsx` — upload + disclaimer
- `apps/web/messages/en.json` + `apps/web/messages/de.json` — Legal.SdsApproval/DrvUpload

## Self-Check: PASSED

- CoverPage prepended when approvalData prop present ✓
- SDS_APPROVAL_STATEMENT_EN in cover page ✓
- generate-sds-button.tsx shows approval gate before Generate SDS ✓
- approveSds mutation called on Confirm Approval click ✓
- DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE in drv-clearance-panel ✓
- uploadDrvDecisionLetter mutation called with 10MB cap ✓
- accept=".pdf,.jpg,.jpeg,.png" on file input ✓
- i18n keys present in both en.json and de.json ✓
