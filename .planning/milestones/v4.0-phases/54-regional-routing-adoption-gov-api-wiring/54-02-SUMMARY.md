---
phase: 54-regional-routing-adoption-gov-api-wiring
plan: 02
status: complete
started: 2026-04-12
completed: 2026-04-12
requirements_completed: [INFRA-01, INFRA-02]
---

# Plan 54-02: Integration Router Migration — SUMMARY

## What Was Built

Migrated the remaining 21 integration/feature routers from direct `prisma` import to `ctx.db`, completing the full codebase migration to regional database routing.

## Key Changes

- Removed `import { prisma } from "@contractor-ops/db"` from 21 routers: zatca, peppol, einvoice, ksef, tax, consent, exchange-rate, billing, equipment, equipment-couriers, equipment-returns, equipment-shipments, equipment-shared, time, jira, linear, teams, esign, ocr, integration, onboarding-import, google-workspace, calendar, docs
- Replaced all `prisma.` calls with `ctx.db.` in handler bodies

## Deviations from Plan

- Executed as part of the same batch migration as plan 01 (all 43 routers processed together for efficiency)
- portal-time.ts was originally listed in plan 02's implicit scope but kept using `prisma` (same reason as portal.ts — portalProcedure)

## Self-Check: PASSED

- All 21 integration routers migrated to ctx.db
- Zero `import { prisma }` statements remain (except portal routers)
- Total of 502 ctx.db usages across all routers

## Key Files

key-files:
  modified:
    - packages/api/src/routers/zatca.ts
    - packages/api/src/routers/peppol.ts
    - packages/api/src/routers/einvoice.ts
    - packages/api/src/routers/ksef.ts
    - packages/api/src/routers/tax.ts
    - packages/api/src/routers/consent.ts
    - packages/api/src/routers/exchange-rate.ts
    - packages/api/src/routers/billing.ts
    - packages/api/src/routers/equipment.ts
    - packages/api/src/routers/equipment-couriers.ts
    - packages/api/src/routers/equipment-returns.ts
    - packages/api/src/routers/equipment-shipments.ts
    - packages/api/src/routers/equipment-shared.ts
    - packages/api/src/routers/time.ts
    - packages/api/src/routers/jira.ts
    - packages/api/src/routers/linear.ts
    - packages/api/src/routers/teams.ts
    - packages/api/src/routers/esign.ts
    - packages/api/src/routers/ocr.ts
    - packages/api/src/routers/integration.ts
    - packages/api/src/routers/onboarding-import.ts
    - packages/api/src/routers/google-workspace.ts
    - packages/api/src/routers/calendar.ts
    - packages/api/src/routers/docs.ts
