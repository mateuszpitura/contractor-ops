---
phase: 63-uk-payments-financial-features
plan: 04
subsystem: api, ui, payments
tags: [bacs, trpc, react, shadcn, feature-flags, encryption, r2, modulus-check]

requires:
  - phase: 63-uk-payments-financial-features
    plan: 01
    provides: Prisma models (PaymentExport, BACS_STD18 enum, org submitter fields, billing profile UK fields), BACS validators, feature flags, i18n
  - phase: 63-uk-payments-financial-features
    plan: 02
    provides: generateBacsStandard18 function, BacsExportItem/BacsOrgBankInfo/BacsGenerateResult types, ASCII transliteration
provides:
  - BACS tRPC router with 4 procedures (previewExport, generateExport, validateSortCode, saveSubmitterConfig)
  - BACS settings page at /settings/payments/ with admin permission gate
  - BACS file preview card with transliteration/modulus warnings and signed download
  - UK bank fields section (collapsible, GB-only) on billing profile forms
  - Sort code inline validator with VocaLink modulus check UI
affects: [63-05, 63-06, 63-07]

tech-stack:
  added: []
  patterns:
    - "tenantFlaggedProcedure + requireFeatureFlag pattern for BACS feature gating"
    - "AES-256-GCM encrypt/decrypt + masked preview pattern for BACS submitter org config"
    - "R2 putObjectAndSignDownload with SHA-256 content-addressed key for payment exports"
    - "useFlag client-side feature flag consumption for conditional BACS UI rendering"

key-files:
  created:
    - packages/api/src/routers/bacs.ts
    - apps/web/src/app/[locale]/(dashboard)/settings/payments/page.tsx
    - apps/web/src/components/payments/bacs/bacs-submitter-form.tsx
    - apps/web/src/components/payments/bacs/bacs-preview-card.tsx
    - apps/web/src/components/payments/bacs/bacs-preview-pre.tsx
    - apps/web/src/components/payments/bacs/transliteration-warning-banner.tsx
    - apps/web/src/components/payments/bacs/modulus-check-warning-list.tsx
    - apps/web/src/components/contractors/billing-profile/uk-bank-fields-section.tsx
    - apps/web/src/components/contractors/billing-profile/sort-code-validator.tsx
  modified:
    - packages/api/src/root.ts

key-decisions:
  - "Used tenantFlaggedProcedure + requireFeatureFlag middleware chain for BACS procedures instead of inline flag check"
  - "Stored PaymentExport without r2Key/sha256 fields (using existing schema structure with documentId relation)"
  - "Sort code auto-format on display (12-34-56) but stored as raw 6 digits for schema compatibility"

patterns-established:
  - "BACS feature flag gate: tenantFlaggedProcedure.use(requireFeatureFlag('payments.bacs-enabled')) for server, useFlag('payments.bacs-enabled') for client"
  - "Masked bank field preview: encrypt on save, store masked version separately, never return encrypted to client"

requirements-completed: [PAY-01]

duration: 12min
completed: 2026-04-15
---

# Phase 63 Plan 04: BACS Router + Settings + Preview UI Summary

**BACS tRPC router with encrypted submitter config, file preview/download with transliteration and modulus warnings, and UK bank fields on contractor billing profiles**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-15T00:38:04Z
- **Completed:** 2026-04-15T00:50:52Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- BACS tRPC router with 4 procedures: previewExport, generateExport, validateSortCode, saveSubmitterConfig
- Settings page at /settings/payments/ with admin permission gate and feature flag banner
- BACS file preview card with scrollable monospace preview, transliteration/modulus warnings, and signed R2 download
- UK bank fields section (collapsible, GB-only) with sort code auto-format and inline VocaLink modulus validation

## Task Commits

Each task was committed atomically:

1. **Task 1: BACS tRPC router** - `60d90a89` (feat)
2. **Task 2: BACS settings page + preview components + UK bank fields** - `82a86b2a` (feat)

## Files Created/Modified
- `packages/api/src/routers/bacs.ts` - BACS tRPC router with 4 procedures (preview, generate, validate, save config)
- `packages/api/src/root.ts` - Added bacsRouter to appRouter
- `apps/web/src/app/[locale]/(dashboard)/settings/payments/page.tsx` - BACS settings page with permission gate
- `apps/web/src/components/payments/bacs/bacs-submitter-form.tsx` - Submitter config form (SUN, sort code, account, name)
- `apps/web/src/components/payments/bacs/bacs-preview-card.tsx` - BACS file preview + download card
- `apps/web/src/components/payments/bacs/bacs-preview-pre.tsx` - Accessible scrollable monospace file preview
- `apps/web/src/components/payments/bacs/transliteration-warning-banner.tsx` - Warning/error banner for character transliteration
- `apps/web/src/components/payments/bacs/modulus-check-warning-list.tsx` - Per-item modulus check result list
- `apps/web/src/components/contractors/billing-profile/uk-bank-fields-section.tsx` - UK bank fields (GB-only collapsible)
- `apps/web/src/components/contractors/billing-profile/sort-code-validator.tsx` - Inline sort code validation button + badge

## Decisions Made
- Used `tenantFlaggedProcedure` + `requireFeatureFlag` middleware chain rather than inline flag checks for cleaner separation
- PaymentExport record created using existing schema (no r2Key/sha256 columns exist yet -- logged for deferred items)
- Sort code displayed with hyphens (12-34-56) but stored as raw 6 digits to match the sortCodeSchema from validators

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored packages/api/src/root.ts from git base**
- **Found during:** Task 1 (wire bacsRouter into appRouter)
- **Issue:** root.ts not checked out in sparse worktree -- file existed in git history but not on disk
- **Fix:** Extracted from base commit and added to worktree, then applied bacsRouter import + registration
- **Files modified:** packages/api/src/root.ts
- **Verification:** grep confirms bacsRouter in appRouter
- **Committed in:** 60d90a89 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor worktree artifact. No scope creep.

## Issues Encountered
- Plan references `packages/api/src/routers/index.ts` but the appRouter is actually in `packages/api/src/root.ts` -- adapted accordingly
- `generateBacsStandard18` function from Plan 63-02 has not landed yet (parallel execution) -- router imports it expecting it will be available after worktree merge
- i18n keys for Payments.bacs* namespace not available in this worktree (added by 63-01 in parallel) -- components reference expected keys that will resolve after merge

## Known Stubs
None -- all components are fully wired to tRPC procedures. Data flow depends on Plan 63-02 `generateBacsStandard18` landing (import will resolve at merge time).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BACS export workflow complete: submitter config -> preview -> download
- Plans 63-05, 63-06, 63-07 can proceed with BACS foundation in place
- Integration testing requires Plans 63-01 (DB/validators) and 63-02 (generator) to be merged first

---
*Phase: 63-uk-payments-financial-features*
*Completed: 2026-04-15*
