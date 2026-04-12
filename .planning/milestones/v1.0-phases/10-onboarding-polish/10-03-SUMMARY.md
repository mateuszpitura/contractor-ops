---
phase: 10-onboarding-polish
plan: 03
subsystem: ui
tags: [react, import-wizard, csv, xlsx, dropzone, multi-step-dialog]

requires:
  - phase: 10-onboarding-polish
    provides: "Import tRPC router (parse, validate, commit mutations)"
provides:
  - "6-component import wizard dialog (upload, mapping, preview, duplicates, confirm)"
  - "Import button in contractor and contract list page toolbars"
affects: [onboarding, contractors, contracts]

tech-stack:
  added: []
  patterns: ["Multi-step wizard with conditional step visibility", "File-to-base64 upload pattern for tRPC mutations"]

key-files:
  created:
    - apps/web/src/components/import/import-wizard-dialog.tsx
    - apps/web/src/components/import/step-upload.tsx
    - apps/web/src/components/import/step-mapping.tsx
    - apps/web/src/components/import/step-preview.tsx
    - apps/web/src/components/import/step-duplicates.tsx
    - apps/web/src/components/import/step-confirm.tsx
  modified:
    - apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/contracts/page.tsx
    - apps/web/src/components/contractors/contractor-table/data-table.tsx
    - apps/web/src/components/contractors/contractor-table/data-table-toolbar.tsx
    - apps/web/src/components/contracts/contract-table/data-table.tsx
    - apps/web/src/components/contracts/contract-table/data-table-toolbar.tsx

key-decisions:
  - "File-to-base64 via FileReader.readAsDataURL for tRPC mutation transport"
  - "Conditional step 4 (duplicates) visibility based on duplicate row count"
  - "onImport optional prop threaded through data-table to toolbar for Import button"

patterns-established:
  - "Import wizard conditional step pattern: step indicator hides steps with visible=false"

requirements-completed: [IMP-01, IMP-02, IMP-03]

duration: 6min
completed: 2026-03-23
---

# Phase 10 Plan 03: Import Wizard Summary

**5-step CSV/XLSX import wizard with column auto-mapping, validation preview, duplicate resolution, and list page integration**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T09:09:29Z
- **Completed:** 2026-03-23T09:15:32Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Import wizard dialog with 5-step flow: upload, map columns, review data, resolve duplicates, confirm import
- File upload step with entity type selection (contractor/contract), react-dropzone, 10MB limit, base64 conversion
- Column mapping step with auto-match indicators (CheckCircle/AlertCircle), duplicate target prevention, required field validation
- Validation preview with per-cell error highlighting, toggle between all/errors-only, tooltips on error cells
- Duplicate resolution with per-row skip/update/create radio actions and bulk action buttons
- Confirmation step with progress bar during import and completion summary with navigation CTA
- Import button integrated into both contractor and contract list page toolbars via onImport prop

## Task Commits

Each task was committed atomically:

1. **Task 1: Import wizard dialog shell with upload and mapping steps** - `8393927` (feat)
2. **Task 2: Preview, duplicates, confirm steps and list page integration** - `af00a2a` (feat)

## Files Created/Modified
- `apps/web/src/components/import/import-wizard-dialog.tsx` - 5-step wizard shell with state management, StepIndicator, AlertDialog discard confirmation
- `apps/web/src/components/import/step-upload.tsx` - Entity type radio + react-dropzone file upload with base64 conversion
- `apps/web/src/components/import/step-mapping.tsx` - Column mapping grid with auto-match, Select dropdowns, required field indicators
- `apps/web/src/components/import/step-preview.tsx` - Validation preview table with error cells, tooltips, show-all/errors toggle
- `apps/web/src/components/import/step-duplicates.tsx` - Duplicate resolution with RadioGroup per row, bulk actions
- `apps/web/src/components/import/step-confirm.tsx` - Pre-import summary, progress bar, completion state with navigation
- `apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx` - Added ImportWizardDialog and onImport prop
- `apps/web/src/app/[locale]/(dashboard)/contracts/page.tsx` - Added ImportWizardDialog and onImport prop
- `apps/web/src/components/contractors/contractor-table/data-table.tsx` - Added onImport optional prop
- `apps/web/src/components/contractors/contractor-table/data-table-toolbar.tsx` - Added Import outline button
- `apps/web/src/components/contracts/contract-table/data-table.tsx` - Added onImport optional prop
- `apps/web/src/components/contracts/contract-table/data-table-toolbar.tsx` - Added Import outline button

## Decisions Made
- Used FileReader.readAsDataURL for file-to-base64 conversion, stripping data URL prefix for tRPC transport
- Step 4 (duplicates) conditionally visible only when duplicate rows exist, step indicator adjusts accordingly
- Added onImport optional prop through data-table components to keep toolbar button integration clean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Import wizard UI complete, ready for end-to-end testing with import tRPC router from Plan 01
- All 6 components export correctly and are integrated into list pages

---
*Phase: 10-onboarding-polish*
*Completed: 2026-03-23*
