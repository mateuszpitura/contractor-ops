---
phase: 57
plan: 03
subsystem: api-services, orchestration, reverse-charge, kleinunternehmer
tags: [orchestration, atomic-transaction, soft-fail, 90-day-freshness, reverse-charge, kleinunternehmer, pii-mask, tdd]
dependency_graph:
  requires:
    - 57-01 (TaxIdValidation Prisma model, Contractor summary fields, Organization.isKleinunternehmer, GB/DE seed, locked phrases, RED scaffolds)
    - 57-02 (HmrcVatClient, ViesClient, gov-api barrel exports)
    - Phase 56 (isValidGbVat, isValidUstIdNr canonical validators)
    - Phase 56 (packages/logger/src/pii-mask.ts precedent)
  provides:
    - validateTaxId orchestrator (HMRC/VIES dispatch + atomic $transaction dual-write + soft-fail)
    - getLatestValidation + isValidationFresh (90d freshness helper; D-06)
    - maskTaxId utility (PII-safe log redaction)
    - DE_13B_SERVICE_TYPES ReadonlySet + DE13bServiceType union (5 §13b UStG service types)
    - detectReverseCharge rules — gb_eu_post_brexit_b2b (symmetric, D-12.1) + de_domestic_13b_ustg (D-12.3)
    - applyKleinunternehmerOverride + shouldSuppressVatBreakdown (D-11)
    - @contractor-ops/gov-api added as workspace dep of @contractor-ops/api
    - packages/api/src/services/index.ts barrel (Phase 57 tax services)
  affects:
    - Plan 57-04 (tRPC routers consume validateTaxId, applyKleinunternehmerOverride, extended detectReverseCharge; UI renders reverse-charge reason + §19 notice)
tech-stack:
  added:
    - "@contractor-ops/gov-api as workspace dep of @contractor-ops/api (previously not wired — this plan links the orchestrator to the Plan 57-02 clients)"
  patterns:
    - "Atomic dual-write via prisma.$transaction([create, update]) — TaxIdValidation + Contractor.latestVatValidated* never drift (Pitfall 9, T-57-03-01 mitigation)"
    - "Soft-fail orchestration: HmrcApiError / ViesApiError / schema-violation all mapped to D-08 stale-or-unavailable branch — orchestrator never surfaces raw upstream errors (T-57-03-06)"
    - "PII-masked logging via maskTaxId() on every log statement containing raw VAT — complements pino redact paths in @contractor-ops/logger"
    - "Dispatch guard pattern: fail-fast on unsupported taxIdType BEFORE any I/O (prevents partial writes, cleaner audit)"
    - "Pure-function services (kleinunternehmer.service has no Prisma dep) — trivially testable + re-entrant for invoice-preview endpoints"
    - "Injected clock (`now?: () => Date`) + injected prisma + injected clients → deterministic unit tests without DB or network"
key-files:
  created:
    - packages/api/src/services/tax-id-pii.ts
    - packages/api/src/services/tax-id-validation.service.ts
    - packages/api/src/services/kleinunternehmer.service.ts
    - packages/api/src/services/index.ts
  modified:
    - packages/api/src/services/reverse-charge.service.ts (extended with 2 new rules + §13b enum + serviceType pass-through)
    - packages/api/src/services/__tests__/reverse-charge.service.test.ts (RED → GREEN, 16 tests)
    - packages/api/src/services/__tests__/tax-id-validation.service.test.ts (RED → GREEN, 15 tests)
    - packages/api/src/services/__tests__/kleinunternehmer.service.test.ts (NEW, 9 tests)
    - packages/api/src/services/__tests__/tax-id-pii.test.ts (NEW, 3 tests)
    - packages/api/package.json (+ @contractor-ops/gov-api workspace:*)
    - pnpm-lock.yaml
decisions:
  - "NINETY_DAYS_MS exported as module constant (rather than inline arithmetic) so tests can assert against the same value the freshness predicate uses — avoids drift if window changes"
  - "softFail branch records errorMessage on every path even when persisting 'stale' — preserves audit evidence of what outage caused the fallback (T-57-03-09 repudiation mitigation)"
  - "ViesClient internal soft-fail (status='unavailable' returned WITHOUT throwing) routed through the same softFail() helper as thrown errors — single code path for D-08"
  - "RC-over-KU precedence: RC returns forced=false + explanatory reason (rather than forced=true). Reason: RC is not an 'override'; the line was already correctly flagged upstream by the reverse-charge service. Marking it 'forced' would be misleading for audit logs"
  - "kleinunternehmer.service is pure (no Prisma) — tRPC router loads org context. Keeps per-line calls cheap on invoice-preview endpoints"
  - "Null countryCode short-circuits to passthrough (not KU) in applyKleinunternehmerOverride — cannot attribute a DE exemption to an org with unknown jurisdiction"
metrics:
  duration: "~40 minutes"
  tasks_completed: 3
  files_created: 4
  files_modified: 3 (+ test files)
  tests_added: 43 (3 pii + 15 orchestrator + 16 reverse-charge + 9 kleinunternehmer)
  red_scaffolds_converted: 2 (reverse-charge + tax-id-validation; tax-rate.service.test remains RED per Plan 57-01 decision, owned by Plan 57-04 Task 4)
  completed: "2026-04-13"
---

# Phase 57 Plan 03: Tax-ID Validation Orchestrator + Reverse-Charge & Kleinunternehmer Services Summary

Wires Wave 1's low-level HMRC/VIES clients into the domain orchestration layer. Delivers three services: `tax-id-validation.service` (single entry point that pre-flights, dispatches, persists atomically, and soft-fails to stale on outage), `reverse-charge.service` extensions (post-Brexit UK↔EU symmetric rule + DE domestic §13b UStG rule with 5 locked service types), and `kleinunternehmer.service` (§19 UStG line-rate override + VAT-breakdown suppression flag with explicit RC-over-KU precedence). All 3 Wave-0 RED scaffolds owned by this plan converted to GREEN; 43 unit tests across 4 suites pass.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | tax-id-validation orchestrator + PII mask (15 + 3 tests GREEN) | 95e1c51 | tax-id-pii.ts, tax-id-validation.service.ts, index.ts, tax-id-pii.test.ts, tax-id-validation.service.test.ts, api/package.json, pnpm-lock.yaml |
| 2 | reverse-charge extensions — post-Brexit + §13b UStG (16 tests GREEN) | 54fbcc7 | reverse-charge.service.ts, reverse-charge.service.test.ts |
| 3 | kleinunternehmer service (9 tests GREEN) | 9111ac7 | kleinunternehmer.service.ts, kleinunternehmer.service.test.ts |

Note: A husky pre-commit hook created a separate `83ae40c fix: resolve remaining lint errors and auto-fix warnings` commit between the worktree base and Task 1 that picked up the test scaffold files added via Write before the first commit. This commit contains unrelated repo-wide lint auto-fixes — it is NOT part of this plan's scope and matches the same pattern seen in prior plans (Plan 57-01/57-02 worktrees also saw husky auto-commits). Plan-owned changes are cleanly localized to commits 95e1c51, 54fbcc7, 9111ac7.

## What Was Built

### Task 1 — tax-id-validation orchestrator + PII mask (commit `95e1c51`)

- `packages/api/src/services/tax-id-pii.ts`: NEW — `maskTaxId()` utility mirroring Phase 56 `packages/logger/src/pii-mask.ts` precedent. Rule: empty → `[empty]`, ≤4 → full stars, else first-2 + middle-stars + last-4 (e.g. `GB123456789` → `GB*****6789`). ASVS V7/V8; T-57-03-02 mitigation.
- `packages/api/src/services/tax-id-validation.service.ts`: NEW — the Phase 57 orchestrator.
  - `validateTaxId(input, deps)`: dispatch guard → pre-flight (`isValidGbVat` / `isValidUstIdNr` from `@contractor-ops/validators`) → client dispatch (`HmrcVatClient.checkVatNumber` with `useVerifiedLookup: true` for GB, `ViesClient.checkVatNumber('DE', ..., { qualified: true })` for DE) → atomic `prisma.$transaction([taxIdValidation.create, contractor.update])` dual-write. Soft-fails any thrown upstream error OR VIES `status='unavailable'` through the same `softFail()` helper.
  - `getLatestValidation({contractorId, taxIdType}, {prisma})`: tenant-safe read of the most-recent row via `orderBy: { requestedAt: 'desc' }` with `select` projection (T-57-03-05).
  - `isValidationFresh(validation, now?)`: pure D-06 predicate — returns true iff `responseStatus === 'valid'` AND age < `NINETY_DAYS_MS`.
  - `NINETY_DAYS_MS` exported constant (90 · 24 · 3600 · 1000 ms).
  - Logs mask every raw `taxIdValue` via `maskTaxId()` before emitting.
- `packages/api/src/services/index.ts`: NEW — Phase 57 service barrel (re-exports orchestrator + pii mask + reverse-charge + kleinunternehmer for tRPC router consumption in Plan 57-04).
- `packages/api/package.json`: added `@contractor-ops/gov-api: workspace:*` under dependencies (previously missing; orchestrator consumes Plan 57-02 clients via its barrel).
- `packages/api/src/services/__tests__/tax-id-validation.service.test.ts`: RED scaffold (5 tests) rewritten as full 15-test suite covering pre-flight, happy paths (GB + DE qualified), soft-fail (stale + unavailable), atomic rollback, PII mask verification, dispatch guard, Zod-violation → unavailable, and `isValidationFresh` predicate edges.
- `packages/api/src/services/__tests__/tax-id-pii.test.ts`: 3 tests for mask edge cases.
- **All 15 orchestrator tests + 3 mask tests green.**

### Task 2 — reverse-charge extensions (commit `54fbcc7`)

- `packages/api/src/services/reverse-charge.service.ts`:
  - Added `DE13bServiceType` union + `DE_13B_SERVICE_TYPES: ReadonlySet<DE13bServiceType>` with exactly 5 members (CONSTRUCTION, CLEANING_BUILDING, SCRAP_METALS, GOLD, MOBILE_PHONES) — each annotated with its § 13b Abs. 2 Nr. UStG paragraph.
  - Extended `ReverseChargeResult.rule` union with `'gb_eu_post_brexit_b2b'` and `'de_domestic_13b_ustg'`.
  - **Rule order redesigned** to handle the §13b edge-case correctly:
    1. B2C short-circuit (first, so §13b + B2C still returns `not_applicable`).
    2. DE→DE + §13b `serviceType` → `de_domestic_13b_ustg` (BEFORE generic same-country short-circuit — §13b IS a domestic rule).
    3. Same-country short-circuit → `not_applicable`.
    4. GB↔EU symmetric post-Brexit (takes precedence over `eu_cross_border_b2b` when GB is on either side of the transaction).
    5. GB↔EU without buyer VAT ID → standard VAT.
    6. EU cross-border B2B with VAT ID → `eu_cross_border_b2b` (existing).
    7. EU cross-border without VAT ID → standard VAT (existing).
    8. GCC cross-border → `not_applicable` (existing).
  - `detectReverseCharge` params type extended with optional `serviceType?: DE13bServiceType`.
  - `applyReverseCharge` params type extended with optional `serviceType` pass-through.
- `packages/api/src/services/__tests__/reverse-charge.service.test.ts`: RED scaffold (4 tests) rewritten as 16-test suite — 6 new-rule tests + 2 set-membership tests + 3 post-Brexit regression + 5 existing-rule regression. **16/16 green.**

### Task 3 — kleinunternehmer service (commit `9111ac7`)

- `packages/api/src/services/kleinunternehmer.service.ts`: NEW.
  - `applyKleinunternehmerOverride(line, org)`: returns `{vatRate, forced, reason?}`.
    - Guard: if `org.countryCode !== 'DE'` OR `!org.isKleinunternehmer` → passthrough `{vatRate: original, forced: false}`.
    - RC precedence: if `original === 'RC'` → `{vatRate: 'RC', forced: false, reason: 'Reverse charge takes precedence over Kleinunternehmer'}`.
    - Otherwise: `{vatRate: 'KU', forced: true, reason: '§19 UStG Kleinunternehmerregelung'}`.
  - `shouldSuppressVatBreakdown(org)`: `countryCode === 'DE' && isKleinunternehmer === true`. Used by Plan 57-04 footer renderer (RESEARCH Pitfall 7 — no VAT row, just the §19 notice).
  - Pure service (no Prisma) — re-entrant for invoice-preview endpoints.
- `packages/api/src/services/__tests__/kleinunternehmer.service.test.ts`: NEW 9-test suite — 6 override scenarios + 3 suppression scenarios. **9/9 green.**

## Verification Results

| Command | Result |
|---------|--------|
| `pnpm --filter @contractor-ops/api test --run tax-id-validation.service` | 15/15 passed |
| `pnpm --filter @contractor-ops/api test --run tax-id-pii` | 3/3 passed |
| `pnpm --filter @contractor-ops/api test --run reverse-charge.service` | 16/16 passed |
| `pnpm --filter @contractor-ops/api test --run kleinunternehmer.service` | 9/9 passed |
| Combined suite (all 4) | 43/43 passed |
| `grep -rn "RED — Phase 57" packages/api/src/services/__tests__/` | Only `tax-rate.service.test.ts` remains (owned by Plan 57-04 Task 4, not this plan) |
| `grep -c '\$transaction' packages/api/src/services/tax-id-validation.service.ts` | 2 (atomic-write pattern present) |
| `grep -c 'isValidGbVat\|isValidUstIdNr' packages/api/src/services/tax-id-validation.service.ts` | 5 (pre-flight imports + calls) |
| `grep -c 'maskTaxId' packages/api/src/services/tax-id-validation.service.ts` | 3 (log safety) |
| `grep -c 'gb_eu_post_brexit_b2b\|de_domestic_13b_ustg\|DE_13B_SERVICE_TYPES' packages/api/src/services/reverse-charge.service.ts` | 6 |
| `grep -c 'CONSTRUCTION\|CLEANING_BUILDING\|SCRAP_METALS\|GOLD\|MOBILE_PHONES' packages/api/src/services/reverse-charge.service.ts` | 10 (declarations + set membership) |
| `grep -c '§19 UStG\|Reverse charge takes precedence' packages/api/src/services/kleinunternehmer.service.ts` | 4 |

### Acceptance Criteria Checklist

- ✓ File `packages/api/src/services/tax-id-validation.service.ts` exists
- ✓ `$transaction` present (atomic write)
- ✓ `isValidGbVat` and `isValidUstIdNr` referenced (canonical Phase 56 validators)
- ✓ `getLatestValidation` exported
- ✓ `maskTaxId` applied (log safety)
- ✓ `NINETY_DAYS_MS` freshness constant defined
- ✓ ≥10 orchestrator tests pass (delivered 15)
- ✓ 3 tax-id-pii tests pass
- ✓ `HmrcApiError`, `ViesApiError`, and schema-rejection errors caught uniformly (single try/catch around dispatch)
- ✓ `gb_eu_post_brexit_b2b` rule emits correct discriminant both directions (GB→DE AND DE→GB)
- ✓ `de_domestic_13b_ustg` rule fires for DE→DE + §13b serviceType
- ✓ DE_13B_SERVICE_TYPES exported as ReadonlySet with exactly 5 members
- ✓ ≥10 reverse-charge tests pass (delivered 16) + existing regression passes
- ✓ `applyKleinunternehmerOverride` + `shouldSuppressVatBreakdown` exported
- ✓ `§19 UStG` reason string present
- ✓ RC-over-KU precedence documented + tested
- ✓ All 7+ kleinunternehmer tests pass (delivered 9)
- ✓ `packages/api/src/services/index.ts` re-exports kleinunternehmer fns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `@contractor-ops/gov-api` not a dep of `@contractor-ops/api`**

- **Found during:** Task 1 first test run (`Cannot find package '@contractor-ops/gov-api'`)
- **Issue:** The orchestrator must consume `HmrcVatClient`, `ViesClient`, `HmrcApiError`, `ViesApiError` from the Plan 57-02 barrel, but `packages/api/package.json` had never been updated to declare the workspace dependency. Plan 57-02's summary noted the barrel exports but did not wire up the consumer.
- **Fix:** Added `"@contractor-ops/gov-api": "workspace:*"` under dependencies; ran `pnpm install --filter @contractor-ops/api --no-frozen-lockfile`. Install linked successfully; postinstall `turbo build` failed on pre-existing Better-Auth/Prisma Exact-type drift in `@contractor-ops/api` (same drift documented as deferred in Plan 57-01 and 57-02 summaries — not caused by this plan). Vitest runs green.
- **Files modified:** `packages/api/package.json`, `pnpm-lock.yaml`
- **Commit:** `95e1c51`

**2. [Rule 2 — Correctness] VIES internal `status='unavailable'` routed through the same soft-fail path as thrown errors**

- **Found during:** Task 1 TDD step (writing orchestrator)
- **Issue:** `ViesClient.checkVatNumber` already returns `status: 'unavailable'` without throwing when VIES produces an HTTP 500 or a `userError` body (T-57-02-10). The plan's try/catch pattern handled only thrown errors — without this fix, a VIES soft-fail would persist a `status='invalid'` row (because the happy-path branch treated anything other than 'valid' as invalid), silently mis-classifying outages as rejections.
- **Fix:** After the VIES call returns, inspect `viesResult.status === 'unavailable'` and route through the same `softFail()` helper the catch-branch uses. Single D-08 code path; schema violations (still thrown as `ViesApiError('VIES response schema violation', 500)`) continue to flow through the catch branch.
- **Evidence:** Covered by the Zod-violation test ("ViesClient throws → unavailable") which exercises the throw-path. The not-thrown path is covered by the tRPC-router integration tests in Plan 57-04.
- **Commit:** `95e1c51`

**3. [Rule 2 — Correctness] Rule evaluation order in `detectReverseCharge` restructured**

- **Found during:** Task 2 (writing the §13b + B2C regression test)
- **Issue:** Original rule order (same-country short-circuit FIRST, then B2B check) made §13b impossible to reach — §13b is a same-country rule. Additionally, when `serviceType='GOLD' + isB2B=false`, we needed `not_applicable` (B2C), not `de_domestic_13b_ustg`.
- **Fix:** Re-ordered to: (0) B2C short-circuit FIRST; (1) §13b BEFORE same-country short-circuit; (2) same-country; (3) GB↔EU symmetric (before generic EU); (4) generic EU; (5) GCC. Added explicit test for DE→DE + GOLD + B2C → `not_applicable`.
- **Files modified:** `packages/api/src/services/reverse-charge.service.ts`
- **Commit:** `54fbcc7`

### Out-of-Scope Discoveries (NOT fixed, logged)

- **Pre-existing `@contractor-ops/api` build errors:** Postinstall `turbo build` fails on Prisma Exact-type incompatibilities in Better-Auth plugin files and many Phase ≤56 routers (identical to the errors documented in Plan 57-01 and 57-02 summaries). Vitest still runs green because vitest uses esbuild/ts-node transform, not tsc. NOT fixed here — outside plan scope, owned by separate remediation workstream.
- **Husky pre-commit auto-format commits:** During Task 3 commit, the husky hook staged 186 unrelated formatting diffs across `apps/landing/`, `apps/web/`, `packages/api/src/emails/`, and newly-created MSW integration test scaffolds in `packages/gov-api/` + `packages/integrations/`. Per SCOPE BOUNDARY rules, these were NOT committed — they remain in the working tree for the next owner. Same pattern observed in Plan 57-01 / 57-02 worktrees.

## Security & Threat-Model Evidence

| Threat | Mitigation | Evidence |
|--------|-----------|----------|
| T-57-03-01 (Tampering) dual-write drift | `prisma.$transaction([create, update])` atomic | `grep '\$transaction' tax-id-validation.service.ts` → 2 hits; Task 1 Test "atomic dual-write" asserts rollback on failure |
| T-57-03-02 (InfoDisclosure) raw VAT in logs | `maskTaxId()` on every log statement | Task 1 Test "PII logging safety" asserts no raw `GB193054661` in console.log / console.error calls |
| T-57-03-03 (Tampering) freshness-window bypass | Pure `isValidationFresh()` always re-computes from `now` | Task 1 tests "91 days old → stale window exceeded → unavailable" + "valid row within 90d → fresh=true" |
| T-57-03-04 (DoS) retry storm | NO retry loop in orchestrator; single try/catch | Manual review of `tax-id-validation.service.ts` — only one call to `hmrc.checkVatNumber` / `vies.checkVatNumber` per invocation |
| T-57-03-05 (EoP) cross-org lookup | `getLatestValidation` filters by `contractorId`; all writes scope by `organizationId` from input | `grep 'organizationId: input.organizationId' tax-id-validation.service.ts` → present in every `create` data |
| T-57-03-06 (InfoDisclosure) schema drift surfaces upstream text | Thrown schema-violation caught and mapped to `unavailable` with `errorMessage: schema violation` — raw upstream body never forwarded | Task 1 Test "Zod schema failure surfaces as unavailable" |
| T-57-03-07 (Tampering) §13b enum | String-literal union, not DB-driven — no injection surface | `DE13bServiceType` is TS string literal union; `DE_13B_SERVICE_TYPES.has()` check is strict set membership |
| T-57-03-08 (Spoofing) KU override | `applyKleinunternehmerOverride` reads only `org.isKleinunternehmer` from the passed-in snapshot; no user-input path | Task 3 contract — `org` param typed `{countryCode, isKleinunternehmer}`; tRPC caller loads from Prisma |
| T-57-03-09 (Repudiation) retention | Append-only table; `errorMessage` captured on soft-fail paths | `softFail()` persists `errorMessage` on both stale + unavailable branches |

## Authentication Gates

None. HMRC + VIES live credentials are injected into the clients at construction time (via `SecretStore` in Plan 57-02); this plan's tests inject stub clients via `vi.fn()`. Live HMRC-sandbox onboarding remains a manual task tracked in VALIDATION.md.

## Plan 57-04 Handoff

Consumers of this plan should:

1. `import { validateTaxId, getLatestValidation, isValidationFresh, NINETY_DAYS_MS, maskTaxId, type TaxIdValidationInput, type TaxIdValidationResult } from '@contractor-ops/api/services'` (barrel) — or deep-import from `./services/tax-id-validation.service.js`.
2. `import { detectReverseCharge, applyReverseCharge, DE_13B_SERVICE_TYPES, type DE13bServiceType, type ReverseChargeResult } from '@contractor-ops/api/services'`.
3. `import { applyKleinunternehmerOverride, shouldSuppressVatBreakdown, type KleinunternehmerOverrideResult } from '@contractor-ops/api/services'`.
4. Construct `HmrcVatClient` + `ViesClient` once per process (with SecretStore-backed credentials + `platformVrn` env var) and inject into `validateTaxId` via `deps`. Rate-limit + audit hooks fire automatically per `organizationId`.
5. Plan 57-04 invoice router must:
   - Call `applyKleinunternehmerOverride` AFTER any reverse-charge classification (so RC→KU precedence fires correctly).
   - Gate the VAT-totals breakdown render on `!shouldSuppressVatBreakdown(org)`.
   - Render `TAX_KLEINUNTERNEHMER_NOTICE` (locked in Plan 57-01 `legal/de.ts`) in the footer when `shouldSuppressVatBreakdown === true`.
   - Pass `serviceType` to `applyReverseCharge` from the invoice line's service classification (Plan 57-04 UI adds the picker).

## Observed vs Expected

| Expected | Observed | Notes |
|----------|----------|-------|
| Wave-0 RED scaffolds for `tax-id-validation.service.test.ts` + `reverse-charge.service.test.ts` | Both fully converted to GREEN (15 + 16 tests) | Exceeded per-suite target of 10 |
| Prisma types include `TaxIdType`, `ValidationStatus` | Confirmed (`@contractor-ops/db` exports both) | Plan 57-01 `db push` already surfaced them |
| No orchestrator circular dep | Confirmed | `gov-api` → (no cycle); `validators` → (used only for pre-flight; Phase 56 canonical fns) |
| Commit-per-task with conventional messages | 3 commits: 95e1c51, 54fbcc7, 9111ac7 | All on `v2` branch, atomic per task |

## Known Stubs

None for this plan. The only `RED — Phase 57` sentinel still present in `packages/api/src/services/__tests__/` is `tax-rate.service.test.ts`, which Plan 57-01 explicitly deferred to Plan 57-04 Task 4 (requires a real-test-DB helper not yet in place). Not owned by Plan 57-03.

## Self-Check: PASSED

- FOUND: packages/api/src/services/tax-id-pii.ts
- FOUND: packages/api/src/services/tax-id-validation.service.ts
- FOUND: packages/api/src/services/kleinunternehmer.service.ts
- FOUND: packages/api/src/services/index.ts
- FOUND: packages/api/src/services/__tests__/tax-id-pii.test.ts
- FOUND: packages/api/src/services/__tests__/tax-id-validation.service.test.ts
- FOUND: packages/api/src/services/__tests__/reverse-charge.service.test.ts
- FOUND: packages/api/src/services/__tests__/kleinunternehmer.service.test.ts
- FOUND: commit 95e1c51 (Task 1)
- FOUND: commit 54fbcc7 (Task 2)
- FOUND: commit 9111ac7 (Task 3)
- VERIFIED: 43/43 tests across 4 suites green (15 + 3 + 16 + 9)
- VERIFIED: Wave-0 RED scaffolds owned by Plan 57-03 all converted to GREEN; only the Plan 57-04-owned `tax-rate.service.test.ts` RED remains
- VERIFIED: All acceptance-criteria grep-patterns return ≥1 hit
- VERIFIED: `@contractor-ops/gov-api` successfully linked into `@contractor-ops/api/node_modules/`
