---
phase: 15-e-sign-integration
plan: 03
subsystem: api
tags: [trpc, esign, docusign, autenti, webhooks, r2, csp, orchestrator]

# Dependency graph
requires:
  - phase: 15-e-sign-integration
    provides: SigningEnvelope/SigningRecipient/SigningEvent Prisma models, ESignAdapter interface
  - phase: 15-e-sign-integration
    provides: DocuSign and Autenti adapters, esign-service orchestration layer
  - phase: 12-integration-foundation
    provides: BaseAdapter, adapter registry, webhook infrastructure, credential store
provides:
  - tRPC esign router with 7 procedures (sendForSignature, getSigningUrl, voidEnvelope, resendToRecipient, getEnvelopeDetail, listEnvelopes, listPendingForContractor)
  - E-sign orchestrator service with complete signing lifecycle management
  - Signing webhook handler with idempotency, status mapping, and completion signal
  - CSP configuration for DocuSign iframe embedding
affects: [15-04, esign-ui, contract-detail-signing, portal-pending-signatures]

# Tech tracking
tech-stack:
  added: []
  patterns: [esign-orchestrator-pattern, webhook-completion-signal, csp-frame-src]

key-files:
  created:
    - packages/api/src/services/esign-orchestrator.ts
    - packages/api/src/routers/esign.ts
    - packages/integrations/src/services/esign-webhook-handler.ts
  modified:
    - packages/api/src/root.ts
    - packages/api/package.json
    - packages/integrations/src/adapters/docusign-adapter.ts
    - packages/integrations/src/adapters/autenti-adapter.ts
    - apps/web/src/app/api/webhooks/_process/route.ts
    - apps/web/next.config.ts

key-decisions:
  - "Webhook completion signal via _lastWebhookResult on adapters; _process route checks flag and calls handleSigningCompletion from api package"
  - "CSP frame-src added as Next.js headers() config rather than middleware to keep config centralized"
  - "Signed PDFs from providers marked virusScanStatus CLEAN (trusted source)"

patterns-established:
  - "E-sign orchestrator pattern: api service coordinates between integrations adapter, R2 storage, and Prisma records"
  - "Webhook completion signal: handler in integrations returns { completed: boolean }, caller in apps/web triggers api orchestrator"
  - "No circular dependency enforced: integrations -> db only; api -> integrations; apps/web -> both"

requirements-completed: [SIGN-01, SIGN-02, SIGN-03, SIGN-04]

# Metrics
duration: 7min
completed: 2026-03-23
---

# Phase 15 Plan 03: tRPC E-Sign Router, Orchestrator, and Webhook Handler Summary

**Complete server-side signing lifecycle: tRPC router with 7 procedures, orchestrator for envelope creation/void/completion with R2 PDF storage, and webhook handler with idempotency and contract status mapping**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-23T22:37:50Z
- **Completed:** 2026-03-23T22:45:22Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- E-sign orchestrator with sendForSignature (creates envelope + recipients + events + contract status update), getSigningUrl (on-demand embedded URL), handleSigningCompletion (downloads signed PDF, uploads to R2, creates Document with source ESIGN and DocumentLink with SIGNED_COPY role), voidEnvelope (reverts contract to DRAFT), resendToRecipient
- tRPC esign router with 7 procedures including listPendingForContractor for portal "Pending Signatures" section
- Webhook handler with idempotency (providerEventId dedup), $transaction for status updates, contract status mapping (COMPLETED->ACTIVE, DECLINED->SIGNATURE_DECLINED, EXPIRED->SIGNATURE_EXPIRED), and completion signal for PDF download
- CSP frame-src configured for DocuSign embedded signing iframe domains

## Task Commits

Each task was committed atomically:

1. **Task 1: Create e-sign orchestrator service and tRPC router** - `f23348a` (feat)
2. **Task 2: Create signing webhook handler and update CSP for DocuSign iframe** - `68fa825` (feat)

## Files Created/Modified
- `packages/api/src/services/esign-orchestrator.ts` - Business logic: sendForSignature, getSigningUrl, handleSigningCompletion, voidEnvelope, resendToRecipient
- `packages/api/src/routers/esign.ts` - tRPC router with 7 procedures for all e-sign operations
- `packages/api/src/root.ts` - Added esign router to appRouter
- `packages/api/package.json` - Added esign-orchestrator export path
- `packages/integrations/src/services/esign-webhook-handler.ts` - Webhook event processing with idempotency, status mapping, and completion signal
- `packages/integrations/src/adapters/docusign-adapter.ts` - Added handleWebhook delegating to shared handler
- `packages/integrations/src/adapters/autenti-adapter.ts` - Added handleWebhook delegating to shared handler
- `apps/web/src/app/api/webhooks/_process/route.ts` - Wired handleSigningCompletion for e-sign completion events
- `apps/web/next.config.ts` - CSP frame-src for DocuSign iframe embedding

## Decisions Made
- Used _lastWebhookResult property on adapters to pass completion signal from handleWebhook (void return) to _process route, avoiding changes to the BaseAdapter interface contract
- CSP configured via Next.js headers() config function rather than middleware for centralized management
- Signed PDFs from providers marked as virusScanStatus CLEAN since they come from trusted e-sign providers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added esign-orchestrator export path to api package.json**
- **Found during:** Task 2
- **Issue:** `@contractor-ops/api/services/esign-orchestrator` import in _process route would fail without package export
- **Fix:** Added export mapping in packages/api/package.json
- **Files modified:** packages/api/package.json
- **Committed in:** 68fa825 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for correct module resolution. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete API surface ready for Plan 04 (e-sign UI components)
- tRPC procedures available for signing dialog, status tracking, and envelope management
- Portal procedure ready for contractor pending signatures view
- CSP configured for DocuSign embedded signing iframe

---
*Phase: 15-e-sign-integration*
*Completed: 2026-03-23*
