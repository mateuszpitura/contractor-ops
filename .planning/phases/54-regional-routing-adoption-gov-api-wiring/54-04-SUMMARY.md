---
phase: 54-regional-routing-adoption-gov-api-wiring
plan: 04
status: complete
started: 2026-04-12
completed: 2026-04-12
requirements_completed: [INFRA-03]
---

# Plan 54-04: StorecoveAdapter GovApiRateLimiter/AuditLogger + Peppol Service DI — SUMMARY

## What Was Built

Composed GovApiRateLimiter and GovApiAuditLogger into StorecoveAdapter for Peppol ASP API calls, and updated PeppolOrchestrator to accept an injectable Prisma client.

## Key Changes

- StorecoveAdapter constructor accepts optional `StorecoveAdapterDeps` with `rateLimiter` and `auditLogger`
- Added `checkRateLimit()` and `emitAudit()` private helpers
- `transmitInvoice`, `registerParticipant`, `pollInboundInvoices` wrapped with rate limiting
- Audit logging on all API calls (fire-and-forget)
- Added `organizationId` to `TransmitInvoiceParams` and `RegisterParticipantParams` interfaces
- PeppolOrchestrator accepts optional `PrismaClient` in constructor, stores as `this.db`
- All `prisma.` references in peppol-orchestrator.ts replaced with `this.db.`
- Backward compatible: existing code without deps parameter continues to work

## Self-Check: PASSED

- `grep "GovApiRateLimiter" packages/einvoice/src/asp/storecove/adapter.ts` returns multiple matches
- `grep "GovApiAuditLogger" packages/einvoice/src/asp/storecove/adapter.ts` returns multiple matches
- `grep "checkRateLimit" packages/einvoice/src/asp/storecove/adapter.ts` returns multiple matches
- `grep "this.db." packages/api/src/services/peppol-orchestrator.ts` returns matches

## Key Files

key-files:
  modified:
    - packages/einvoice/src/asp/storecove/adapter.ts
    - packages/einvoice/src/asp/types.ts
    - packages/api/src/services/peppol-orchestrator.ts
