---
phase: 75
slug: f4-offboarding-contract-health-check-ip-verification-credent
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-27
---

# Phase 75 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — workspace-level via `pnpm test`) |
| **Config file** | `vitest.config.ts` per package (existing — `packages/api`, `packages/integrations`, `packages/validators`, `packages/compliance-policy`, `packages/db`, `apps/web`) |
| **Quick run command** | `pnpm --filter @contractor-ops/<package> test -- --run <test-pattern>` |
| **Full suite command** | `pnpm test` (workspace-wide) |
| **Estimated runtime** | ~30s per package; ~6 min full workspace |

---

## Sampling Rate

- **After every task commit:** Run the per-package quick command for the package(s) the task touched
- **After every plan wave:** Run `pnpm test` workspace-wide
- **Before `/gsd-verify-work`:** Full workspace suite must be green
- **Max feedback latency:** 60s for per-package; 6 min for full

---

## Per-Task Verification Map

> Concrete tasks are produced by the planner. The matrix below maps each Phase 75 requirement / Nyquist dimension to a stable test file and command. Planner tasks reference these test files in their `read_first` and `acceptance_criteria` fields.

| Dim | Requirement | Threat Ref | Secure Behavior | Test File | Test Type | Quick Command | Wave |
|-----|-------------|------------|-----------------|-----------|-----------|---------------|------|
| 1 | OFFB-04 | — | Schema migration is reversible and additive (no data loss on existing rows) | `packages/db/src/__tests__/phase-75-schema.test.ts` (NEW) | integration | `pnpm --filter @contractor-ops/db test -- --run phase-75-schema` | 1 |
| 2 | OFFB-04, OFFB-05 | T-75-01 (LLM injection) | tool_use round-trip extracts verdict from a fixture UK PDF without trusting unvalidated model output | `packages/integrations/src/adapters/__tests__/contract-health-tools.test.ts` (NEW) | unit | `pnpm --filter @contractor-ops/integrations test -- --run contract-health-tools` | 2 |
| 3 | OFFB-04 | T-75-02 (replay/dedup) | Re-run on same `(contractId, contentHash, modelVer)` is a no-op; `force: true` bypass requires admin role | `packages/api/src/services/contract-health/__tests__/dedup.test.ts` (NEW) | integration | `pnpm --filter @contractor-ops/api test -- --run contract-health/dedup` | 2 |
| 4 | OFFB-04 | — | `resultsJson` validates against versioned Zod schema (D-06) | `packages/validators/src/legal/__tests__/ip-clauses-results-schema.test.ts` (NEW) | unit | `pnpm --filter @contractor-ops/validators test -- --run ip-clauses-results-schema` | 1 |
| 5 | OFFB-05 | — | LIKELY_MISSING creates exactly one open `ContractorComplianceItem` of severity WARNING with matching policyRuleId | `packages/api/src/services/contract-health/__tests__/materialise.test.ts` (NEW) | integration | `pnpm --filter @contractor-ops/api test -- --run contract-health/materialise` | 2 |
| 6 | OFFB-06 | T-75-03 (auth bypass on workflow completion) | `completeTask` raises `PRECONDITION_FAILED` while IP_VERIFICATION open; OWNER override path clears it | `packages/api/src/routers/__tests__/workflow-execution-ip-block.test.ts` (NEW) | integration | `pnpm --filter @contractor-ops/api test -- --run workflow-execution-ip-block` | 2 |
| 7 | OFFB-06 | T-75-04 (webhook race condition) | e-sign `signing.completed` triggers atomic 3-step transaction (Document insert + task COMPLETED + ContractorComplianceItem SATISFIED) | `packages/integrations/src/services/__tests__/esign-webhook-ip-ratification.test.ts` (NEW) | integration | `pnpm --filter @contractor-ops/integrations test -- --run esign-webhook-ip-ratification` | 3 |
| 8 | OFFB-08 | T-75-05 (silent ops bypass) | Soft-warning gate returns structured warning payload; admin confirmation requires reason; audit row written | `packages/api/src/routers/__tests__/workflow-execution-credential-warning.test.ts` (NEW) | integration | `pnpm --filter @contractor-ops/api test -- --run workflow-execution-credential-warning` | 2 |
| 9 | OFFB-08 | T-75-06 (secret leak via paste) | Each of 11 secret-shape patterns rejects positive input with `BAD_REQUEST` + patternId; negative inputs pass | `packages/validators/src/__tests__/secret-shape-detector.test.ts` (NEW) | unit | `pnpm --filter @contractor-ops/validators test -- --run secret-shape-detector` | 1 |
| 10 | OFFB-05 | T-75-07 (UK boilerplate in DE contract) | DE contract citing only UK-namespace phrases yields verdict=MANUAL_REVIEW_REQUIRED + crossJurisdictionMismatch flag | `packages/api/src/services/contract-health/__tests__/cross-jurisdiction.test.ts` (NEW) | integration | `pnpm --filter @contractor-ops/api test -- --run contract-health/cross-jurisdiction` | 2 |
| 11 | OFFB-05 | — | `<HealthCheckPanel>` snapshot renders PENDING-phrase footer flag when `pendingPhrasesCited[]` is non-empty | `apps/web/src/components/contracts/__tests__/health-check-panel.test.tsx` (NEW) | unit | `pnpm --filter @contractor-ops/web test -- --run health-check-panel` | 3 |
| 12 | OFFB-09 | — | Each flow point writes exactly one audit-log row per invocation (Phase 71 D-15 single-write) | embedded across §6 / §7 / §8 / §10 tests above | integration | as above | per-wave |
| 13 | OFFB-09 | T-75-08 (cron storm on bulk re-run) | Bulk re-run script enqueues at most one job per contract per invocation; honors dedup window | `packages/api/src/__tests__/bulk-rerun-contract-health.test.ts` (NEW) | integration | `pnpm --filter @contractor-ops/api test -- --run bulk-rerun-contract-health` | 2 |
| 14 | OFFB-05 | — | Every IP-clause phraseId has a `legal-signoff.ip_clauses.<phraseId>` PENDING entry; parity test enforces 100% coverage | `packages/validators/src/__tests__/ip-clauses-parity.test.ts` (NEW) | unit | `pnpm --filter @contractor-ops/validators test -- --run ip-clauses-parity` | 1 |
| 15 | OFFB-04, OFFB-08 | — | `pnpm db:push:all-regions` succeeds on every region (Standing Constraint); each region records the migration | `packages/db/scripts/__tests__/push-all-regions-phase-75.test.ts` (NEW; mocks regions) | integration | `pnpm --filter @contractor-ops/db test -- --run push-all-regions-phase-75` | 1 |

---

## Wave 0 Requirements

Wave 0 (Plan 75-01) installs failing-test scaffolds (RED state) for every dimension above. The plan must:

- [ ] Create empty `phase-75-schema.test.ts`, `contract-health-tools.test.ts`, `dedup.test.ts`, `ip-clauses-results-schema.test.ts`, `materialise.test.ts`, `workflow-execution-ip-block.test.ts`, `esign-webhook-ip-ratification.test.ts`, `workflow-execution-credential-warning.test.ts`, `secret-shape-detector.test.ts`, `cross-jurisdiction.test.ts`, `health-check-panel.test.tsx`, `bulk-rerun-contract-health.test.ts`, `ip-clauses-parity.test.ts`, `push-all-regions-phase-75.test.ts` — each with one `it.todo()` per Nyquist dimension or with the simplest failing assertion that proves the file is wired into the test runner
- [ ] Seed `legal-signoff.ip_clauses.*` PENDING entries in `signoff-registry.json` for every phraseId enumerated in RESEARCH.md §5 (16 entries: 3 UK + 4 DE + 3 PL + 3 US + 2 KSA + 2 UAE — adjust to actual phrase count when implementing)
- [ ] Update Vitest workspace include patterns if any new test paths fall outside existing `**/__tests__/**` globs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Anthropic API tool_use round-trip | OFFB-04 | Real-API call costs money + flaky on CI | Run `pnpm tsx packages/api/scripts/manual-test-contract-health.ts <contractId>` (NEW script) with `ANTHROPIC_API_KEY` set; verify a `ContractHealthCheckRun` row lands with `status='SUCCEEDED'` and a non-empty `resultsJson.ipAssignment.citedClauses` |
| Real DocuSign signing.completed webhook | OFFB-06 | DocuSign sandbox + ngrok tunnel required | Use DocuSign sandbox account; trigger `signing.completed` against deployed webhook URL; verify atomic 3-step transaction lands |
| Real Autenti signing-completed webhook | OFFB-06 | Autenti sandbox + ngrok tunnel required | Same as DocuSign for DE jurisdiction |
| Multi-region migration | OFFB-04, OFFB-08 | Production DB infrastructure | Per Standing Constraint — manual `pnpm db:push:all-regions` post-deploy |
| Steuerberater wording sign-off | OFFB-05 (DE) | Legal review out-of-scope per Standing Constraint | Post-deploy PR per phraseId flips signoff-registry.json entry to APPROVED with `legalTicketRef` |
| UK / PL / US / KSA / UAE adviser sign-off | OFFB-05 | Same | Same per-jurisdiction PR pattern |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: every plan wave runs full suite; no 3 consecutive tasks without automated verify
- [x] Wave 0 (Plan 75-01) covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s for per-package quick runs
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-27 (research-time)
