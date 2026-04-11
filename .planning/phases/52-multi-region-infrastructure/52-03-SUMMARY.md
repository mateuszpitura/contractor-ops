---
phase: 52-multi-region-infrastructure
plan: 03
subsystem: infra
tags: [gov-api, rate-limiting, audit-logging, retry, certificate-auth, upstash]

requires:
  - phase: 52-multi-region-infrastructure
    provides: GovApiAuditLog relation on Organization model

provides:
  - GovApiClient abstract base class with fetch-retry, cert auth, audit hooks
  - GovApiRateLimiter with Upstash Redis sliding window
  - GovApiAuditLogger with fire-and-forget persistence
  - GovApiAuditLog Prisma model

affects: [phase-48-zatca, phase-49-peppol, future-market-integrations]

tech-stack:
  added: ["@upstash/ratelimit"]
  patterns: [gov-api-base-class, fail-open-rate-limiting, fire-and-forget-audit]

key-files:
  created:
    - packages/gov-api/package.json
    - packages/gov-api/src/client.ts
    - packages/gov-api/src/types.ts
    - packages/gov-api/src/rate-limiter.ts
    - packages/gov-api/src/audit-logger.ts
    - packages/gov-api/src/index.ts
    - packages/db/prisma/schema/gov-api.prisma
  modified:
    - packages/db/prisma/schema/organization.prisma
    - vitest.config.ts
    - vitest.monorepo.ts

key-decisions:
  - "New packages/gov-api package rather than extending packages/einvoice"
  - "Fail-open rate limiting: Redis failure allows requests through"
  - "Fire-and-forget audit logging: write failures logged but never thrown"
  - "emitAuditEntry is a no-op by default; subclasses wire to GovApiAuditLogger"

patterns-established:
  - "Gov API base class: extend GovApiClient, implement getApiName(), use this.fetch()"
  - "Rate limiting: per-API sliding window with org-level granularity"
  - "Audit logging: GovApiAuditLog table with requestBodyHash (never raw body)"

metrics:
  files_created: 11
  files_modified: 3
  tests_added: 28
  tests_passing: 28
---

# Plan 52-03: Government API Integration Framework

## What was built

Created `packages/gov-api` — a reusable framework for government API integrations. The `GovApiClient` abstract base class provides HTTP fetch with exponential backoff retry, certificate auth loading from SecretStore, sandbox/production URL switching, and audit logging hooks. `GovApiRateLimiter` provides per-API sliding window rate limiting backed by Upstash Redis with fail-open fallback. `GovApiAuditLogger` persists request/response records to a new `GovApiAuditLog` Prisma model with fire-and-forget error handling.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 78cea4c | Add government API integration framework (base client, rate limiter, audit logger, Prisma model) |

## Deviations

- Combined both tasks into a single commit since they are tightly coupled and the package needed to be created atomically.

## Self-Check: PASSED

- [x] GovApiClient base class with fetch-retry, cert auth, sandbox/prod switching (17 tests)
- [x] GovApiRateLimiter with sliding window and fail-open (5 tests)
- [x] GovApiAuditLogger with fire-and-forget persistence (3 tests)
- [x] GovApiAuditLog Prisma model with indexes
- [x] Package registered in vitest workspace
