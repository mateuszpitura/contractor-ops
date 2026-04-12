---
phase: 49
plan: 3
status: complete
started: 2026-04-11T13:10:00Z
completed: 2026-04-11T13:25:00Z
---

# Plan 49-03 Summary: Storecove ASP Adapter, Outbound Orchestrator & Inbound Processing

## What Was Built

Complete Peppol network integration via Storecove ASP with async QStash-based processing pipeline.

### Key Artifacts

1. **StorecoveClient** (`packages/einvoice/src/asp/storecove/client.ts`) — Typed HTTP client for Storecove REST API v2 with Zod response validation, timeout handling, and typed errors.

2. **StorecoveAdapter** (`packages/einvoice/src/asp/storecove/adapter.ts`) — Implements ASPAdapter interface. HMAC-SHA256 webhook signature verification, status mapping (sent->transmitted, delivered->delivered, error->failed), inbound polling, and health checks.

3. **Storecove Schemas & Types** (`packages/einvoice/src/asp/storecove/schemas.ts`, `types.ts`) — Zod schemas for all Storecove API responses with `.passthrough()` for forward compatibility.

4. **PeppolOrchestrator** (`packages/api/src/services/peppol-orchestrator.ts`) — Service class orchestrating:
   - Outbound: load invoice -> generate PINT-AE XML via PeppolAEProfile -> transmit via ASP -> track status
   - Inbound: parse XML -> deduplicate by aspTransmissionId -> create Invoice with source PEPPOL
   - Status updates: query ASP for transmission status changes
   - Polling: fetch missed inbound invoices from ASP since last sync

5. **QStash API Routes:**
   - `apps/web/src/app/api/peppol/outbound/route.ts` — Outbound transmission processing
   - `apps/web/src/app/api/peppol/inbound/route.ts` — Inbound webhook payload processing
   - `apps/web/src/app/api/peppol/poll/route.ts` — Scheduled polling for missed webhooks

6. **Barrel Exports** — Added StorecoveAdapter, StorecoveClient, StorecoveApiError, StorecoveConfig to einvoice index.

### Test Results

- 8 Storecove adapter tests passing (transmit, reject, status mapping, HMAC verify, webhook parse, poll)
- TypeScript compilation: zero peppol-related errors in packages/api and apps/web

## Decisions Made

- Used module-level `prisma` import (same pattern as KSeF orchestrator) instead of constructor injection
- Business errors return 200 to QStash (only infra errors trigger retry)
- Inbound deduplication by aspTransmissionId before creating Invoice
- Poll route supports both per-org (QStash CRON) and all-active-participants modes
- Added `@contractor-ops/einvoice` as direct web app dependency for route imports

## Self-Check: PASSED

- [x] StorecoveAdapter implements ASPAdapter interface
- [x] Outbound flow: invoice -> QStash job -> generate PINT-AE XML -> transmit via ASP -> track delivery
- [x] Inbound flow: webhook -> parse PINT-AE XML -> create Invoice with source PEPPOL
- [x] Polling catch-up: scheduled job fetches missed inbound invoices from ASP
- [x] Webhook signature verification (HMAC-SHA256) rejects unsigned/tampered payloads
- [x] All QStash routes verify signatures via @upstash/qstash

## Key Files

### Created
- `packages/einvoice/src/asp/storecove/types.ts`
- `packages/einvoice/src/asp/storecove/schemas.ts`
- `packages/einvoice/src/asp/storecove/client.ts`
- `packages/einvoice/src/asp/storecove/adapter.ts`
- `packages/einvoice/src/__tests__/storecove-adapter.test.ts`
- `packages/api/src/services/peppol-orchestrator.ts`
- `apps/web/src/app/api/peppol/outbound/route.ts`
- `apps/web/src/app/api/peppol/inbound/route.ts`
- `apps/web/src/app/api/peppol/poll/route.ts`

### Modified
- `packages/einvoice/src/index.ts` — Added Storecove exports
- `packages/api/package.json` — Added peppol-orchestrator subpath export
- `apps/web/package.json` — Added @contractor-ops/einvoice dependency
