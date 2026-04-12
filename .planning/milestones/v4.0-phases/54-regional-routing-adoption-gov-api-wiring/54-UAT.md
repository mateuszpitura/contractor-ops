---
status: complete
phase: 54-regional-routing-adoption-gov-api-wiring
source: [54-01-SUMMARY.md, 54-02-SUMMARY.md, 54-03-SUMMARY.md, 54-04-SUMMARY.md]
started: 2026-04-12T11:30:00Z
updated: 2026-04-12T11:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. No Direct Prisma Imports in Non-Portal Routers
expected: All routers except portal.ts and portal-time.ts use ctx.db instead of importing prisma directly. Running grep for `import { prisma }` in routers/ should only match portal files.
result: pass

### 2. Document Router Uses Regional Storage
expected: Document router uses createRegionalPresignedUploadUrl and createRegionalPresignedDownloadUrl from regional-storage.ts instead of legacy r2.ts functions.
result: pass

### 3. ZatcaApiClient Extends GovApiClient
expected: ZatcaApiClient class extends GovApiClient, implements getApiName() returning "zatca", and overrides emitAuditEntry() to delegate to GovApiAuditLogger. API calls route through GovApiClient.fetch() for retry and timeout.
result: pass

### 4. StorecoveAdapter Composes GovApiRateLimiter
expected: StorecoveAdapter accepts optional StorecoveAdapterDeps with rateLimiter and auditLogger. transmitInvoice, registerParticipant, and pollInboundInvoices are wrapped with rate limiting and audit logging.
result: pass

### 5. ZATCA Service Accepts DB Parameter
expected: zatca-submission.ts submitToZatca() accepts an optional PrismaClient parameter, enabling callers to pass the regional client from ctx.db.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
