---
phase: 80-v6-0-verification-hardening-manual-uat
reviewed: 2026-06-05T16:08:45Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - packages/api/src/__tests__/v6-cross-feature-composition.test.ts
findings:
  critical: 0
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# Phase 80: Code Review Report

**Reviewed:** 2026-06-05T16:08:45Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `v6-cross-feature-composition.test.ts` — phase 80's sole application-source
change, billed as the milestone's proof that the four v6.0 gate primitives
(F1 payment gate, F3 Gulf free-zone / Saudization, F4 offboarding hard-block)
**compose** on the SC#1 mega-scenario against one shared mutable mock-Prisma store.

No security defects and no leaked secrets/PII (the legal-phrase fixtures are
public statutory authority names, not credentials). No crashes or data-loss
paths — this is a test file with no production reach.

However, the central claim of the artifact — that the features *compose* — is
not borne out by the code. The dominant defect class is **false-green / weak
assertions**: the mock stores discard the exact `where` clauses (tenant scope,
contractor id, task type, status) that the real services rely on for correctness,
so several regressions in the services under test would still pass green. The
file is also substantially a copy of two existing tests
(`free-zone-record-then-expire.test.ts`, `workflow-execution-ip-block.test.ts`)
plus a re-run of the validators `locked-phrases-guard.test.ts`, contributing little
net coverage beyond what already exists. These are quality/robustness issues, not
shipping blockers for a test artifact, so they are classified WARNING/INFO — but
the headline "cross-feature composition proof" is not actually demonstrated.

## Warnings

### WR-01: The three features are never composed — each is tested in an isolated `describe` against fresh state

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:187-387`
**Issue:** The file header (lines 1-30) and the SC#1 framing assert that F1, F3,
and F4 "actually COMPOSE … on ONE seeded ME-region contractor" with "a free-zone
BLOCKING license, a Saudi-national assignment, and an open IP_VERIFICATION
offboarding task." In practice:
- The "F1+F3" describe (187-241) calls only `assertContractorPaymentEligibility`
  and `runComplianceReminderScan`. `projectOffboardingTrajectory` (the F3 leg) is
  **never invoked** in this block — F1 is composed with nothing.
- The F3 describe (243-272) calls only `projectOffboardingTrajectory` with
  hand-built literal headcount params — it never touches `store`, the seeded
  contractor, or any F1/F4 state.
- The F4 describe (296-325) builds a wholly separate `makeGateClient` and never
  references the free-zone item, the scan, or the Saudization projection.
- `beforeEach` (181-185) resets `store` between every `it`, so even within F1
  no state survives across the "still valid" / "flip" / "arm block" cases — each
  re-seeds from scratch.

There is no single test in which the free-zone item, the Saudi assignment, and
the IP task coexist and interact. The artifact proves three independent unit
behaviours run in the same file, not that they compose. This is the primary
reason the deliverable does not meet its stated purpose.

**Fix:** Add at least one test that seeds the one contractor with all three
states in `store`, then drives the real flow end-to-end on shared state: scan →
flip free-zone PENDING→EXPIRED, assert payment gate blocks AND
`projectOffboardingTrajectory` (fed the same seeded headcount) returns the
advisory projection, AND `assertRunCompletable` hard-blocks on the open IP task —
all observing the same mutable store. Otherwise rename the file/headers to drop
the "compose" claim and present it as three co-located unit suites.

### WR-02: Payment-gate mock discards the tenant/contractor scope, so the org-isolation assertion is false-green

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:99-110, 207-236`
**Issue:** The real gate query (`compliance-payment-gate.ts:86-99`) filters on
`contractorId: { in: contractorIds }` AND `contractor: { is: { organizationId } }`
(the defense-in-depth tenant guard). The `prisma` mock `findMany` (101-108) only
inspects `where.severity` and `where.status` — it ignores `contractorId` and
`organizationId` entirely. Consequently the test at 207-236, whose name promises
"surfacing the free-zone doc in cause.contractorReasons" for a specific org +
contractor, would pass identically if the gate dropped its tenant guard or its
contractor filter. With a single seeded row the assertions on
`cause.contractorReasons[0]` are trivially satisfied regardless of scoping. The
tenant-isolation behaviour the test appears to exercise is not actually verified.

**Fix:** Make the `prisma` mock honour the `where` it receives:
```ts
return store.items.filter(r => {
  if (where.severity && r.severity !== where.severity) return false;
  if (where.status && r.status !== where.status) return false;
  const cid = (where.contractorId as { in?: string[] } | undefined)?.in;
  if (cid && !cid.includes(r.contractorId as string)) return false;
  const orgIs = (where.contractor as { is?: { organizationId?: string } } | undefined)?.is?.organizationId;
  if (orgIs && r.organizationId !== orgIs) return false;
  return true;
});
```
Then seed a second row under a different org/contractor and assert it is NOT in
`contractorReasons` — that turns 207-236 into a real isolation test.

### WR-03: `makeGateClient.workflowTaskRun.findMany` ignores its `where`, so the IP-block filter is not verified

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:278-294, 297-316`
**Issue:** `assertRunCompletable` (`workflow-shared.ts:332-340`) selects open IP
tasks with `where: { workflowRunId, organizationId, taskType: 'IP_VERIFICATION',
status: { in: ['TODO','IN_PROGRESS','BLOCKED'] } }`. The mock `findMany`
(285) is `async () => (opts.openIpTaskIds ?? []).map(id => ({ id }))` — it returns
the supplied ids unconditionally, never reading `where`. So the test asserts the
block fires but does NOT verify that the gate filters by `taskType`, by
`status`, by `workflowRunId`, or by `organizationId`. A regression that, e.g.,
dropped the `taskType: 'IP_VERIFICATION'` predicate (and thus blocked on ANY open
task) would still pass `cause.blockedTaskKind === 'IP_VERIFICATION'` here. The
`ME_ORG.id` argument threaded into `assertRunCompletable` (300) is decorative —
nothing in the mock consumes the org id.

**Fix:** Have the mock apply the real predicate, e.g. return ids only when
`where.taskType === 'IP_VERIFICATION'` and `where.workflowRunId`/
`where.organizationId` match, and seed a non-IP open task that must be ignored.
That makes the "blockedTaskKind" assertion load-bearing.

### WR-04: Reminder-scan mock approximates the real `where` loosely (DONE/SATISFIED rows leak; `expiresAt`/TZ predicates only null-checked)

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:66-77`
**Issue:** The real scan query (`compliance-reminder-scan.ts:212-230`) uses
`status: { in: ['PENDING','EXPIRED'] }`, `expiresAt: { not: null }`,
`expiryJurisdictionTz: { not: null }`. The regionClient mock handles `statusIn`
correctly but reduces the `expiresAt`/`expiryJurisdictionTz` predicates to mere
null-presence checks (73-74: `if (where.expiresAt && r.expiresAt == null) return false`).
That is acceptable for the `{ not: null }` shape used today, but it silently
diverges if the service query ever tightens (e.g., a date range). More importantly,
because the scan only ever seeds one PENDING free-zone row here, the
`status: { in: [...] }` exclusion of MISSING/WAIVED/SATISFIED rows — a real
correctness property of the scan — is never exercised. The test cannot catch a
regression where the scan starts sweeping non-PENDING rows.

**Fix:** Seed at least one WAIVED/SATISFIED free-zone row alongside the PENDING
one and assert it is left untouched (`reEvaluateFreeZoneStatus` no-ops, status
unchanged). This pins the status-filter contract the comment on
`compliance-reminder-scan.ts:215` documents.

### WR-05: The audit assertion does not pin org scope — `contractorReasons` match is satisfied by the fixture constant, not by correct querying

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:328-357`
**Issue:** The would-block audit row is asserted to carry
`metadata.contractorReasons` containing `{ contractorId: CONTRACTOR_ID }`. Because
`CONTRACTOR_ID` is the same constant the fixture is seeded with (37, 154-159),
and the `prisma` mock ignores the contractor/org filter (see WR-02), this passes
even if the gate selected the wrong rows. The assertion also uses
`expect.objectContaining` / `arrayContaining` at every level, so it tolerates
extra (e.g., leaked cross-org) reasons silently — it only checks that the
expected one is *present*, not that it is the *only* one. For an audit-trail
correctness test this is too permissive: an over-broad gate that audited
additional orgs' contractors would still be green.

**Fix:** After applying the WR-02 mock fix, seed a second org's EXPIRED BLOCKING
row and assert `metadata.contractorReasons` has exactly length 1 and contains only
`CONTRACTOR_ID`. Use `toHaveLength(1)` plus an exact-shape check rather than
`arrayContaining` alone.

### WR-06: `flipExpiredFreeZoneItems` swallows per-item errors; the test never asserts the flip vs. a silent skip

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:197-205, 328-333`
**Issue:** `flipExpiredFreeZoneItems` (`compliance-reminder-scan.ts:270-300`) wraps
each `reEvaluateFreeZoneStatus` call in a try/catch that logs and continues. The
mock logger (123-126) discards `error`. The test asserts only the post-condition
(`after?.status === 'EXPIRED'`). If the regional `update` mock threw (or
`getRegionalClient` returned the wrong client and the ME branch returned `[]`),
the item would silently stay PENDING and the test would fail with a confusing
"expected EXPIRED, got PENDING" rather than surfacing the underlying error. More
subtly, because `runComplianceReminderScanForClient` also catches at the region
level (251-257) and returns zero counts, a thrown error inside the scan is fully
absorbed — the test cannot distinguish "scan ran and flipped" from "scan errored
and a prior state happened to match." There is no assertion on the
`ScanResult`/`update`-spy to confirm the flip path actually executed.

**Fix:** Assert the flip happened *through the scan*, not just that the end state
matches: e.g. capture the regionClient via `clientCache.get('ME')` and assert its
`contractorComplianceItem.update` spy was called once with
`{ where: { id: item.id }, data: { status: 'EXPIRED' } }`. That distinguishes a
real flip from an absorbed error.

## Info

### IN-01: F1 describe block duplicates `free-zone-record-then-expire.test.ts` near-verbatim

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:39-241`
**Issue:** The `ItemRow` interface, the `vi.hoisted` store, `regionClientFactory`,
the `@contractor-ops/db` mock, the logger/metrics/notification/rbac/dedup/i18n
mocks, `recordValidFreeZoneItem`, and the first three F1 `it`s are essentially
identical to `packages/api/src/__tests__/free-zone-record-then-expire.test.ts:24-200`.
The only material additions are the inline `cause` field assertions at 226-235.
This is copy-paste duplication of an existing regression test rather than new
composition coverage; it raises maintenance cost (two copies of the same mock
harness drift independently).

**Fix:** Extract the shared mock harness + `recordValidFreeZoneItem` into a small
test helper under `__tests__/__fixtures__/` and import it in both files, or have
the new file genuinely compose (WR-01) instead of restating the existing path.

### IN-02: F4 describe block duplicates `workflow-execution-ip-block.test.ts`

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:278-325`
**Issue:** `makeGateClient` and the IP-block / override assertions reproduce
`packages/api/src/routers/__tests__/workflow-execution-ip-block.test.ts:6-63`
almost line-for-line. The added value over the existing test is the
`auditWriteSpy` not-called assertion (315), which is itself weak (the spy can only
be called by mocked modules, none of which `assertRunCompletable` touches — see
IN-03).

**Fix:** Reuse the existing test's helper or limit this block to the genuinely new
assertion (audit-not-called) rather than restating the IP-block coverage.

### IN-03: Locked-phrase describe re-runs the validators package's own guard; `auditWriteSpy.not.toHaveBeenCalled` is near-tautological

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:315, 365, 369-387`
**Issue:** Two minor low-value assertions: (1) The locked-phrase describe
(369-387) re-implements `packages/validators/src/__tests__/locked-phrases-guard.test.ts:612-657`
(same `RESERVED_*` ↔ `LOCKED_*` key-mirror and NITAQAT literal checks), adding no
coverage beyond the validators package's existing guard. (2) The
`expect(auditWriteSpy).not.toHaveBeenCalled()` checks (315, 365) are close to
tautological: `assertRunCompletable` does not import `audit-writer` at all, and
the spy is only wired into `../services/audit-writer`; it can never be invoked on
the F4 path by construction. The assertion documents intent but cannot fail for
the reason stated unless an unrelated import changes.

**Fix:** Drop the duplicated locked-phrase block (or replace with a thin
re-export/import-presence check), and treat the audit-not-called assertion as
documentation only — or strengthen it by asserting the F1 path *does* call the spy
and the F4 path does not within the same composed scenario (ties into WR-01).

---

_Reviewed: 2026-06-05T16:08:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
