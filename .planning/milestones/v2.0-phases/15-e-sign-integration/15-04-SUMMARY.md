---
phase: 15-e-sign-integration
plan: 04
subsystem: ui
tags: [react, trpc, esign, docusign, autenti, dnd-kit, shadcn, portal]

# Dependency graph
requires:
  - phase: 15-e-sign-integration
    provides: SigningEnvelope/SigningRecipient/SigningEvent Prisma models, ESignAdapter interface
  - phase: 15-e-sign-integration
    provides: tRPC esign router with 7 procedures, orchestrator, webhook handler
  - phase: 12-integration-foundation
    provides: IntegrationConnection model, credential store
provides:
  - SendForSignatureButton with provider/document prerequisite tooltips
  - SendForSignatureDialog with provider picker, dnd-kit signer reorder, message, document preview, expiry/reminders
  - SigningProgressBar with per-signer step indicators (pending/current/signed/declined states)
  - SigningStatusBadge mapping 10+ signing statuses to Badge variants
  - SigningAuditTrail Sheet with chronological event list and event-type icons
  - EmbeddedSigningModal with DocuSign iframe and Autenti redirect fallback
  - VoidEnvelopeDialog with destructive AlertDialog pattern
  - PortalPendingSignatures section with Sign Now buttons and EmbeddedSigningModal
  - listConnections query on esign router for provider picker
affects: [contract-detail, portal-dashboard, signing-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [esign-ui-components, embedded-signing-iframe, portal-pending-signatures]

key-files:
  created:
    - apps/web/src/components/contracts/contract-detail/send-for-signature-button.tsx
    - apps/web/src/components/contracts/contract-detail/send-for-signature-dialog.tsx
    - apps/web/src/components/contracts/contract-detail/signing-progress-bar.tsx
    - apps/web/src/components/contracts/contract-detail/signing-status-badge.tsx
    - apps/web/src/components/contracts/contract-detail/signing-audit-trail.tsx
    - apps/web/src/components/contracts/contract-detail/embedded-signing-modal.tsx
    - apps/web/src/components/contracts/contract-detail/void-envelope-dialog.tsx
    - apps/web/src/components/portal/portal-pending-signatures.tsx
    - packages/api/src/types/docusign-esign.d.ts
  modified:
    - packages/api/src/routers/esign.ts
    - apps/web/src/components/contracts/contract-detail/detail-header.tsx
    - apps/web/src/components/contracts/contract-detail/documents-tab.tsx
    - apps/web/src/components/contracts/contract-detail/contract-detail-tabs.tsx
    - apps/web/src/app/[locale]/(dashboard)/contracts/[id]/page.tsx
    - apps/web/src/app/[locale]/(portal)/page.tsx

key-decisions:
  - "Added listConnections query to esign router (not integration router) for provider picker - avoids coupling UI to integration internals"
  - "Added docusign-esign.d.ts to api package to unblock composite TypeScript builds"
  - "Used per-document buttons in DocumentsTab instead of modifying DocumentCard to avoid invasive changes to existing component"
  - "Status badge styles for PENDING_SIGNATURE changed from muted to warning (amber) per UI-SPEC"

patterns-established:
  - "E-sign UI components follow existing contract-detail pattern: colocated in contract-detail/ directory"
  - "Portal pending signatures self-manages data fetching and hides when empty"
  - "Embedded signing uses postMessage listener for DocuSign iframe events"

requirements-completed: [SIGN-01, SIGN-02, SIGN-03, SIGN-04]

# Metrics
duration: 10min
completed: 2026-03-23
---

# Phase 15 Plan 04: E-Sign UI Components Summary

**Complete e-sign UI: SendForSignature dialog with dnd-kit signer reorder and provider picker, signing progress bar with per-signer step indicators, embedded signing modal with DocuSign iframe and Autenti redirect fallback, audit trail sheet, void dialog, and portal pending signatures section**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-23T22:48:01Z
- **Completed:** 2026-03-23T22:58:01Z
- **Tasks:** 2 (of 3, checkpoint pending)
- **Files modified:** 15

## Accomplishments
- 8 new e-sign UI components covering the complete signing lifecycle from admin send to contractor portal signing
- SendForSignatureDialog with 5 sections per D-07: provider picker, signer list with drag reorder, message textarea, document preview, expiry/reminders selects
- EmbeddedSigningModal with DocuSign iframe postMessage listener and Autenti redirect fallback card
- SigningProgressBar with animated step indicators (pending/current/signed/declined) and inline void/resend actions
- PortalPendingSignatures section on portal dashboard with Sign Now buttons opening embedded signing modal
- Contract detail page enriched with signing progress between header and tabs, provider connectivity check for button state
- Status badge mapping extended for SIGNATURE_DECLINED and SIGNATURE_EXPIRED statuses

## Task Commits

Each task was committed atomically:

1. **Task 1: Create all e-sign UI components** - `c631ef8` (feat)
2. **Task 2: Wire components into contract detail, documents tab, and portal** - `22580c7` (feat)
3. **Task 3: Visual verification checkpoint** - PENDING (checkpoint:human-verify)

## Files Created/Modified
- `apps/web/src/components/contracts/contract-detail/send-for-signature-button.tsx` - Primary CTA with PenLine icon, disabled tooltips
- `apps/web/src/components/contracts/contract-detail/send-for-signature-dialog.tsx` - Full setup dialog with 5 sections per D-07
- `apps/web/src/components/contracts/contract-detail/signing-progress-bar.tsx` - Horizontal progress with per-signer steps
- `apps/web/src/components/contracts/contract-detail/signing-status-badge.tsx` - Status-to-Badge variant mapping
- `apps/web/src/components/contracts/contract-detail/signing-audit-trail.tsx` - Sheet with chronological event list
- `apps/web/src/components/contracts/contract-detail/embedded-signing-modal.tsx` - Full-viewport iframe/redirect modal
- `apps/web/src/components/contracts/contract-detail/void-envelope-dialog.tsx` - Destructive AlertDialog for voiding
- `apps/web/src/components/portal/portal-pending-signatures.tsx` - Portal section with Sign Now buttons
- `packages/api/src/routers/esign.ts` - Added listConnections query for provider picker
- `packages/api/src/types/docusign-esign.d.ts` - Module declaration for composite builds
- `apps/web/src/components/contracts/contract-detail/detail-header.tsx` - Added SendForSignatureButton, updated signing status badges
- `apps/web/src/components/contracts/contract-detail/documents-tab.tsx` - Added per-document Send for Signature buttons
- `apps/web/src/components/contracts/contract-detail/contract-detail-tabs.tsx` - Pass contractParties to DocumentsTab
- `apps/web/src/app/[locale]/(dashboard)/contracts/[id]/page.tsx` - Queries connections/envelopes, renders SigningProgressBar
- `apps/web/src/app/[locale]/(portal)/page.tsx` - Renders PortalPendingSignatures above greeting

## Decisions Made
- Added `listConnections` query to esign router for the provider picker UI, avoiding coupling to the integration router
- Added `docusign-esign.d.ts` module declaration to API package to unblock TypeScript composite builds (pre-existing TS7016 error)
- Used per-document buttons in DocumentsTab rather than modifying DocumentCard internals to avoid invasive changes
- Updated PENDING_SIGNATURE badge style from muted to warning (amber) per UI-SPEC color mapping

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added listConnections query to esign router**
- **Found during:** Task 1
- **Issue:** No existing tRPC procedure to list e-sign provider connections with IDs for the provider picker UI
- **Fix:** Added `listConnections` query to esign router that fetches DOCUSIGN/AUTENTI connections with CONNECTED status
- **Files modified:** packages/api/src/routers/esign.ts
- **Committed in:** c631ef8 (Task 1 commit)

**2. [Rule 3 - Blocking] Added docusign-esign.d.ts to API package**
- **Found during:** Task 1 (verification)
- **Issue:** API package TypeScript build failed due to docusign-esign missing type declarations when building composite project
- **Fix:** Added minimal `declare module "docusign-esign"` to packages/api/src/types/docusign-esign.d.ts
- **Files modified:** packages/api/src/types/docusign-esign.d.ts
- **Committed in:** c631ef8 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed PENDING_SIGNATURE badge style**
- **Found during:** Task 2
- **Issue:** PENDING_SIGNATURE used muted style instead of warning (amber) per UI-SPEC
- **Fix:** Changed from `bg-muted text-muted-foreground` to `bg-amber-500/10 text-amber-600`
- **Files modified:** apps/web/src/components/contracts/contract-detail/detail-header.tsx
- **Committed in:** 22580c7 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for correctness and build success. No scope creep.

## Issues Encountered
- dnd-kit packages were already installed in apps/web/package.json (no installation needed)
- Pre-existing TS errors in portal/login, oauth/callback, import-wizard, admin-branding -- not caused by this plan

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All e-sign UI components created and wired into existing pages
- Task 3 (checkpoint:human-verify) pending for visual verification
- Full signing flow ready for end-to-end testing once providers are configured

## Self-Check: PASSED

All 9 created files verified on disk. Both commit hashes (c631ef8, 22580c7) found in git log.

---
*Phase: 15-e-sign-integration*
*Completed: 2026-03-23*
