---
phase: 49
plan: 2
status: complete
started: 2026-04-11T13:00:00Z
completed: 2026-04-11T13:10:00Z
---

# Plan 49-02 Summary: Prisma Models, Enum Extensions & tRPC Router

## What Was Built

Database layer and API endpoints for Peppol participant management and invoice transmission tracking.

### Key Artifacts

1. **Prisma Schema** (`packages/db/prisma/schema/peppol.prisma`) — PeppolParticipant and PeppolTransmission models with proper indexing, unique constraints, and Organization relations.

2. **Enum Extensions** — Added `PEPPOL` to `IntegrationProvider` (integration.prisma) and `InvoiceSource` (invoice.prisma) enums.

3. **Organization Relations** — Added `peppolParticipants` and `peppolTransmissions` relations to Organization model.

4. **Peppol Validators** (`packages/validators/src/peppol.ts`) — Zod schemas for TRN format (15-digit), participant ID (0192:NNNNNNNNNNNNNNN), connect input, transmit invoice, get transmissions (paginated), and retry transmission.

5. **tRPC Peppol Router** (`packages/api/src/routers/peppol.ts`) — Full CRUD router with:
   - `connect` — Validates TRN, encrypts ASP credentials via storeCredentials, creates IntegrationConnection + PeppolParticipant, schedules QStash polling CRON
   - `disconnect` — Deregisters participant, cleans up QStash schedule, marks connection DISCONNECTED
   - `getStatus` — Returns participant + connection or null
   - `getParticipant` — Returns participant with sent/received/failed transmission counts
   - `getTransmissions` — Cursor-based paginated transmission list with direction filter
   - `retryTransmission` — Resets failed/rejected transmission to PENDING

6. **Router Registration** (`packages/api/src/root.ts`) — Merged `peppolRouter` into appRouter.

### Test Results

- `npx prisma validate` — passes
- `npx prisma db push` — schema applied to Neon database
- TypeScript compilation — zero peppol-related errors

## Decisions Made

- Followed KSeF router pattern exactly (tenantProcedure, requirePermission, storeCredentials, QStash scheduling)
- Used `plain()` helper for serialization (consistent with KSeF pattern)
- Participant ID computed as `0192:${trn}` matching UAE Peppol scheme
- QStash polling scheduled at `*/15 * * * *` (every 15 minutes)
- Credentials stored via existing secret store (not inline encryption)

## Self-Check: PASSED

- [x] PeppolParticipant model exists with organizationId, participantId, schemeId, identifierValue, aspProvider, status
- [x] PeppolTransmission model exists with organizationId, invoiceId, direction, aspTransmissionId, status, xmlPayload
- [x] IntegrationProvider enum includes PEPPOL
- [x] InvoiceSource enum includes PEPPOL
- [x] tRPC peppol router exposes connect, disconnect, getStatus, getParticipant, getTransmissions endpoints
- [x] All endpoints use tenantProcedure (tenant-isolated via ctx.organizationId)
- [x] Credentials encrypted before storage via storeCredentials

## Key Files

### Created
- `packages/db/prisma/schema/peppol.prisma`
- `packages/validators/src/peppol.ts`
- `packages/api/src/routers/peppol.ts`

### Modified
- `packages/db/prisma/schema/integration.prisma` — PEPPOL added to IntegrationProvider
- `packages/db/prisma/schema/invoice.prisma` — PEPPOL added to InvoiceSource
- `packages/db/prisma/schema/organization.prisma` — Peppol relations added
- `packages/validators/src/index.ts` — Peppol exports added
- `packages/api/src/root.ts` — peppolRouter merged into appRouter
