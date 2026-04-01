---
phase: 13-contractor-portal-auth-core-views
plan: 01
subsystem: auth
tags: [prisma, portal, magic-link, session, sha256, crypto]

# Dependency graph
requires:
  - phase: 12-integration-foundation
    provides: "Integration infrastructure, Resend dependency"
provides:
  - "PortalSession and PortalMagicToken Prisma models"
  - "Portal session CRUD service (create, validate, delete, cleanup)"
  - "Magic link token service (create, verify, single-use enforcement)"
  - "Cross-org contractor email lookup"
  - "PORTAL value in InvoiceSource enum"
affects: [13-02, 13-03, 13-04, 13-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Portal auth via separate PortalSession model (not internal User table)"
    - "SHA-256 token hashing before DB storage"
    - "Single-use magic link with usedAt timestamp enforcement"
    - "Cross-org query via raw prisma client (bypassing tenant scoping)"

key-files:
  created:
    - packages/db/prisma/schema/portal.prisma
    - packages/api/src/services/portal-session.ts
    - packages/api/src/services/portal-magic-link.ts
  modified:
    - packages/db/prisma/schema/invoice.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/src/tenant.ts

key-decisions:
  - "Used raw prisma client for all portal services since PortalSession/PortalMagicToken are in globalModels and Contractor cross-org lookup needs unscoped access"
  - "Lazy-init Resend client pattern matching notification-service.ts"

patterns-established:
  - "Portal models excluded from tenant scoping via globalModels set"
  - "Token hashing with SHA-256 for all portal tokens (session + magic link)"

requirements-completed: [PORT-01]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 13 Plan 01: Portal Auth Models & Services Summary

**PortalSession and PortalMagicToken Prisma models with SHA-256 hashed session service (7-day expiry) and single-use magic link service (15-min expiry, Resend email)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T14:47:10Z
- **Completed:** 2026-03-23T14:49:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- PortalSession and PortalMagicToken Prisma models with proper indexes and relations
- Portal session service with full lifecycle: create (hashed), validate, delete, cleanup expired
- Magic link service with single-use tokens, cross-org contractor lookup, and Resend email sending
- PORTAL added to InvoiceSource enum for portal-submitted invoices
- Both portal models excluded from tenant scoping in globalModels

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Prisma models, update InvoiceSource, update globalModels** - `4894ef7` (feat)
2. **Task 2: Create portal session service and magic link service** - `4e8580e` (feat)

## Files Created/Modified
- `packages/db/prisma/schema/portal.prisma` - PortalSession and PortalMagicToken models with indexes
- `packages/db/prisma/schema/invoice.prisma` - Added PORTAL to InvoiceSource enum
- `packages/db/prisma/schema/contractor.prisma` - Added portalSessions relation
- `packages/db/prisma/schema/organization.prisma` - Added portalSessions relation
- `packages/db/src/tenant.ts` - Added PortalSession and PortalMagicToken to globalModels
- `packages/api/src/services/portal-session.ts` - Session CRUD with SHA-256 hashing, 7-day expiry
- `packages/api/src/services/portal-magic-link.ts` - Magic link tokens, contractor lookup, email sending

## Decisions Made
- Used raw prisma client (not tenant-scoped) for all portal services — PortalSession and PortalMagicToken are in globalModels so they bypass scoping, and findContractorsByEmail needs cross-org access which the raw client provides
- Followed lazy-init Resend client pattern from notification-service.ts for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in packages/db (soft-delete.ts) and packages/api (routers) related to Prisma client type resolution — these are not caused by portal changes and exist across all model accessors in the codebase

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Portal auth foundation complete — session and magic link services ready for tRPC router integration
- Plan 13-02 (portal login tRPC routes and middleware) can proceed immediately
- All exports match the plan spec: createPortalSession, validatePortalSession, deletePortalSession, hashToken, generateSessionToken, createMagicLinkToken, verifyMagicLinkToken, findContractorsByEmail, sendPortalMagicLink

---
*Phase: 13-contractor-portal-auth-core-views*
*Completed: 2026-03-23*
