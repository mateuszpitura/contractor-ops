---
phase: 54-regional-routing-adoption-gov-api-wiring
plan: 01
status: complete
started: 2026-04-12
completed: 2026-04-12
requirements_completed: [INFRA-01, INFRA-02, INFRA-03]
---

# Plan 54-01: Core Router Migration + Regional Storage — SUMMARY

## What Was Built

Migrated 22 core/foundation routers from direct `prisma` import to `ctx.db` (regional Prisma client) and switched 4 routers from legacy `r2.ts` to `regional-storage.ts`.

## Key Changes

- Removed `import { prisma } from "@contractor-ops/db"` from 22 routers (contractor, contract, document, invoice, payment, approval, dashboard, report, settings, gdpr, user, notification, audit, search, import, reminder, workflow, workflow-execution, workflow-templates, workflow-shared, organization)
- Replaced all `prisma.` calls with `ctx.db.` in handler bodies
- Document router: switched from r2.ts to regional-storage.ts (createRegionalPresignedUploadUrl, createRegionalPresignedDownloadUrl, headRegionalObject, deleteRegionalObject)
- Settings router: switched to createRegionalPresignedUploadUrl
- GDPR router: switched to deleteRegionalObject
- Refactored `scanAndUpdate` helper in document.ts to accept `db` parameter (was previously referencing `prisma` outside handler context)
- Portal router (portal.ts) and portal-time.ts were EXCLUDED from ctx.db migration because `portalProcedure` does not set `ctx.db` — kept using `prisma` import. Portal router DID get regional storage migration for presigned URLs.

## Deviations from Plan

- Portal routers (portal.ts, portal-time.ts) kept `prisma` import — portalAuthMiddleware does not resolve regional Prisma client (only tenantMiddleware does). Documented in SUMMARY.
- organization.ts had no prisma import to remove (uses auth API exclusively)

## Self-Check: PASSED

- All 22 planned routers migrated to ctx.db
- 4 routers switched to regional storage
- Type imports preserved where present

## Key Files

key-files:
  modified:
    - packages/api/src/routers/contractor.ts
    - packages/api/src/routers/contract.ts
    - packages/api/src/routers/document.ts
    - packages/api/src/routers/invoice.ts
    - packages/api/src/routers/payment.ts
    - packages/api/src/routers/approval.ts
    - packages/api/src/routers/dashboard.ts
    - packages/api/src/routers/report.ts
    - packages/api/src/routers/settings.ts
    - packages/api/src/routers/gdpr.ts
    - packages/api/src/routers/user.ts
    - packages/api/src/routers/notification.ts
    - packages/api/src/routers/audit.ts
    - packages/api/src/routers/search.ts
    - packages/api/src/routers/import.ts
    - packages/api/src/routers/reminder.ts
    - packages/api/src/routers/workflow.ts
    - packages/api/src/routers/workflow-execution.ts
    - packages/api/src/routers/workflow-templates.ts
    - packages/api/src/routers/workflow-shared.ts
    - packages/api/src/routers/portal.ts
    - packages/api/src/routers/organization.ts
