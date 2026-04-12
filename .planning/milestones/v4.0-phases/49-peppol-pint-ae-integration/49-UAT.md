---
status: complete
phase: 49-peppol-pint-ae-integration
source: 49-01-SUMMARY.md, 49-02-SUMMARY.md, 49-03-SUMMARY.md, 49-04-SUMMARY.md
started: 2026-04-11T14:50:00Z
updated: 2026-04-11T14:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. PINT-AE Profile Registration
expected: PeppolAEProfile registers in the engine with profileId "peppol-ae", country "AE", QR code capability enabled, and no client-side signing (ASP handles AS4).
result: pass

### 2. PINT-AE XML Generation
expected: Generating XML from a canonical EInvoice produces valid PINT-AE UBL 2.1 with correct CustomizationID, ProfileID, supplier TRN with schemeID 0192, BuyerReference, and tax breakdown.
result: pass

### 3. PINT-AE XML Parse Roundtrip
expected: Parsing generated PINT-AE XML back to canonical EInvoice preserves all key fields (invoice number, dates, amounts, lines, tax breakdown, buyer reference, transmission ID).
result: pass

### 4. PINT-AE Business Rule Validation
expected: Validator catches missing mandatory fields (BuyerReference, supplier TRN, CustomizationID mismatch), returns structured errors, and warns for optional missing fields (customer TRN).
result: pass

### 5. UAE QR Code Generation
expected: QR code generator produces a non-empty PNG buffer with seller name, TRN, date, total, and VAT amount in pipe-delimited format per UAE FTA requirements.
result: pass

### 6. Peppol Participant ID Schema Validation
expected: Zod schemas validate correct 0192:NNNNNNNNNNNNNNN participant ID format and reject invalid formats.
result: pass

### 7. ASP Adapter Interface
expected: Vendor-agnostic ASPAdapter interface defines contracts for participant registration, invoice transmission, webhook handling, polling, and health checks — enabling provider swaps without code changes.
result: pass

### 8. Storecove Adapter — Participant Registration
expected: StorecoveAdapter.registerParticipant creates a legal entity via Storecove API and returns registration result.
result: pass

### 9. Storecove Adapter — Invoice Transmission
expected: StorecoveAdapter.transmitInvoice returns accepted result on 200 and rejected result with errors on 422.
result: pass

### 10. Storecove Adapter — Webhook Signature Verification
expected: HMAC-SHA256 signature verification rejects invalid signatures and accepts valid ones, preventing tampered webhook payloads.
result: pass

### 11. Storecove Adapter — Inbound Polling
expected: StorecoveAdapter.pollInboundInvoices returns properly mapped InboundInvoicePayload objects with XML, sender participant ID, and timestamps.
result: pass

### 12. Prisma Schema — Peppol Models
expected: PeppolParticipant and PeppolTransmission models exist with proper indexing, unique constraints, and Organization relations. Prisma validate passes.
result: pass

### 13. Enum Extensions
expected: IntegrationProvider includes PEPPOL. InvoiceSource includes PEPPOL. Prisma schema validates successfully.
result: pass

### 14. tRPC Peppol Router — Connect
expected: connect endpoint validates TRN, encrypts ASP credentials via storeCredentials, creates IntegrationConnection + PeppolParticipant, and schedules QStash polling CRON. Rejects duplicate connections with CONFLICT error.
result: pass

### 15. tRPC Peppol Router — Disconnect
expected: disconnect endpoint deregisters participant, cleans up QStash schedule, and marks IntegrationConnection as DISCONNECTED. Returns NOT_FOUND if no active participant.
result: pass

### 16. tRPC Peppol Router — Status & Participant Queries
expected: getStatus returns participant + connection details (or null). getParticipant returns participant with sent/received/failed transmission counts. getTransmissions supports cursor-based pagination with direction filter.
result: pass

### 17. tRPC Peppol Router — Retry Transmission
expected: retryTransmission resets a FAILED/REJECTED transmission to PENDING for reprocessing. Returns NOT_FOUND for non-retryable transmissions.
result: pass

### 18. Peppol Orchestrator — Outbound Flow
expected: PeppolOrchestrator loads invoice, generates PINT-AE XML via profile, transmits via ASP adapter, and tracks delivery status. All processing async via QStash.
result: pass

### 19. Peppol Orchestrator — Inbound Flow
expected: Webhook payload is parsed from PINT-AE XML, deduplicated by aspTransmissionId, and creates Invoice with source PEPPOL. Duplicate submissions are silently ignored.
result: pass

### 20. QStash API Routes
expected: Three API routes exist and verify QStash signatures: outbound (transmission processing), inbound (webhook handling), and poll (scheduled catch-up for missed webhooks).
result: pass

### 21. Peppol Connection Wizard UI
expected: 5-step dialog wizard: TRN entry with 15-digit numeric validation and live participant ID preview, ASP selection (Storecove), API key with show/hide toggle and environment radio, registration with progress indicator and error retry, confirmation with connection details.
result: blocked
blocked_by: server
reason: "Running in background — cannot start dev server to visually verify wizard UI. Code structure and component logic verified through static analysis."

### 22. Peppol Status Card UI
expected: Connected state shows participant ID, ASP provider, last sync, and transmission metrics (sent/received/failed). Empty state shows "Connect to Peppol" CTA. Disconnect triggers AlertDialog confirmation before deregistering.
result: blocked
blocked_by: server
reason: "Running in background — cannot start dev server to visually verify status card UI. Component code and tRPC hook wiring verified through static analysis."

### 23. Transmission Status Timeline UI
expected: Collapsible card with status badge, vertical timeline (created -> transmitted -> delivered), error message display for failures, and "Retry Transmission" button for failed/rejected items.
result: blocked
blocked_by: server
reason: "Running in background — cannot start dev server to visually verify timeline UI. Component code verified through static analysis."

### 24. Inbound Banner & QR Display UI
expected: Inbound Peppol invoices display Globe-icon banner with "Received via Peppol Network", sender participant ID, document type, and received date. QR display renders UAE FTA QR code image with caption when data is present.
result: blocked
blocked_by: server
reason: "Running in background — cannot start dev server to visually verify banner and QR display. Component code verified through static analysis."

### 25. Integration Wiring — Settings Page
expected: PeppolStatusCard is rendered in the IntegrationsTab grid on the settings page, alongside existing integration cards (KSeF, etc.).
result: pass

### 26. Zero Test Regressions
expected: All existing tests (78 total including 30 new Peppol tests) pass with zero failures. No regressions to KSeF, ZATCA, engine, or pipeline tests.
result: pass

## Summary

total: 26
passed: 22
issues: 0
pending: 0
skipped: 0
blocked: 4

## Gaps

[none]
