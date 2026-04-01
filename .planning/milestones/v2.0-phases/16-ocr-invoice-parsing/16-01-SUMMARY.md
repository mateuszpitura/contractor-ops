---
phase: 16-ocr-invoice-parsing
plan: 01
subsystem: api
tags: [ocr, claude-vision, anthropic-sdk, qstash, prisma, pdf, nip-validation]

# Dependency graph
requires:
  - phase: 12-integration-foundation
    provides: adapter registry, QStash client, IntegrationProviderAdapter interface
  - phase: 15-esign-integration
    provides: adapter pattern reference (ESignAdapter), register-all.ts pattern
provides:
  - OcrAdapter interface for provider-agnostic document extraction
  - ClaudeOcrAdapter with native PDF support and tool_use structured output
  - OcrExtraction Prisma model with lifecycle status tracking
  - NIP modulo-11 checksum validation utility
  - Confidence post-processing (cross-validation and NIP adjustment)
  - ocr-service orchestration layer
  - tRPC ocr router (trigger, getResult, getByDocument, retrigger) for admin and portal
  - QStash async callback at /api/ocr/_process
  - triggerOcrExtraction and processOcrExtraction orchestrator functions
affects: [16-02, 16-03, invoice-upload, portal-invoice-submit]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk ^0.80.0"]
  patterns: [ocr-adapter-interface, claude-native-pdf-document-type, tool_use-structured-extraction, grosze-normalization]

key-files:
  created:
    - packages/db/prisma/schema/ocr.prisma
    - packages/integrations/src/types/ocr.ts
    - packages/integrations/src/adapters/claude-ocr-adapter.ts
    - packages/integrations/src/services/ocr-service.ts
    - packages/api/src/services/ocr-extraction.ts
    - packages/api/src/routers/ocr.ts
    - apps/web/src/app/api/ocr/_process/route.ts
    - packages/integrations/src/adapters/__tests__/claude-ocr-adapter.test.ts
    - packages/integrations/src/services/__tests__/ocr-service.test.ts
    - packages/api/src/routers/__tests__/ocr.test.ts
  modified:
    - packages/integrations/src/adapters/register-all.ts
    - packages/integrations/package.json
    - packages/api/src/root.ts
    - packages/api/package.json
    - packages/db/prisma/schema/organization.prisma

key-decisions:
  - "Claude claude-sonnet-4-5-20250514 as default OCR model, configurable via adapter constructor"
  - "Native PDF document type (no image conversion) with tool_use for guaranteed JSON structure"
  - "Amounts normalized from decimal to grosze (integer) immediately in adapter response"
  - "NIP validation uses modulo-11 checksum with confidence cap at 40 for invalid NIPs"
  - "Amount cross-validation caps confidence at 60 when net + tax != gross"

patterns-established:
  - "OcrAdapter interface mirrors ESignAdapter pattern for provider-agnostic extraction"
  - "ClaudeOcrAdapter registered in adapter registry via register-all.ts (cast to IntegrationProviderAdapter)"
  - "QStash callback pattern at /api/ocr/_process with verifySignatureAppRouter"

requirements-completed: [OCR-01, OCR-02]

# Metrics
duration: 19min
completed: 2026-03-27
---

# Phase 16 Plan 01: OCR Backend Summary

**Claude Vision OCR pipeline with native PDF extraction, NIP checksum validation, confidence scoring, async QStash processing, and tRPC endpoints for admin and portal**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-27T15:03:40Z
- **Completed:** 2026-03-27T15:22:49Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Complete OCR adapter interface with ClaudeOcrAdapter using native PDF document support and tool_use structured output
- NIP modulo-11 checksum validation with confidence adjustment for invalid NIPs and amount cross-validation
- OcrExtraction Prisma model tracking extraction lifecycle (PENDING -> PROCESSING -> EXTRACTED/PARTIAL/FAILED)
- Async extraction pipeline via QStash with R2 PDF fetch and result persistence
- Full tRPC router with admin and portal endpoints (trigger, getResult, getByDocument, retrigger)

## Task Commits

Each task was committed atomically:

1. **Task 1: OCR types, Prisma schema, Claude adapter, and OCR service** - `2ebd852` (feat)
2. **Task 2: OCR extraction orchestrator, tRPC router, and QStash callback** - `3dff7a9` (feat)

## Files Created/Modified
- `packages/db/prisma/schema/ocr.prisma` - OcrExtraction model, OcrProvider and OcrExtractionStatus enums
- `packages/integrations/src/types/ocr.ts` - OcrAdapter interface, extraction types, validateNip, adjustConfidences
- `packages/integrations/src/adapters/claude-ocr-adapter.ts` - Claude Vision OCR with native PDF and tool_use
- `packages/integrations/src/services/ocr-service.ts` - Provider-agnostic OCR orchestration
- `packages/integrations/src/adapters/register-all.ts` - Added ClaudeOcrAdapter registration
- `packages/integrations/package.json` - Added @anthropic-ai/sdk, ocr-service and types/ocr exports
- `packages/api/src/services/ocr-extraction.ts` - Extraction orchestrator (trigger, process, query)
- `packages/api/src/routers/ocr.ts` - tRPC router with admin and portal endpoints
- `packages/api/src/root.ts` - Added ocr router to appRouter
- `packages/api/package.json` - Added ocr-extraction service export
- `apps/web/src/app/api/ocr/_process/route.ts` - QStash callback with signature verification
- `packages/integrations/src/adapters/__tests__/claude-ocr-adapter.test.ts` - Adapter, NIP, confidence tests
- `packages/integrations/src/services/__tests__/ocr-service.test.ts` - Service orchestration tests
- `packages/api/src/routers/__tests__/ocr.test.ts` - Router test stubs

## Decisions Made
- Used claude-sonnet-4-5-20250514 as default model (configurable via constructor) -- best cost/performance ratio for invoice extraction
- Native PDF document type with base64 encoding (no PDF-to-image conversion) -- Claude handles PDF internally, preserves text layer
- Amounts normalized from decimal to grosze immediately in adapter response -- matches existing Invoice model pattern
- NIP validation caps confidence to 40 (not zero) to indicate "suspicious but possibly correct" -- avoids over-penalizing OCR output
- Amount cross-validation caps confidence to 60 when net + tax != gross -- signals inconsistency without rejecting all values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- NIP "0000000000" is technically valid per modulo-11 algorithm (sum=0, remainder=0, check digit=0) -- updated test to use "1234567890" which has remainder 10 (always invalid per spec)
- Base64 size calculation for 40MB string decoded to exactly 30MB (not exceeding the limit) -- increased test string to 41MB

## User Setup Required
None - no external service configuration required. ANTHROPIC_API_KEY environment variable must be set for Claude OCR to function but this is an existing env var pattern.

## Known Stubs
None - all code is fully wired. Test stubs in packages/api/src/routers/__tests__/ocr.test.ts use `it.todo()` following the project convention established in Phase 14/15.

## Next Phase Readiness
- OCR backend complete and ready for frontend integration (Plan 16-02)
- tRPC endpoints available for both admin invoice form and portal submit form
- Extraction results include field-level confidence scores for UI color-coding

---
*Phase: 16-ocr-invoice-parsing*
*Completed: 2026-03-27*
