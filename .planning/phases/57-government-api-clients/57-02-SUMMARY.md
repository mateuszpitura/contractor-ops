---
phase: 57
plan: 02
subsystem: gov-api
tags: [gov-api, hmrc, vies, oauth, rate-limiting, zod]
requires:
  - 57-01 (Wave 0 schemas, MSW handlers, RED scaffolds)
  - packages/gov-api/src/client.ts (GovApiClient base)
  - packages/gov-api/src/rate-limiter.ts (GovApiRateLimiter)
provides:
  - HmrcVatClient (OAuth 2.0 client-credentials + VAT lookup)
  - ViesClient (simple + qualified confirmation, Zod boundary, soft-fail)
  - Barrel exports from @contractor-ops/gov-api
affects:
  - Downstream Plan 57-03 orchestrator imports both clients
tech-stack:
  added:
    - "@contractor-ops/test-utils as devDependency of @contractor-ops/gov-api"
  patterns:
    - "GovApiClient subclass: per-profile rate-limit bucket + Zod boundary + audit hook"
    - "OAuth 2.0 client-credentials with token cache (TTL - 5min buffer) + 401-refresh-once-then-retry"
    - "Pre-flight format check short-circuits before network (quota preservation)"
    - "Soft-fail on 5xx / userError → { status: 'unavailable' } for orchestrator stale-fallback"
key-files:
  created:
    - packages/gov-api/src/clients/hmrc-vat-client.ts
    - packages/gov-api/src/clients/vies-client.ts
    - packages/gov-api/src/clients/index.ts
  modified:
    - packages/gov-api/src/index.ts (barrel re-exports for clients + schemas)
    - packages/gov-api/src/clients/__tests__/hmrc-vat-client.test.ts (RED → GREEN, 11 tests)
    - packages/gov-api/src/clients/__tests__/vies-client.test.ts (RED → GREEN, 13 tests)
    - packages/gov-api/package.json (+ @contractor-ops/test-utils dev dep)
decisions:
  - "Inline pre-flight format validators (isValidGbVatInline, isValidUstIdNrInline) rather than import from @contractor-ops/validators — avoids workspace cycle (gov-api ← einvoice ← validators ← einvoice). Orchestrator (Plan 57-03) uses the canonical validators; inline duplicates are defense-in-depth."
  - "Rename private field HmrcVatClient.secretStore → hmrcSecretStore to avoid collision with GovApiClient's own private secretStore field (TS2415)."
  - "HMRC rate-limit window is per-organizationId bucket (not global). VIES stays unauthenticated + 10 req/s polite throttle."
metrics:
  duration: "~20 min"
  completed: 2026-04-13
---

# Phase 57 Plan 02: Government VAT Clients Summary

HmrcVatClient + ViesClient land as two narrowly-scoped GovApiClient subclasses, turning Wave 0 RED scaffolds GREEN. Both clients encapsulate OAuth (HMRC only), fraud-prevention headers (HMRC only), Zod response parsing, per-org rate limiting, pre-flight format short-circuits, and 401-refresh-once-then-retry (HMRC). The orchestrator in Plan 57-03 will consume them as black-box contractors via `@contractor-ops/gov-api` barrel exports.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | HmrcVatClient (OAuth + fraud-prevention + Zod + 11 tests GREEN) | e6803c6 | hmrc-vat-client.ts, hmrc-vat-client.test.ts, clients/index.ts, src/index.ts, package.json |
| 2 | ViesClient (simple + qualified + safeParse + soft-fail + 13 tests GREEN) | 427c68c | vies-client.ts, vies-client.test.ts, clients/index.ts, hmrc-vat-client.ts (field rename) |

## Test Results

- `pnpm --filter @contractor-ops/gov-api test --run hmrc-vat-client` → 11/11 passing
- `pnpm --filter @contractor-ops/gov-api test --run vies-client` → 13/13 passing
- Full suite `pnpm --filter @contractor-ops/gov-api test` → 63/63 passing (base client.ts, audit-logger, rate-limiter, schema tests, HMRC, VIES all green)
- `pnpm --filter @contractor-ops/gov-api build` → tsc clean (no type errors)
- `grep -rn "RED — Phase 57" packages/gov-api/src/clients/__tests__/` → empty

Target for this plan was ≥16 tests between the two client suites; delivered **24** (11 + 13).

## Requirement Coverage

| Requirement | Addressed | Via |
|-------------|-----------|-----|
| PAY-03 | ✓ | HmrcVatClient.checkVatNumber — OAuth + Bearer + lookup + 401-refresh + 404 + pre-flight + Gov-Client-* headers |
| PAY-05 | ✓ | ViesClient.checkVatNumber — simple + qualified + userError + schema-reject + pre-flight + 500→unavailable |
| PAY-02 | n/a | Tax-rate seed + service — Plan 57-01 scope (complete) |
| PAY-04 | n/a | Tax-rate preselect + reverse-charge — Plan 57-03 / 57-04 scope |

## Observed Behavior vs Assumptions

| Assumption | Observed | Notes |
|-----------|----------|-------|
| OAuth token TTL 4h (14400s) | Fixtures return `expires_in: 14400` | Matches D-01/RESEARCH; client caches for TTL − 5min |
| VIES has no formal sandbox | MSW stubs sole test path | Client resolves both sandbox + production to same base URL |
| No Wave 0 Zod schema edits needed | Confirmed | `hmrcVatLookupResponseSchema.parse` and `viesLookupResponseSchema.safeParse` accept all fixture bodies without amendment |
| Base `GovApiClient.fetch` handles 429 retry transparently | Confirmed | Our per-org rate limiter denies PRE-fetch; upstream 429 handled by base with exp backoff + `X-Retry-After` fallback |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Workspace dependency cycle prevented importing validators**

- **Found during:** Task 1 (initial attempt to add `@contractor-ops/validators` as gov-api dep)
- **Issue:** Adding `@contractor-ops/validators` as a dependency of `@contractor-ops/gov-api` creates the cycle `gov-api → validators → einvoice → gov-api` (einvoice imports gov-api for its ZATCA adapter; validators re-exports einvoice ZATCA schemas). `pnpm install` postinstall detected and rejected.
- **Fix:** Inline minimal pure-function equivalents of `isValidGbVat` and `isValidUstIdNr` into the client files (`isValidGbVatInline`, `isValidUstIdNrInline`). Comments document the origin, the cycle constraint, and that the orchestrator (Plan 57-03) uses the canonical validators. Inline versions are defense-in-depth.
- **Files modified:** packages/gov-api/src/clients/hmrc-vat-client.ts, packages/gov-api/src/clients/vies-client.ts
- **Commit:** e6803c6, 427c68c

**2. [Rule 1 - Bug] TypeScript private-field clash with base class**

- **Found during:** Task 2 (first full `pnpm build`)
- **Issue:** `GovApiClient` already declares `private secretStore: SecretStore | null`. Declaring `private readonly secretStore: SecretStore` on HmrcVatClient produces `TS2415: Class 'HmrcVatClient' incorrectly extends base class 'GovApiClient' — Types have separate declarations of a private property 'secretStore'`.
- **Fix:** Rename subclass field to `hmrcSecretStore`; public `HmrcVatClientDeps.secretStore` field remains for the constructor contract.
- **Files modified:** packages/gov-api/src/clients/hmrc-vat-client.ts
- **Commit:** 427c68c

### Out-of-Scope Discoveries (NOT fixed, logged)

None from this plan's changes. Pre-existing TypeScript errors in `@contractor-ops/api` (`src/routers/audit.ts`, `equipment-*`, `integration.ts`, etc.) surfaced during `pnpm install` postinstall but are entirely unrelated to the gov-api package. Scope-boundary rule: not fixed here; these fall under separate remediation work.

## Security & Threat-Model Evidence

| Threat | Mitigation | Evidence |
|--------|-----------|----------|
| T-57-02-01 Spoofing HMRC OAuth | Client credentials via SecretStore | `hmrcSecretStore.get('hmrc/client_id'/'hmrc/client_secret')` — no hard-coded secrets |
| T-57-02-02 Response tampering | Zod boundary | `hmrcVatLookupResponseSchema.parse` + `viesLookupResponseSchema.safeParse` |
| T-57-02-03 Repudiation | Audit hook | `this.fetch(..., { organizationId, skipAudit: false })` emits `GovApiAuditEntry` on every lookup |
| T-57-02-04 EoP via caller-supplied requesterVrn | Compile-time enforcement | `checkVatNumber(targetVrn, opts)` signature — no `requesterVrn` field; path always uses `deps.platformVrn` |
| T-57-02-05 Auth/secret leakage in logs | No logging of sensitive fields | Comments in `refreshAccessToken` prohibit logging response bodies; Authorization/body never touched by our code |
| T-57-02-06 HMRC rate-limit DoS | Per-org rate limiter | `GovApiRateLimiter('hmrc-vat', { maxRequests: 3, windowMs: 1000 })`; orgs cannot exhaust platform quota |
| T-57-02-07 429 retry storm | Base retry cap + exp backoff | `GovApiClient.fetch` caps retries at 3 with 30s delay max |
| T-57-02-08 VIES MITM | HTTPS-only + pinned base URL | `https://ec.europa.eu/taxation_customs/vies` hard-coded; native fetch rejects HTTP downgrade |
| T-57-02-09 Token-refresh oracle | Refresh once then give up | `if (response.status === 401) { refresh; retry; if still 401 → throw }` — no loop |
| T-57-02-10 VIES userError leakage | Accepted | userError is service-status, not PII |

## Authentication Gates

None in this plan — HMRC OAuth credentials are expected to come from `SecretStore` at runtime; tests inject `MemoryStore` with stub values. Live HMRC-sandbox onboarding remains a manual-only task tracked in VALIDATION.md.

## Integration Points for Plan 57-03

- `import { HmrcVatClient, ViesClient, HmrcApiError, ViesApiError, type HmrcVatLookupResult, type ViesLookupResult } from '@contractor-ops/gov-api'`
- Both clients accept `{ organizationId }` option on every call → orchestrator feeds tenant context for rate-limit scope + audit log.
- `HmrcVatLookupResult.status` union `'valid' | 'invalid'` (throws only on network/upstream errors).
- `ViesLookupResult.status` union `'valid' | 'invalid' | 'unavailable'` — the `unavailable` branch is the D-08 trigger for stale fallback.

## Self-Check: PASSED

- FOUND: packages/gov-api/src/clients/hmrc-vat-client.ts
- FOUND: packages/gov-api/src/clients/vies-client.ts
- FOUND: packages/gov-api/src/clients/index.ts
- FOUND: packages/gov-api/src/clients/__tests__/hmrc-vat-client.test.ts
- FOUND: packages/gov-api/src/clients/__tests__/vies-client.test.ts
- FOUND: commit e6803c6 (HmrcVatClient)
- FOUND: commit 427c68c (ViesClient)
- VERIFIED: 24/24 client tests passing, 63/63 full gov-api suite, tsc build clean
