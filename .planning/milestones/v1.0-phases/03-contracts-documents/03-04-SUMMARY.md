---
phase: 03-contracts-documents
plan: 04
subsystem: ui
tags: [react-hook-form, zod, react-dropzone, wizard, presigned-url, drag-drop, next-intl]

requires:
  - phase: 03-contracts-documents
    provides: Contract tRPC router (create mutation), Document tRPC router (requestUpload, confirmUpload, linkToEntity)
  - phase: 02-contractor-registry
    provides: Contractor wizard pattern (wizard-dialog.tsx, step-*.tsx), contractor.list and contractor.getById queries
provides:
  - 3-step contract creation wizard (wizard-dialog.tsx, step-details.tsx, step-financial.tsx, step-documents.tsx)
  - Contractor billing profile pre-fill for financial terms
  - Document upload step with presigned URL flow and scan status badges
  - Top bar quick action entry point for contract creation
  - Contracts translation namespace (EN + PL)
affects: [03-contracts-documents, 04-workflow-engine]

tech-stack:
  added: [react-dropzone]
  patterns: [contract-wizard-3-step, presigned-url-upload-with-progress, contractor-billing-prefill-from-customFieldsJson]

key-files:
  created:
    - apps/web/src/components/contracts/contract-wizard/wizard-dialog.tsx
    - apps/web/src/components/contracts/contract-wizard/step-details.tsx
    - apps/web/src/components/contracts/contract-wizard/step-financial.tsx
    - apps/web/src/components/contracts/contract-wizard/step-documents.tsx
  modified:
    - apps/web/src/components/layout/top-bar.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json
    - apps/web/package.json

key-decisions:
  - "Local wizard Zod schema mirroring contractCreateSchema to avoid cross-package web->validators dependency (same pattern as contractor wizard)"
  - "Contractor billing pre-fill reads billingModel and rateValueGrosze from customFieldsJson, currency from Contractor.currency"
  - "Document upload fires immediately on file selection (not deferred to form submit) using requestUpload + XHR PUT + confirmUpload flow"
  - "zodResolver cast to any to work around react-hook-form v7.71 type inference issue with Zod enum schemas"

patterns-established:
  - "ContractWizardDialog reusable from multiple entry points via contractorId optional prop"
  - "XHR-based upload with progress tracking for presigned URL uploads"
  - "Scan status badge pattern (scanning/clean/infected/failed) with Lucide shield icons"

requirements-completed: [CNTR-01, CNTR-02]

duration: 10min
completed: 2026-03-20
---

# Phase 03 Plan 04: Contract Creation Wizard Summary

**3-step contract wizard with contractor billing pre-fill, drag-and-drop document upload via presigned URLs, and top bar quick action entry point**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-20T14:10:23Z
- **Completed:** 2026-03-20T14:20:23Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- 3-step contract creation wizard mirroring the contractor wizard pattern: details (contractor picker, title, type, dates) -> financial terms (rate, currency, billing model, rate type, payment terms, invoice cycle) -> documents (drag-and-drop upload)
- Contractor billing profile pre-fill when opened from contractor context (reads rateValueGrosze and billingModel from customFieldsJson, currency from Contractor model)
- Document upload step with react-dropzone, presigned URL upload flow with XHR progress tracking, and virus scan status badges
- Top bar FilePlus quick action button opens wizard as a portal dialog from any page
- Full EN/PL translations for all wizard copy including field labels, type options, scan statuses, and error messages

## Task Commits

Each task was committed atomically:

1. **Task 1: 3-step contract creation wizard with contractor billing pre-fill** - `72bcba7` (feat)
2. **Task 2: Wire top bar quick action to open contract wizard** - `67e6fd6` (feat)

## Files Created/Modified
- `apps/web/src/components/contracts/contract-wizard/wizard-dialog.tsx` - Main wizard dialog with 3-step progress, react-hook-form + zodResolver, discard confirmation
- `apps/web/src/components/contracts/contract-wizard/step-details.tsx` - Step 1: contractor combobox picker, title, type, calendar date pickers, notice period, auto-renewal
- `apps/web/src/components/contracts/contract-wizard/step-financial.tsx` - Step 2: rate (grosze display), currency, billing model, rate type, payment terms, invoice cycle with pre-fill hints
- `apps/web/src/components/contracts/contract-wizard/step-documents.tsx` - Step 3: react-dropzone drag-and-drop, presigned URL upload with XHR progress, scan status badges
- `apps/web/src/components/layout/top-bar.tsx` - Added FilePlus quick action button opening ContractWizardDialog
- `apps/web/messages/en.json` - Added Contracts.wizard namespace and TopBar.newContract key
- `apps/web/messages/pl.json` - Polish translations for all wizard copy
- `apps/web/package.json` - Added react-dropzone dependency

## Decisions Made
- Used local Zod schema mirroring contractCreateSchema (same cross-package avoidance pattern as contractor wizard)
- Read contractor billing data from customFieldsJson (billingModel, rateValueGrosze) per decision from 02-01
- Cast zodResolver to `any` to work around react-hook-form v7.71 type inference incompatibility with Zod enum schemas (same issue would occur in contractor wizard with stricter types)
- Document upload fires immediately on file selection rather than deferring to form submit, matching the UI-SPEC requirement

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed react-dropzone dependency**
- **Found during:** Task 1 (Step documents implementation)
- **Issue:** react-dropzone was listed in RESEARCH.md installation commands but not yet installed
- **Fix:** Ran `pnpm --filter @contractor-ops/web add react-dropzone`
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Verification:** Import resolves, TypeScript compiles
- **Committed in:** 72bcba7 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed tRPC type inference for mutation/query calls**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** tRPC v11 proxy pattern with `mutationOptions({})` returns void-typed parameters; base-ui Select `onValueChange` passes `string | null`; contractor list items typed with `unknown` fields from `plain()` serialization
- **Fix:** Added `as Parameters<...>[0]` casts for mutation args, `value ?? ""` null guards for Select, typed contractor list items via local interface
- **Files modified:** wizard-dialog.tsx, step-details.tsx, step-financial.tsx, step-documents.tsx
- **Verification:** `tsc --noEmit` passes cleanly
- **Committed in:** 72bcba7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Contract wizard is accessible from top bar quick action (any page) and can be opened from contractor profile with contractorId pre-fill
- Wizard creates contracts via trpc.contract.create and links uploaded documents via trpc.document.linkToEntity
- Ready for Plan 03-05 (reusable DropZone component) and Plan 03-06 (contract detail page)

## Self-Check: PASSED

All 5 key files verified present. Both task commits (72bcba7, 67e6fd6) confirmed in git log.

---
*Phase: 03-contracts-documents*
*Completed: 2026-03-20*
