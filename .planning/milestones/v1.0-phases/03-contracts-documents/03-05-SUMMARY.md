---
phase: 03-contracts-documents
plan: 05
subsystem: ui
tags: [react, next-intl, trpc, react-dropzone, drag-and-drop, pdf-preview, timeline, tabs, nuqs]

# Dependency graph
requires:
  - phase: 03-01
    provides: Contract tRPC router (getById, createAmendment, updateExpiryReminders, listAmendments, transitionStatus)
  - phase: 03-02
    provides: Document tRPC router (requestUpload, confirmUpload, getDownloadUrl, list, uploadNewVersion, getVersionHistory)
  - phase: 03-03
    provides: Contract list page, contract table pattern, status badge styles
  - phase: 02-03
    provides: Contractor profile page pattern (tabs, breadcrumb, right-rail activity timeline)
provides:
  - Contract detail page at /contracts/{id} with 4 tabs (Overview, Documents, Amendments, Activity)
  - Reusable document components (DropZone, DocumentCard, DocumentList, PdfPreview, UploadProgress, VersionHistory)
  - Amendment timeline with add amendment dialog
  - Expiry reminder inline editor with per-contract override
affects: [03-06, 04-workflow-engine, 05-invoice-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [contract-detail-4-tab-layout, reusable-document-components, presigned-url-xhr-upload-with-progress, browser-native-pdf-preview, amendment-timeline-flexbox]

key-files:
  created:
    - apps/web/src/app/[locale]/(dashboard)/contracts/[id]/page.tsx
    - apps/web/src/components/contracts/contract-detail/detail-header.tsx
    - apps/web/src/components/contracts/contract-detail/contract-detail-tabs.tsx
    - apps/web/src/components/contracts/contract-detail/overview-tab.tsx
    - apps/web/src/components/contracts/contract-detail/documents-tab.tsx
    - apps/web/src/components/contracts/contract-detail/amendments-tab.tsx
    - apps/web/src/components/contracts/contract-detail/activity-tab.tsx
    - apps/web/src/components/documents/drop-zone.tsx
    - apps/web/src/components/documents/document-card.tsx
    - apps/web/src/components/documents/document-list.tsx
    - apps/web/src/components/documents/pdf-preview.tsx
    - apps/web/src/components/documents/upload-progress.tsx
    - apps/web/src/components/documents/version-history.tsx
  modified: []

key-decisions:
  - "ContractDetailTabs as separate component for URL tab state via nuqs (useSearchParams + router.replace pattern)"
  - "Browser-native <object> tag for PDF preview instead of react-pdf to avoid bundle size"
  - "Document download via direct fetch to tRPC query endpoint (not useMutation) since getDownloadUrl is a query"

patterns-established:
  - "Contract detail page follows contractor profile pattern: breadcrumb, header, tabs with URL state"
  - "Reusable document components in apps/web/src/components/documents/ for cross-page reuse"
  - "XMLHttpRequest-based upload with progress tracking for presigned URL PUT to R2"
  - "Amendment timeline with expandable nodes using flexbox + connector lines"

requirements-completed: [CNTR-02, CNTR-04, CNTR-05, DOCS-01, DOCS-02, DOCS-03, DOCS-04]

# Metrics
duration: 7min
completed: 2026-03-20
---

# Phase 03 Plan 05: Contract Detail & Document Components Summary

**Contract detail page with 4-tab layout (Overview, Documents, Amendments, Activity) and 6 reusable document components with drag-and-drop upload, PDF preview, and version history**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-20T14:23:13Z
- **Completed:** 2026-03-20T14:30:40Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Contract detail page at /contracts/{id} with breadcrumb navigation, status-aware header with terminate/supersede actions, and 4 deep-linkable tabs
- Overview tab with contract details, financial terms (grosze-to-zloty formatting), key dates with expiry color coding (green >60d, amber 30-60d, red <30d), linked contractor card, and inline expiry reminder editor
- Amendments tab with vertical timeline (newest first), expandable nodes, original contract anchor, and add amendment dialog with title/date/description fields
- 6 reusable document components: DropZone (react-dropzone + presigned URL XHR upload), DocumentCard (file icon + scan status + download/preview/version), DocumentList (trpc.document.list + empty state), PdfPreview (browser-native object tag in 960px dialog), UploadProgress (per-file progress + cancel), VersionHistory (expandable version chain + download)

## Task Commits

Each task was committed atomically:

1. **Task 1: Contract detail page with 4 tabs and header actions** - `28de50a` (feat)
2. **Task 2: Reusable document components** - `ab6f109` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/(dashboard)/contracts/[id]/page.tsx` - Contract detail page route with SSR query, error states, loading skeletons
- `apps/web/src/components/contracts/contract-detail/detail-header.tsx` - Header with status badge, contractor link, actions dropdown, terminate confirmation dialog
- `apps/web/src/components/contracts/contract-detail/contract-detail-tabs.tsx` - Tab container with URL state via nuqs (4 tabs)
- `apps/web/src/components/contracts/contract-detail/overview-tab.tsx` - 2-column grid with contract details, financial terms, key dates with color coding, linked contractor, expiry reminders editor
- `apps/web/src/components/contracts/contract-detail/documents-tab.tsx` - Integrates DropZone and DocumentList for contract documents
- `apps/web/src/components/contracts/contract-detail/amendments-tab.tsx` - Vertical timeline with expandable nodes, add amendment dialog
- `apps/web/src/components/contracts/contract-detail/activity-tab.tsx` - Event timeline from contract data (created, status changed, amendments, documents)
- `apps/web/src/components/documents/drop-zone.tsx` - Drag-and-drop with react-dropzone, presigned URL upload via XHR, MIME validation, 25MB limit
- `apps/web/src/components/documents/document-card.tsx` - File type icon, version badge, scan status badges, download/preview/version actions
- `apps/web/src/components/documents/document-list.tsx` - Fetches via trpc.document.list with loading skeletons and empty state
- `apps/web/src/components/documents/pdf-preview.tsx` - Browser-native object tag in Dialog (960px max-width, 80vh max-height)
- `apps/web/src/components/documents/upload-progress.tsx` - Per-file progress row with file icon, size, progress bar, cancel button, scan status
- `apps/web/src/components/documents/version-history.tsx` - Expandable version list via trpc.document.getVersionHistory

## Decisions Made
- Used ContractDetailTabs as separate component managing URL tab state via useSearchParams + router.replace (consistent with contractor profile tabs)
- Chose browser-native `<object>` tag for PDF preview instead of react-pdf to avoid significant bundle size increase
- Document download uses direct fetch to tRPC query endpoint rather than useMutation (getDownloadUrl is a query procedure)
- Activity tab constructs events from contract data (placeholder approach per plan, full audit trail deferred to Phase 9)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed document-card useMutation with query options**
- **Found during:** Task 2 (DocumentCard component)
- **Issue:** Attempted to use `useMutation` with `trpc.document.getDownloadUrl.queryOptions()` which is a query, not a mutation
- **Fix:** Removed useMutation, used direct fetch to tRPC endpoint for download URL retrieval
- **Files modified:** apps/web/src/components/documents/document-card.tsx
- **Verification:** TypeScript compiles without errors
- **Committed in:** ab6f109 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Contract detail page ready for i18n key additions (Plan 03-06)
- Reusable document components available for contractor profile document tab integration
- Amendment timeline ready for Phase 4 workflow integration

## Self-Check: PASSED

All 13 files verified present. Both task commits (28de50a, ab6f109) confirmed in git log.

---
*Phase: 03-contracts-documents*
*Completed: 2026-03-20*
