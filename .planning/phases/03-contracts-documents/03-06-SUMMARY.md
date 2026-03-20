---
phase: 03-contracts-documents
plan: 06
subsystem: ui
tags: [react, next-intl, tanstack-table, i18n, contractor-profile, settings]

requires:
  - phase: 03-04
    provides: Contract wizard dialog with contractorId pre-fill support
  - phase: 03-05
    provides: Document components (DropZone, DocumentCard, DocumentList) and contract detail page

provides:
  - Contractor profile Contracts tab with mini table and contract wizard CTA
  - Contractor profile Documents tab with DropZone upload and DocumentCard list
  - Contractor profile Compliance tab with DropZone for required document uploads
  - Settings page org-level expiry reminder defaults
  - Full Phase 3 i18n (Contracts, Documents, Settings namespaces in EN and PL)

affects: [04-workflow-engine, 05-invoice-pipeline]

tech-stack:
  added: []
  patterns:
    - Mini TanStack Table pattern for embedded profile tab tables
    - ExpiryReminderDefaults component pattern for org-level settings sections

key-files:
  created:
    - apps/web/src/components/contractors/contractor-profile/tab-contracts.tsx
    - apps/web/src/components/contractors/contractor-profile/tab-documents.tsx
    - apps/web/src/components/settings/expiry-reminder-defaults.tsx
  modified:
    - apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx
    - apps/web/src/components/contractors/contractor-profile/tab-compliance.tsx
    - apps/web/src/components/contractors/contractor-profile/profile-header.tsx
    - apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Mini TanStack Table in contractor Contracts tab with simple prev/next pagination (not full nuqs URL state)"
  - "DropZone always visible in Documents tab empty state for immediate upload convenience"
  - "Compliance tab upload button scrolls to DropZone section rather than opening separate dialog"
  - "ExpiryReminderDefaults as standalone component in Settings general tab (not inline form)"

patterns-established:
  - "Embedded mini table pattern: simplified TanStack Table with manual pagination for profile tab sub-tables"
  - "Compliance upload flow: scroll-to-zone pattern for upload CTA in compliance item rows"

requirements-completed: [CNTR-02, CNTR-04, CNTR-05, DOCS-01, DOCS-02]

duration: 9min
completed: 2026-03-20
---

# Phase 03 Plan 06: Contractor Profile Tab Integration and Phase 3 i18n Summary

**Contractor profile tabs replaced with real data (Contracts mini table, Documents cards, Compliance upload), Settings expiry reminder defaults, and full Phase 3 EN/PL translations**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-20T14:33:38Z
- **Completed:** 2026-03-20T14:43:29Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Contractor profile Contracts tab shows mini TanStack Table with server-side pagination, contract wizard CTA, and row navigation to contract detail
- Contractor profile Documents tab shows DropZone for uploads and DocumentCard list filtered to contractor
- Compliance tab has real upload capability via DropZone and DocumentList, replacing disabled "Coming in Phase 3" buttons
- Profile header "Add contract" button wired to contract wizard with contractorId pre-fill
- Settings page has ExpiryReminderDefaults card with comma-separated day input and save functionality
- Full i18n: Contracts namespace (table, wizard, detail, amendments, side panel, validation, errors), Documents namespace (dropZone, upload, scan, metadata, contractor tab, compliance), Settings.expiryReminders

## Task Commits

Each task was committed atomically:

1. **Task 1: Contractor profile tab integration and compliance upload, plus Settings page reminder defaults** - `f089670` (feat)
2. **Task 2: Full Phase 3 i18n** - `1aeebcf` (feat)

## Files Created/Modified
- `apps/web/src/components/contractors/contractor-profile/tab-contracts.tsx` - Mini TanStack Table for contractor contracts with pagination and wizard CTA
- `apps/web/src/components/contractors/contractor-profile/tab-documents.tsx` - Document cards with DropZone upload filtered to contractor
- `apps/web/src/components/settings/expiry-reminder-defaults.tsx` - Org-level expiry reminder defaults card
- `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx` - Added contractsContent/documentsContent props, removed TabPlaceholder for contracts/documents
- `apps/web/src/components/contractors/contractor-profile/tab-compliance.tsx` - Added DropZone and DocumentList for compliance document upload
- `apps/web/src/components/contractors/contractor-profile/profile-header.tsx` - Wired Add Contract button to ContractWizardDialog
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx` - Pass TabContracts and TabDocuments to ProfileTabs
- `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` - Added ExpiryReminderDefaults below OrgSettingsForm
- `apps/web/messages/en.json` - Full Contracts, Documents, Settings.expiryReminders namespaces
- `apps/web/messages/pl.json` - Full Polish translations for all Phase 3 namespaces

## Decisions Made
- Used mini TanStack Table with simple prev/next pagination in contractor Contracts tab (not full nuqs URL state -- appropriate for embedded sub-table)
- DropZone always shown in Documents tab even in empty state for immediate upload convenience
- Compliance tab upload CTA scrolls to DropZone section at bottom rather than opening dialog
- ExpiryReminderDefaults implemented as standalone Card component in Settings general tab
- i18n keys duplicated at both nested path (e.g., `pagination.rowsPerPage`) and flat path (`rowsPerPage`) to support different component access patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed unused Tooltip imports from profile-header and tab-compliance**
- **Found during:** Task 1
- **Issue:** After replacing disabled tooltip-wrapped buttons with working ones, unused imports would cause lint/build warnings
- **Fix:** Removed Tooltip, TooltipTrigger, TooltipContent, TooltipProvider imports from both files
- **Files modified:** profile-header.tsx, tab-compliance.tsx
- **Committed in:** f089670 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Removed unused FileText and Files lucide imports from profile-tabs**
- **Found during:** Task 1
- **Issue:** After replacing TabPlaceholder content for contracts/documents tabs, FileText and Files icons no longer used
- **Fix:** Removed unused icon imports from lucide-react import statement
- **Files modified:** profile-tabs.tsx
- **Committed in:** f089670 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical -- unused import cleanup)
**Impact on plan:** Minor cleanup auto-fixes. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 (Contracts & Documents) is now complete -- all 6 plans executed
- All contractor profile tabs show real data (Overview, Contracts, Documents, Compliance, Activity)
- Settings page has org-level expiry reminder defaults
- Full EN/PL i18n coverage for all Phase 3 features
- Ready for Phase 4 (Workflow Engine)

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 03-contracts-documents*
*Completed: 2026-03-20*
