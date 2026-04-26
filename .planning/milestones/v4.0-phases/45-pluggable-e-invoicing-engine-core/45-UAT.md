---
status: complete
phase: 45-pluggable-e-invoicing-engine-core
source: [45-01-SUMMARY.md, 45-02-SUMMARY.md, 45-03-SUMMARY.md, 45-04-SUMMARY.md, 45-05-SUMMARY.md]
started: 2026-04-11T14:50:00Z
updated: 2026-04-11T14:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Package Shell & TypeScript Compilation
expected: packages/einvoice exists with package.json, tsconfig, vitest config. tsc --noEmit completes with zero errors.
result: pass

### 2. Core Types Exported
expected: EInvoice, EInvoiceProfile, Signable, QRCodeable, ComplianceStatus, ValidationResult types all exported from package index.
result: pass

### 3. Profile Registry (register/get/list/clear)
expected: registerProfile adds a profile, getProfile retrieves by ID, listProfiles returns all, clearProfiles resets. Duplicate registration throws. Unknown profile throws. 5 tests pass.
result: pass

### 4. EInvoiceEngine Delegation
expected: Engine delegates generate/parse/validate/getComplianceStatus to the correct registered profile. Multi-profile and error cases handled. 6 tests pass.
result: pass

### 5. XML Utilities (dig, toMinorUnits)
expected: dig navigates XML objects, toMinorUnits converts float/string/null/undefined correctly with custom exponent support. 7 tests pass.
result: pass

### 6. KSeF Profile Implementation
expected: KsefProfile class implements EInvoiceProfile with generate/parse/validate/getComplianceStatus. FA(3) parser, generator, API client, schemas, and mapper all exist under profiles/ksef/. sign and qrCode are undefined (KSeF signs server-side).
result: pass

### 7. KSeF Canonical Type Converter
expected: ksefToEInvoice maps FA(3) parsed invoice to EInvoice canonical type with profileId "ksef". Pipeline integration test passes with real KsefProfile.
result: pass

### 8. Capability Pipeline (generate -> validate -> sign -> QR)
expected: runPipeline orchestrates generate, validate, sign (if Signable), QR (if QRCodeable). Validation failure stops pipeline. Missing certificate produces warning not error. KSeF correctly skips sign/QR. 8 tests pass.
result: pass

### 9. API Layer Import Rewiring
expected: ksef-sync-orchestrator.ts and ksef.ts router import from @contractor-ops/einvoice (not integrations/validators). Zero TypeScript errors in einvoice/ksef-related API files.
result: pass

### 10. Backward-Compatible Re-exports
expected: packages/integrations re-exports KsefApiClient, parseFa3Xml, mapKsefToInvoiceFields from @contractor-ops/einvoice. packages/validators re-exports ksef schemas from @contractor-ops/einvoice. Existing consumers unaffected.
result: pass

### 11. Compliance Computation (computeKsefComplianceStatus)
expected: Pure function returns correct state (not_connected, active, degraded, error, suspended, sandbox) based on connection data. Health score computed from recent sync statuses. Capabilities reflect KSeF (canSign=false, canQRCode=false). 9 tests pass.
result: pass

### 12. tRPC einvoice.complianceStatuses Endpoint
expected: einvoiceRouter registered in API root. complianceStatuses query uses tenantProcedure with requirePermission, fetches connection + sync logs per profile, returns per-profile ComplianceStatus array with tenant isolation.
result: pass

### 13. Dashboard Compliance Widget
expected: EInvoiceComplianceWidget imported and rendered on dashboard page. Color-coded status dots (green=active, yellow=degraded/sandbox, red=error, gray=not_connected). Links to settings#einvoice. Loading skeleton shown during fetch.
result: pass

### 14. Settings Compliance Detail View
expected: EInvoiceComplianceDetail imported and rendered on settings page. Shows health bar, last sync time, error messages, capability matrix (Generate, Parse, Sign, QR Code) per profile. Badge variant per state.
result: pass

### 15. Vitest Workspace Registration
expected: packages/einvoice listed in root vitest.config.ts projects array so that root-level vitest run includes einvoice tests in monorepo coverage.
result: issue -> fixed
reported: "packages/einvoice is missing from the root vitest.config.ts projects array. Running vitest from the root skips all 78 einvoice tests. Tests only run when executed directly from packages/einvoice directory."
severity: major
fix: "Added einvoice to vitest.monorepo.ts, vitest.config.ts projects array, and updated packages/einvoice/vitest.config.ts to use shared monorepo config. Verified: npx vitest run --project einvoice passes 78/78 tests from root."

### 16. Zod Schemas for Runtime Validation
expected: eInvoiceSchema and related schemas (party, line, tax subtotal, payment means) exported and usable for runtime validation of invoice data.
result: pass

## Summary

total: 16
passed: 15
issues: 1 (fixed inline)
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "packages/einvoice listed in root vitest.config.ts projects array so that root-level vitest run includes einvoice tests in monorepo coverage"
  status: failed
  reason: "User reported: packages/einvoice is missing from the root vitest.config.ts projects array. Running vitest from the root skips all 78 einvoice tests. Tests only run when executed directly from packages/einvoice directory."
  severity: major
  test: 15
  root_cause: "packages/einvoice was not added to the vitest.config.ts test.projects array when the package was created in plan 45-01"
  artifacts:
    - path: "vitest.config.ts"
      issue: "Missing packages/einvoice in test.projects array"
  missing:
    - "Add 'packages/einvoice' to the projects array in vitest.config.ts"
  debug_session: ""
