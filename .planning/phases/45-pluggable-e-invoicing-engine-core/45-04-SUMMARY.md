---
phase: 45-pluggable-e-invoicing-engine-core
plan: 04
subsystem: api
tags: [trpc, imports, backward-compat, migration]

requires:
  - phase: 45-01
    provides: einvoice package
  - phase: 45-02
    provides: KSeF exports from einvoice
provides:
  - API layer imports from @contractor-ops/einvoice
  - Backward-compatible re-exports in integrations and validators
affects: [phase-46-multi-currency]

tech-stack:
  added: []
  patterns: [re-export-for-backward-compat]

key-files:
  created: []
  modified:
    - packages/api/src/services/ksef-sync-orchestrator.ts
    - packages/api/src/routers/ksef.ts
    - packages/api/package.json
    - packages/integrations/src/index.ts
    - packages/integrations/package.json
    - packages/validators/src/ksef.ts
    - packages/validators/package.json

key-decisions:
  - "decryptCredentials stays in integrations (generic credential utility)"
  - "KSeF domain code (parser, API client, schemas) imports from einvoice"
  - "Backward-compat re-exports prevent breaking other consumers"

patterns-established:
  - "Re-export pattern for package migration: old package re-exports from new"
---

# Plan 45-04 Summary: API Layer Rewiring

## What was built
Updated all KSeF imports in the API layer to use @contractor-ops/einvoice. Sync orchestrator and tRPC router now import KsefApiClient, parseFa3Xml, mapKsefToInvoiceFields, and ksefConnectionConfigSchema from the new package. decryptCredentials stays in integrations. Backward-compatible re-exports added to both integrations and validators packages.

## Tests
- All packages compile with zero errors
- No assertion changes in any test file

## Self-Check: PASSED
- [x] Sync orchestrator imports from @contractor-ops/einvoice
- [x] Router imports from @contractor-ops/einvoice
- [x] Backward-compat re-exports work
- [x] No circular dependencies
