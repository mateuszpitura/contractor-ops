---
phase: 75-f4-offboarding-contract-health-check-ip-verification-credent
plan: 06
subsystem: api
tags: [contract-health, anthropic, qstash, audit, rls, fastify, regex-grounding]

requires:
  - phase: 75-02
    provides: ContractHealthCheckRun + Contract.complianceFlags* + jurisdiction columns
  - phase: 75-03
    provides: per-jurisdiction IP policy rules the materialiser resolves
  - phase: 75-04
    provides: ALL_IP_CLAUSES regex library + ipAssignmentResultsSchema
provides:
  - runContractHealthCheck orchestrator (dedup → LLM → grounding → cross-jurisdiction → persist → denormalise → materialise → audit)
  - integrations evaluateContractIpAssignment Anthropic service + CONTRACT_HEALTH_TOOL schema
  - Fastify QStash callback POST /contract-health/_run
  - contract.create QStash enqueue + contract.rerunHealthCheck mutation + bulk-rerun script
affects: [75-08]

tech-stack:
  added: []
  patterns:
    - "LLM call lives in integrations service (keeps @anthropic-ai/sdk out of the api package); api orchestrator composes"
    - "QStash callback = Fastify route under the webhook raw-body plugin (guardQStashRequest), registered in EXPECTED_ROUTES"

key-files:
  created:
    - packages/integrations/src/adapters/contract-health-tools.ts
    - packages/integrations/src/services/contract-health-service.ts
    - packages/api/src/services/contract-health/model.ts
    - packages/api/src/services/contract-health/cross-jurisdiction.ts
    - packages/api/src/services/contract-health/dedup.ts
    - packages/api/src/services/contract-health/materialise.ts
    - packages/api/src/services/contract-health/run-health-check.ts
    - packages/api/src/services/contract-health/index.ts
    - apps/api/src/routes/contract-health.ts
    - packages/api/scripts/bulk-rerun-contract-health.ts
  modified:
    - packages/integrations/src/index.ts
    - packages/api/src/routers/core/contract.ts
    - packages/api/package.json (./services/contract-health export)
    - apps/api/src/routes/webhooks/index.ts
    - scripts/check-webhook-routes.mjs (EXPECTED_ROUTES + POST /contract-health/_run)
    - 5 RED tests flipped (dedup/materialise/cross-jurisdiction/contract-health-tools/bulk-rerun)

key-decisions:
  - "Anthropic call extracted to integrations contract-health-service.evaluateContractIpAssignment — the api package has no @anthropic-ai/sdk dependency (mirrors ocr-service.extractInvoice)"
  - "QStash callback is a Fastify route (apps/api/src/routes/contract-health.ts) using guardQStashRequest, NOT a Next.js Receiver handler; producer URL is ${API_URL}/contract-health/_run via publishJSONWithContext"
  - "materialise creates ONE ContractorComplianceItem for the IP rule directly (idempotent on contractor+policyRuleId) — NOT Phase 71 materialiseFromPolicy which materialises the entire jurisdiction rule set"
  - "PDF fetch resolves CONTRACT DocumentLink → Document.storageKey → createPresignedDownloadUrl → fetch (real wiring, not the plan's stub)"
  - "model pin = claude-sonnet-4-6 (the OCR adapter default), not the plan's stale claude-sonnet-4-5-20250514"
  - "tests use plain vi.fn / in-memory mock clients (vitest-mock-extended not installed; matches classification-supersession.test pattern)"

patterns-established:
  - "PENDING-phrase detection (D-16) reads the signoff registry via validators getDisclaimerStatus"

requirements-completed: [OFFB-04, OFFB-05, OFFB-09]

duration: 70 min
completed: 2026-05-31
---

# Phase 75 Plan 06: Contract Health-check Engine Summary

**Landed the full IP-assignment health-check pipeline — Anthropic tool_use eval + regex grounding + cross-jurisdiction mismatch + versioned ContractHealthCheckRun persistence + denormalisation + idempotent LIKELY_MISSING materialisation + single-write audit — plus the QStash fire-and-forget trigger, admin re-run mutation, and bulk-rerun script.**

## Performance
- **Duration:** ~70 min
- **Tasks:** 12/12
- **Files:** 20 (10 created + 10 modified, incl. 5 RED tests flipped)

## Accomplishments
- Orchestrator composes dedup (D-03 partial-unique-aware) → integrations LLM eval → D-13 regex grounding + divergence rules → D-15 cross-jurisdiction → transactional persist + Contract denormalise + materialise + audit.
- Fastify QStash callback wired into the webhook plugin + route contract; Contract.create enqueue + contract.rerunHealthCheck + bulk script all use publishJSONWithContext to ${API_URL}/contract-health/_run.
- 29 service tests + 7 tool tests + 3 bulk-shape tests GREEN; workspace typecheck 42/42; check:webhook-routes OK (27 routes).

## Task Commits
1. **75-06-01..12** - `36d989f6` (feat)

## Deviations from Plan

**[Architecture — Rule 4-class, resolved in-scope] Anthropic in integrations, not api** — The plan instantiated `new Anthropic()` inside the api orchestrator, but the api package has no `@anthropic-ai/sdk` dependency. Extracted the LLM call to `integrations/services/contract-health-service.evaluateContractIpAssignment` (mirrors ocr-service.extractInvoice). The orchestrator calls it. No new dependency added.

**[Path drift — 75-DRIFT-MAP] QStash route → Fastify** — `apps/web/src/app/api/qstash/contract-health-check/route.ts` does not exist (Vite SPA). Created `apps/api/src/routes/contract-health.ts` (Fastify, guardQStashRequest), registered in the webhook plugin + EXPECTED_ROUTES. Producer URL `${API_URL}/contract-health/_run` (not NEXT_PUBLIC_APP_URL).

**[Rule 1 — correctness] materialise design** — Phase 71 `materialiseFromPolicy(client, ctx)` resolves+materialises the ENTIRE jurisdiction rule set and takes no policyRuleId. A health check that found a missing IP clause must create ONE item. Wrote a focused, idempotent `materialiseLikelyMissing` that looks up the single IP rule from the registry and creates it directly.

**[Rule 1 — correctness] PDF fetch + countryCode + model pin** — Wired real R2 fetch (DocumentLink→Document→presigned download) instead of the plan's throwing stub. Used `Contractor/Organization.countryCode` (plan said `country`). Model pin `claude-sonnet-4-6` (plan's `claude-sonnet-4-5-20250514` predates the current OCR-adapter default).

**[Rule 3 — test infra] no vitest-mock-extended** — Plan's tests used `mockDeep<PrismaClient>`; the dep is not installed. Used plain `vi.fn`/in-memory mock clients (the repo's classification-supersession.test pattern). run-health-check end-to-end (Anthropic + R2 + QStash) stays as `it.todo` for manual smoke.

**Total deviations:** 1 architecture + 1 path-drift + 3 correctness + 1 test-infra. **Impact:** behavior matches D-01/03/04/05/07/13/15/16 intent; e2e LLM/R2 paths verified by typecheck + unit mocks, deferred to manual smoke.

## Pre-existing issues (out of scope)
- `pnpm lint:logs` still reports the single pre-existing `csp-report.ts:86` offence (unrelated to Phase 75). My new files use Pino/createLogger — no new offences.

## Self-Check: PASSED
- 9 new production files + router edit + route + script present.
- 5 RED tests GREEN (dedup/materialise/cross-jurisdiction/tool/bulk-shape); run-health-check e2e it.todo deferred.
- typecheck 42/42; check:webhook-routes OK; lint:logs no new offences.

## Next
Wave 2 final plan: 75-07 (credential-vault + IP-verification-gate tRPC).
