---
phase: 16-ocr-invoice-parsing
plan: 02
subsystem: ui
tags: [react-pdf, ocr, confidence-badge, pdf-viewer, nip-validation, line-items]

requires:
  - phase: 13-contractor-portal
    provides: Badge semantic variants (info/warning/success)
provides:
  - PdfViewer component with page navigation and zoom controls
  - ConfidenceBadge with color-coded thresholds per D-07
  - ConfidenceFieldWrapper with colored left borders
  - NipValidationBadge with modulo-11 checksum validation
  - ExtractionStatusBar with lifecycle state display
  - OcrProcessingOverlay with spinner, progress, and skeleton fields
  - LineItemsTable with inline editing, grosze formatting, add/remove
affects: [16-03-integration-wiring]

tech-stack:
  added: [react-pdf, pdfjs-dist]
  patterns: [confidence-threshold-coloring, grosze-formatting, inline-editable-table]

key-files:
  created:
    - apps/web/src/components/ocr/pdf-viewer.tsx
    - apps/web/src/components/ocr/confidence-badge.tsx
    - apps/web/src/components/ocr/confidence-field-wrapper.tsx
    - apps/web/src/components/ocr/nip-validation-badge.tsx
    - apps/web/src/components/ocr/extraction-status-bar.tsx
    - apps/web/src/components/ocr/ocr-processing-overlay.tsx
    - apps/web/src/components/ocr/line-items-table.tsx
  modified:
    - apps/web/package.json

key-decisions:
  - "Inlined NIP validation logic locally since Plan 01 types not yet available"
  - "Used Tailwind color classes for confidence borders instead of CSS variables for dark mode support"

patterns-established:
  - "Confidence threshold pattern: >90% success, 70-90% warning, <70% destructive"
  - "Grosze formatting: divide by 100, toFixed(2) for display; parseFloat * 100, Math.round for storage"
  - "Inline editable table cells: borderless Input that shows border on hover/focus"

requirements-completed: [OCR-02, OCR-03]

duration: 3min
completed: 2026-03-27
---

# Phase 16 Plan 02: OCR UI Components Summary

**Seven composable OCR review components: react-pdf viewer with zoom/navigation, confidence badges with D-07 thresholds, NIP modulo-11 validation, extraction status bar, processing overlay, and editable line items table with grosze formatting**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T15:03:43Z
- **Completed:** 2026-03-27T15:06:38Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- PdfViewer renders PDFs with page navigation (prev/next), zoom controls (fit width, +/- 0.25 scale), and sticky positioning on desktop
- ConfidenceBadge + ConfidenceFieldWrapper provide color-coded field borders and tooltips per UI-SPEC D-07 thresholds
- NipValidationBadge validates Polish NIP using modulo-11 checksum with weights [6,5,7,2,3,4,5,6,7]
- ExtractionStatusBar renders all 5 extraction states (PENDING/PROCESSING/EXTRACTED/PARTIAL/FAILED) with correct copy
- LineItemsTable supports inline editing, grosze-to-PLN formatting, add/remove rows, and per-row confidence badges

## Task Commits

Each task was committed atomically:

1. **Task 1: Install react-pdf and build PDF viewer + confidence components** - `bf7904b` (feat)
2. **Task 2: Extraction status bar, processing overlay, and editable line items table** - `6d2c160` (feat)

## Files Created/Modified
- `apps/web/src/components/ocr/pdf-viewer.tsx` - react-pdf based PDF rendering with page navigation and zoom
- `apps/web/src/components/ocr/confidence-badge.tsx` - Color-coded confidence indicator with tooltip
- `apps/web/src/components/ocr/confidence-field-wrapper.tsx` - Colored-border wrapper for form fields
- `apps/web/src/components/ocr/nip-validation-badge.tsx` - NIP format validation indicator with modulo-11
- `apps/web/src/components/ocr/extraction-status-bar.tsx` - Extraction lifecycle status display
- `apps/web/src/components/ocr/ocr-processing-overlay.tsx` - Loading overlay during extraction
- `apps/web/src/components/ocr/line-items-table.tsx` - Editable extracted line items with grosze formatting
- `apps/web/package.json` - Added react-pdf dependency

## Decisions Made
- Inlined NIP validation logic locally since Plan 01 OCR types file not yet available (parallel execution). When Plan 01 completes, Plan 03 can import from the shared location.
- Used Tailwind color classes (border-l-green-600, border-l-amber-500, border-l-destructive) with dark mode variants instead of raw CSS variables for better theme integration.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7 OCR UI components ready for integration in Plan 03
- Components are self-contained and composable
- Plan 03 will wire these into invoice upload forms and create the OcrReviewPanel split layout

## Self-Check: PASSED

All 7 component files verified present. Both commits (bf7904b, 6d2c160) verified in git log.

---
*Phase: 16-ocr-invoice-parsing*
*Completed: 2026-03-27*
