---
phase: 80-v6-0-verification-hardening-manual-uat
verified: 2026-06-05T18:30:00Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Cross-feature integration test exercises FULL COMPOSITION on ONE seeded contractor: UAE free zone with expiring license + IP-clause LIKELY_MISSING + Saudi-national assignment with Qiwa-auth gap → payment hard-blocked AND offboarding hard-blocked AND Saudization band trajectory preview shown; every gate fires; every audit row written; locked-phrase guard green."
    status: partial
    reason: |
      The test is PARTIALLY composed, not fully composed. There is no single test body in which the
      free-zone item, the Saudi-national Saudization headcount, and the open IP_VERIFICATION task
      coexist on ONE shared store and drive all three gates in sequence. The five describe blocks are
      isolated: (1) F1+F3 block (lines 187-241) exercises runComplianceReminderScan → assertContractorPaymentEligibility
      against the shared store, but never calls projectOffboardingTrajectory on the same state. (2) F3
      advisory (lines 243-272) calls projectOffboardingTrajectory with hand-built literal headcount that
      is unconnected to the store or to the seeded CONTRACTOR_ID. (3) F4 (lines 296-325) builds a
      wholly separate makeGateClient that never reads store.items. (4) beforeEach resets store between
      every it, so no state persists across the F1 flip, F3 advisory, and F4 hard-block. There is no
      test where the composition chain "scan → EXPIRED → payment-blocked AND advisory-rendered AND
      offboarding-blocked" runs against a single coherent contractor state. The three gates are
      independently exercised in the same file; they do NOT compose in the sense SC#1 requires.
      Additionally, the payment-gate prisma mock ignores contractorId and organizationId filters (lines
      101-107), so tenant-isolation is not verified. The F4 makeGateClient.workflowTaskRun.findMany
      ignores its where clause entirely — the IP_VERIFICATION taskType filter and workflowRunId
      filters are never validated. The F1/F3 audit assertion uses the would-block branch (flagEnabled:false)
      rather than the enforced (flagEnabled:true/default) hard-block path that SC#1 describes, because
      the enforced path throws and writes no audit row — this is a real behavioural gap in the test
      relative to the SC#1 description of "payment hard-blocked AND audit row written."
    artifacts:
      - path: "packages/api/src/__tests__/v6-cross-feature-composition.test.ts"
        issue: |
          Five isolated describe blocks with per-it store resets. No single test seeds all three
          state items (free-zone BLOCKING, Saudi-national headcount, open IP_VERIFICATION task) on
          ONE contractor and drives the full gate chain in sequence. projectOffboardingTrajectory is
          called with literal params disconnected from the shared store. makeGateClient never reads
          store.items. prisma.contractorComplianceItem.findMany ignores contractorId/organizationId.
          workflowTaskRun.findMany ignores all where predicates.
    missing:
      - "At least one test that seeds the contractor with all three states in store, then: (1) runs scan → PENDING→EXPIRED, (2) calls assertContractorPaymentEligibility and verifies it throws PRECONDITION_FAILED, (3) calls projectOffboardingTrajectory with headcount derived from the same seeded org context and verifies advisory output, (4) calls assertRunCompletable with the IP task present and verifies it throws PRECONDITION_FAILED — all in one it body or a tight sequence within one describe."
      - "prisma mock must honour contractorId.in and contractor.is.organizationId filters to make tenant-isolation assertions load-bearing (WR-02)."
      - "makeGateClient.workflowTaskRun.findMany must apply the taskType='IP_VERIFICATION' predicate so the block assertion is not trivially satisfied (WR-03)."
human_verification: []
---

# Phase 80: v6.0 Verification + Hardening — Verification Report

**Phase Goal:** Cross-feature integration tests prove F1 + F3 + F4 compose correctly; manual-UAT checkpoints document captures all human-verify items; consolidated post-deploy legal sign-off list is ready for advisers when LOCAL-ONLY status flips.
**Verified:** 2026-06-05T18:30:00Z
**Status:** gaps_found — SC#1 composition claim partially unmet; SC#2 / SC#3 / SC#4 verified
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cross-feature integration test exercises FULL COMPOSITION on ONE seeded contractor | PARTIAL — BLOCKER | Five isolated describe blocks. No single test body runs the three gates (F1 scan+payment, F3 advisory, F4 offboarding) against shared store state. See detailed analysis below. |
| 2 | 80-HUMAN-UAT.md lists every manual UI UAT scenario across F1/F2/F3/F4 with F2 IdP present | VERIFIED | File exists; 21 scenarios; F2 has 8 dedicated entries covering every specified adapter; all result:[pending]; all have why_human triplet; 4 required section headers present. |
| 3 | 80-LEGAL-SIGNOFF.md catalogues every "Needs verification by legal entity" annotation, one section per adviser | VERIFIED | File exists; exactly 4 `## ` adviser sections (DE Steuerberater / UK tax-legal / UAE legal / KSA MOL-HRSD+legal); all required terms present (§48b EStG, Aufenthaltstitel, Werkvertrag, IR35, ITEPA, Border Security, free-zone, LOCKED_AE, Saudization, Nitaqat, Qiwa, Iqama); post-deploy/DEFERRED framing present; 24 PENDING namespaces accounted for (4 in primary sections + cross-cutting subsections for IdP/PL/US rows). |
| 4 | 80-RETROSPECTIVE.md documents (a) hard deps planned-vs-differed, (b) all PENDING Unleash flags by namespace + post-deploy pointers, (c) plan-completion velocity vs v5.0 | VERIFIED | File exists; "## Hard Dependency Play-Out" present with 5 edges plus cross-phase deviation; "## PENDING Unleash Flags by Namespace" present listing all 24 flags with notes-sourced pointers; "## Velocity vs v5.0 Baseline" present with 7.5 vs 5.0 plans/phase (+50%); "## Verdict" present; LOCAL-ONLY/DEFERRED Standing Constraint stated. |

**Score:** 3/4 — SC#1 is PARTIAL (BLOCKER); SC#2, SC#3, SC#4 are VERIFIED

---

## SC#1 Composition Analysis (Mandatory Scrutiny)

This section adjudicates the MANDATORY_SCRUTINY challenge raised in the verification request. The conclusion is reached by direct reading of the test source, not from SUMMARY claims.

### What the test actually contains

The file has five describe blocks, each with a top-level `beforeEach` (line 181-185) that resets `store.items.length = 0`, `clientCache.clear()`, and `auditWriteSpy.mockClear()` between every `it`. This means every individual test case begins with an empty store.

**Describe 1 — "SC#1 F1+F3" (lines 187-241):**
- Seeds store with a free-zone BLOCKING PENDING item via `recordValidFreeZoneItem`.
- Three `it` cases: (a) payment not blocked while PENDING, (b) scan flips to EXPIRED, (c) after scan, payment gate throws PRECONDITION_FAILED.
- `projectOffboardingTrajectory` is **never called** in this describe block. The label "F1+F3" is misleading — only F1 (compliance payment gate + scan) is tested. F3 Saudization advisory does not participate.

**Describe 2 — "SC#1 F3" (lines 243-272):**
- **Never seeds store.** Calls `projectOffboardingTrajectory` with hardcoded literal params (`totalHeadcount: 100, saudiHeadcount: 50`).
- Completely disconnected from the free-zone item, the scan, or the CONTRACTOR_ID. A pure function test.

**Describe 3 — "SC#1 F4" (lines 296-325):**
- Builds `makeGateClient({ openIpTaskIds: ['task_ip'] })` which is a separate in-memory structural object — it never reads `store.items`.
- Calls `assertRunCompletable` on this separate client.
- No free-zone item, no scan, no Saudization state is involved.

**Describe 4 — "SC#1 audit" (lines 327-367):**
- Seeds store and runs `runComplianceReminderScan` + `assertContractorPaymentEligibility` with `flagEnabled: false` (the would-block branch, not the enforced hard-block). This is needed because the enforced path (flagEnabled:true, which is the default and what SC#1 describes as "payment hard-blocked") **throws and writes no audit row** — so the test switches to the non-enforced path to get an audit row.
- The F4 leg in this block is a second `makeGateClient` with no connection to the F1 store state.

**Describe 5 — "SC#1 locked-phrase guard" (lines 369-387):**
- Pure validator imports. No connection to any gate state.

### Composition verdict

SC#1 requires "ONE seeded contractor" driving "payment hard-blocked AND offboarding hard-blocked AND Saudization band trajectory preview shown" in a single run. The test does not provide this:

- There is **no single test** where the free-zone item is seeded, the scan is run, the payment gate throws PRECONDITION_FAILED (enforced mode), and in the same run `projectOffboardingTrajectory` is called against the same contractor's headcount and `assertRunCompletable` is called against an IP task all in shared state.
- F3 (Saudization) is decoupled from the shared store entirely — it is a pure-function test with literal params.
- F4 (assertRunCompletable) uses a structurally separate gate client that never reads the free-zone store.
- The audit assertion requires switching the payment gate to `flagEnabled:false` (would-block mode) because the SC#1 enforced hard-block path writes no audit row. The SC#1 description says "payment hard-blocked AND audit row written" — these are mutually exclusive with the current service implementation and mock wiring.

The 80-REVIEW WR-01 finding is **confirmed by direct code reading**: the features are exercised in isolated describe blocks against fresh-per-it state, not in a single composed scenario.

### What the test DOES prove (partial credit)

- The F1 scan-then-expire-then-payment-block chain works against one shared store (the third `it` in Describe 1 does this correctly within F1 scope).
- `projectOffboardingTrajectory` returns the correct advisory shape.
- `assertRunCompletable` hard-blocks on an open IP_VERIFICATION task.
- The would-block audit path emits the correct AuditLog row.
- The locked-phrase guard is green.

These are genuine, green assertions. They are the per-feature unit-style checks. What is absent is the cross-feature composition that SC#1 specifies.

### Additional mock quality gaps (confirmed, WR-02/WR-03)

**WR-02 confirmed:** `prisma.contractorComplianceItem.findMany` (lines 101-107) filters only on `where.severity` and `where.status`. The `contractorId` and `organizationId` fields are ignored. The three gate tests that call `assertContractorPaymentEligibility` with `organizationId: ME_ORG.id` do not verify tenant isolation — a cross-org row in the store would not be excluded.

**WR-03 confirmed:** `makeGateClient.workflowTaskRun.findMany` (line 285) returns all `openIpTaskIds` unconditionally, never inspecting `where.taskType`, `where.workflowRunId`, or `where.organizationId`. The IP_VERIFICATION taskType filter that the real `workflow-shared.ts:332-340` applies is not exercised.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/__tests__/v6-cross-feature-composition.test.ts` | SC#1 cross-feature composition test (≥120 lines) | STUB (partial) | File exists, 387 lines, tests pass. But the composition structure does not satisfy SC#1 (see above). File is substantive but does not achieve the stated purpose of cross-feature composition on one shared state. |
| `.planning/phases/80-.../80-HUMAN-UAT.md` | 21 manual UAT scenarios, F2 present, all pending | VERIFIED | 21 scenarios; 4 required headers; 21× `result: [pending]`; F2 IdP present (8 scenarios). |
| `.planning/phases/80-.../80-LEGAL-SIGNOFF.md` | 4 adviser sections, 24 flags catalogued | VERIFIED | 4 `## ` headers; DE/UK/UAE/KSA items confirmed; all 24 PENDING namespaces accounted for via adviser sections + cross-cutting subsections. |
| `.planning/phases/80-.../80-RETROSPECTIVE.md` | Hardening gates + deps + flags + velocity | VERIFIED | All 4 required SC#4 sections present; 14 gates recorded; 24 flags inventoried; velocity computed; verdict present. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| v6-cross-feature-composition.test.ts | compliance-reminder-scan.ts | runComplianceReminderScan | WIRED (F1 only) | Called in Describe 1 and Describe 4. Correctly arms the payment gate in F1 context. Does NOT connect to F3 or F4 state. |
| v6-cross-feature-composition.test.ts | compliance-payment-gate.ts | assertContractorPaymentEligibility | WIRED (F1 only) | Called in Describe 1 and Describe 4. Payment hard-block is exercised. Enforced path tested in Describe 1 it #3. Would-block path used in Describe 4 for audit assertion (flagEnabled:false). |
| v6-cross-feature-composition.test.ts | workflow/workflow-shared.ts | assertRunCompletable | WIRED (F4 isolated) | Called in Describes 3 and 4 via separate makeGateClient. Never reads shared store. |
| v6-cross-feature-composition.test.ts | saudization-dashboard.ts | projectOffboardingTrajectory | WIRED (F3 isolated) | Called in Describe 2 with hardcoded literal params. Not connected to store, CONTRACTOR_ID, or any gate state. |
| 80-LEGAL-SIGNOFF.md | signoff-registry-flags.json | per-namespace notes fields | VERIFIED | Registry notes restated verbatim inline per item; 24 PENDING namespaces covered. |
| 80-RETROSPECTIVE.md | 80-01-SUMMARY.md | records 80-01 test result | VERIFIED | "PASS 11/11" recorded in Hard Dependency Play-Out and Verdict sections. |
| 80-RETROSPECTIVE.md | signoff-registry-flags.json | getAllPending() / notes → flag inventory | VERIFIED | All 24 PENDING flags listed by namespace with notes-sourced approval pointers; `getAllPending()` cited as enumeration source. |

---

## Data-Flow Trace (Level 4)

SC#1 is a test file, not a rendering component; Level 4 data-flow analysis is N/A for render concerns. The relevant data-flow question is whether the shared mutable store flows through all three gate functions in sequence — it does NOT (as established above in the Composition Analysis).

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 11 test assertions pass | `pnpm --filter @contractor-ops/api test v6-cross-feature-composition` | SUMMARY claims 11/11 PASS; 80-04 SUMMARY re-confirms at HEAD | PASS (test pass confirmed in 80-01 SUMMARY + re-run recorded in 80-04 RETROSPECTIVE; cannot independently re-run without server but the SUMMARY is a direct test runner claim with commit hashes `cd4b6932` + `302fc6d9`) |
| typecheck clean | `pnpm typecheck --filter @contractor-ops/api` | SUMMARY claims exit 0 | PASS (claimed in 80-01 SUMMARY) |

Note: Tests passing does not resolve the composition gap — the 11 tests prove the individual gate behaviours, not their cross-feature composition. Green tests are a necessary but not sufficient condition for SC#1.

---

## Probe Execution

No probe scripts declared for this phase. Step 7c: SKIPPED (no `scripts/*/tests/probe-*.sh` for this phase).

---

## Requirements Coverage

Phase 80 carries no ROADMAP requirement IDs by design (verification phase covers all v6.0 surfaces). Requirements coverage is assessed against the four SC clauses directly.

| Success Criterion | Status | Evidence |
|-------------------|--------|----------|
| SC#1 — Cross-feature composition test | PARTIAL — BLOCKER | Five isolated describe blocks; no single test composes F1+F3+F4 on shared state; WR-01/WR-02/WR-03 confirmed by direct code reading |
| SC#2 — 80-HUMAN-UAT.md with all F1/F2/F3/F4 UAT scenarios, F2 IdP MUST be present | VERIFIED | 21 scenarios, F2 has 8 entries, all required fields present, all result:[pending] |
| SC#3 — 80-LEGAL-SIGNOFF.md, one section per adviser (DE/UK/UAE/KSA) | VERIFIED | 4 `## ` sections, all required legal terms present, 24 PENDING flags accounted for |
| SC#4 — 80-RETROSPECTIVE.md documents hard deps planned-vs-differed, PENDING flags by namespace, velocity vs v5.0 | VERIFIED | All 4 required SC#4 sub-items present; 14 gates recorded; correct structure |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `v6-cross-feature-composition.test.ts:285` | `makeGateClient.workflowTaskRun.findMany` ignores all `where` predicates entirely — returns all openIpTaskIds unconditionally | Warning | IP_VERIFICATION taskType filter and workflowRunId/organizationId scoping are not verified; a regression dropping the taskType predicate would still pass (WR-03) |
| `v6-cross-feature-composition.test.ts:101-107` | `prisma.contractorComplianceItem.findMany` ignores `contractorId` and `organizationId` filters | Warning | Tenant-isolation assertions on `contractorReasons` are not load-bearing (WR-02) |
| `v6-cross-feature-composition.test.ts:243-272` | F3 describe uses hardcoded literal headcount params disconnected from the shared store and CONTRACTOR_ID | Warning | The "F3 Saudization advisory" in the composition claim is not exercised on the same contractor as the free-zone gate; the advisory result is decoupled from any shared state (WR-01) |
| `v6-cross-feature-composition.test.ts:328-357` | Audit assertion uses `flagEnabled:false` (would-block branch) to emit an audit row, whereas SC#1 specifies "payment hard-blocked" (enforced mode). The enforced path (default, flagEnabled:true) throws and writes no audit row. | Info | The audit row assertion is correct for the would-block branch, but SC#1 says "payment hard-blocked AND audit row written" — these are mutually exclusive in the current service; the test documents this deviation in a comment but SC#1's stated requirement is not fully satisfied. |

No TBD/FIXME/XXX/seed-dev/real-secrets anti-patterns found. All debt markers checked; none present.

---

## Human Verification Required

No automated-check-passing items require human verification. The gaps identified above are code-structural and verifiable by static inspection of the test file.

SC#2 deliverable (80-HUMAN-UAT.md) documents 21 items requiring post-deploy human testing — those are deferred UAT items, not verification blockers for this phase.

---

## Gaps Summary

**One gap blocking full goal achievement:**

SC#1 specifies a single composed scenario: one seeded contractor drives all three gates (F1 payment hard-block, F3 Saudization advisory, F4 offboarding hard-block) in a single run against shared store state. The delivered test exercises all three gates, but in five isolated describe blocks where:

1. The F3 advisory function is never called with data derived from the shared store or the seeded contractor — it uses hardcoded literal params.
2. The F4 gate uses a structurally separate in-memory client that is completely decoupled from the free-zone item's store.
3. `beforeEach` resets store between every `it`, so no single test accumulates the full contractor state.
4. The tenant-isolation assurance (that only CONTRACTOR_ID's items appear in `contractorReasons`) is undermined by the prisma mock ignoring `contractorId` and `organizationId` filters.
5. The IP_VERIFICATION filter assurance is undermined by the gate client mock ignoring all `where` predicates.

The 80-REVIEW (WR-01, WR-02, WR-03) findings are **confirmed** by direct code reading. The test's headline — "features COMPOSE" — is not demonstrated. Passing 11/11 tests does not imply SC#1 is met: eleven independent gate-behaviour assertions that all happen to be in the same file are not the same as one composed scenario proving the gates interact on shared state.

**Root cause:** The test was constructed by assembling three existing test patterns (free-zone-record-then-expire, workflow-execution-ip-block, saudization-derivation) side by side rather than composing them into a single contractor scenario that threads shared state through all three services.

**Fix required for SC#1:** Add one test (or restructure the existing F1+F3 describe) that:
- Seeds the contractor with all three states: a free-zone BLOCKING item in store, a Saudi-national headcount, and an open IP_VERIFICATION task in makeGateClient.
- Runs `runComplianceReminderScan` → asserts payment gate blocks (enforced mode) → calls `projectOffboardingTrajectory` with headcount referencing the same org/contractor context → calls `assertRunCompletable` with the open IP task — all in one flow.
- Uses mocks that honour the real where predicates for contractorId/orgId and taskType.

SC#2, SC#3, and SC#4 are fully verified.

---

_Verified: 2026-06-05T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
