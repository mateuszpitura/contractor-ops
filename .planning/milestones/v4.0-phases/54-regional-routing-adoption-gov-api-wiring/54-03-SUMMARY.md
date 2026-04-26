---
phase: 54-regional-routing-adoption-gov-api-wiring
plan: 03
status: complete
started: 2026-04-12
completed: 2026-04-12
requirements_completed: [INFRA-02]
---

# Plan 54-03: ZatcaApiClient extends GovApiClient + ZATCA Service DI — SUMMARY

## What Was Built

Refactored ZatcaApiClient to extend GovApiClient (inheriting retry with exponential backoff, timeout handling, and audit logging) and updated ZATCA services to accept injectable Prisma client parameters.

## Key Changes

- ZatcaApiClient now extends GovApiClient with `getApiName()` returning `"zatca"`
- Implemented `emitAuditEntry()` override delegating to GovApiAuditLogger (fire-and-forget)
- All API calls route through `GovApiClient.fetch()` for retry and timeout
- ZATCA's Basic auth preserved via explicit Authorization header (not GovApiClient's Bearer cert)
- `submitForClearance`/`submitForReporting` accept optional `organizationId` for audit logging
- `zatca-submission.ts`: `submitToZatca()` accepts optional `PrismaClient` parameter, defaults to global
- `zatca-onboarding.ts`: renamed import to `defaultPrisma` for clarity
- Added `@contractor-ops/gov-api` to einvoice package dependencies

## Self-Check: PASSED

- `grep "extends GovApiClient" packages/einvoice/src/profiles/zatca/api-client.ts` matches
- `grep "getApiName" packages/einvoice/src/profiles/zatca/api-client.ts` matches
- `grep "emitAuditEntry" packages/einvoice/src/profiles/zatca/api-client.ts` matches
- Constructor backward-compatible (baseUrl, binarySecurityToken, secret still required)

## Key Files

key-files:
  modified:
    - packages/einvoice/src/profiles/zatca/api-client.ts
    - packages/einvoice/package.json
    - packages/api/src/services/zatca-submission.ts
    - packages/api/src/services/zatca-onboarding.ts
