---
status: complete
phase: 98-theme-c-public-rest-api-surface-foundation-gate
source:
  - 98-01..08-SUMMARY.md (read half)
  - 98-09-HANDOFF.md + public-api routers (write half, shipped post-P99, summaries un-backfilled)
started: 2026-07-05
updated: 2026-07-05
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running public-api instance, start fresh. Server boots clean; GET /v1/openapi.json returns live OpenAPI 3.1 JSON.
result: pass

### 2. API key required
expected: Every /v1/* endpoint requires a valid API key; missing/invalid key → 401 Unauthorized.
result: pass

### 3. Dark gate — module.public-api OFF
expected: With module.public-api disabled, all /v1/* endpoints return 404 NOT_FOUND (double-dark: flag + hidden).
result: pass

### 4. List + cursor pagination
expected: GET /v1/{entity} → 200 {data:[...], meta:{nextCursor:null|string, hasMore:boolean}}; limit coerced 1–100 (default 25).
result: pass

### 5. Filter bracket-query
expected: filter[field]=value parsed into nested filter; unknown filter field → 400 BAD_REQUEST.
result: pass

### 6. Opaque cursor round-trip
expected: Cursor is stateless base64url {v:1,id}; valid cursor round-trips; tampered/invalid → 400 BAD_REQUEST.
result: pass

### 7. getById cross-org isolation
expected: GET /v1/{contractors|invoices|contracts|payments|workflows|compliance_documents}/:id with a cross-org id → 404 NOT_FOUND (tenant isolation).
result: pass

### 8. Classification read-only + answers hidden
expected: GET /v1/classifications is list-only; raw assessment answers/outcome hidden; no write scope exists.
result: pass

### 9. Audit log PII stripped
expected: GET /v1/audit_log entries exclude actorId, actorName, ipAddress, userAgent, metadata.
result: pass

### 10. Granular scope enforcement
expected: payment:read / workflow:read / classification:read / auditLog:read etc. required; insufficient scope → 403 Forbidden.
result: pass

### 11. OpenAPI 3.1 + Scalar docs
expected: GET /v1/openapi.json = OpenAPI 3.1 (9 entities + feature-flags, list/getById paths); GET /v1/docs = 200 Scalar HTML explorer.
result: pass

### 12. RFC 8594 versioning headers dormant
expected: RFC 8594 policy-url header present; Deprecation/Sunset headers absent for v1 (dormant unless a policy is set).
result: pass

### 13. Write half shipped (post-P99 reconciliation)
expected: The write endpoints exist, gated + audited — contractor create/update, invoice void/create, paymentRun create (fills createdByUserId from apiKeyActingUserId)/transition/export, payment update, workflow create/execute, workflowTask transition; writePublicApiAudit records actorType API_KEY + actingUserId; scope tests LIVE (not skipped). The 3 genuinely-deferred creates (payment.create, complianceDocument.create/link) remain it.skip with rationale.
result: pass

## Summary

total: 13
passed: 13
issues: 0
pending: 0
skipped: 0

## Gaps

[none]

## Notes

Reconciliation context: an independent read-only investigation (this session) confirmed the write-half
is CODE-COMPLETE (11 write procedures + 6 Hono routes + writePublicApiAudit; security/DTO/flag tests LIVE
and green). The "8/12 plans" GSD status was a SUMMARY-backfill gap, not unbuilt work. User accepted the
shipped surface via "pass all". Phase reconciled to complete.
