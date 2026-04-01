---
phase: 27-oauth-callback-ocr-build-fixes
plan: 01
subsystem: api, ui
tags: [oauth, react-pdf, next.js, integrations]

requires:
  - phase: 12-integration-foundation
    provides: OAuth callback route, adapter registry pattern
  - phase: 16-ocr-invoice-parsing
    provides: PdfViewer component with react-pdf

provides:
  - OAuth callback route with populated adapter registry
  - PdfViewer with build-compatible dynamic CSS imports

affects: []

tech-stack:
  added: []
  patterns:
    - "Dynamic CSS import via useEffect for SSR-incompatible styles"

key-files:
  created: []
  modified:
    - apps/web/src/app/api/oauth/[provider]/callback/route.ts
    - apps/web/src/components/ocr/pdf-viewer.tsx

key-decisions:
  - "Module-level registerAllAdapters() call — runs once at import, not per-request"
  - "Dynamic CSS import with `as never` cast — standard react-pdf workaround for Next.js SSR"

patterns-established:
  - "Module-level adapter registration: API routes that use getAdapter() must call registerAllAdapters() at top level"

requirements-completed: [INTG-01, OCR-03]

duration: 5min
completed: 2026-04-01
---

# Phase 27: OAuth Callback & OCR Build Fixes Summary

**registerAllAdapters() added to OAuth callback route + react-pdf CSS converted to dynamic imports for Next.js build compatibility**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-01T17:05:00Z
- **Completed:** 2026-04-01T17:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- OAuth callback route now populates adapter registry before getAdapter() — all provider connect flows unblocked
- react-pdf CSS imports converted from static to dynamic useEffect — Next.js production build unblocked for OcrReviewPanel

## Task Commits

Each task was committed atomically:

1. **Task 1: Add registerAllAdapters() to OAuth callback route** - `cf5bd29` (feat)
2. **Task 2: Fix react-pdf CSS build failure** - `1e41d01` (feat)

## Files Created/Modified
- `apps/web/src/app/api/oauth/[provider]/callback/route.ts` - Added registerAllAdapters import and module-level call
- `apps/web/src/components/ocr/pdf-viewer.tsx` - Replaced static CSS imports with dynamic useEffect imports

## Decisions Made
- react-pdf already in transpilePackages (from Phase 15) — only CSS import change needed
- Used `as never` cast for dynamic CSS import — standard TypeScript workaround for CSS module side-effects

## Deviations from Plan

### Auto-fixed Issues

**1. transpilePackages already configured**
- **Found during:** Task 2 (react-pdf CSS fix)
- **Issue:** Plan specified adding `react-pdf` to transpilePackages but it was already present from Phase 15
- **Fix:** Skipped the next.config.ts change, only modified pdf-viewer.tsx
- **Impact:** None — one fewer file to modify

---

**Total deviations:** 1 (pre-existing config)
**Impact on plan:** Trivial — reduced scope by 1 file change.

## Issues Encountered
- API 500 error interrupted first executor agent after Task 1 — resumed inline, Task 2 completed manually

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All v2.0 milestone gaps closed
- Ready for milestone re-audit and completion

---
*Phase: 27-oauth-callback-ocr-build-fixes*
*Completed: 2026-04-01*
