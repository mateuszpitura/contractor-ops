---
phase: 80-v6-0-verification-hardening-manual-uat
reviewed: 2026-06-06T02:50:00Z
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

**Reviewed:** 2026-06-06T02:50:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Sole phase-80 source change: `packages/api/src/__tests__/v6-cross-feature-composition.test.ts` — the milestone's SC#1 cross-feature composition proof (F1 payment hard-block + F3 Saudization advisory + F4 IP_VERIFICATION offboarding block + audit + locked-phrase guard).

Every assertion was traced against the real sources it exercises: `compliance-payment-gate.ts`, `compliance-reminder-scan.ts`, `free-zone-compliance.ts`, `saudization-dashboard.ts`, `workflow-shared.ts`, the gulf fixtures, `legal/ae.ts` / `legal/sa.ts`, and the `compliance-policy` expiry helpers (`expiry.ts`). The suite was run: **16/16 pass in ~1.1s**.

The **F1 leg is genuinely load-bearing**: `runComplianceReminderScan` and `assertContractorPaymentEligibility` run end-to-end against a shared mutable store, the TZ-boundary flip (`2026-06-03` crossing the `2026-03-01` Asia/Dubai expiry) actually drives PENDING→EXPIRED via the real `isExpired`/`startOfDay`, and the prisma mock mirrors the gate's `contractorId.in` + `contractor.is.organizationId` scope, so the second-tenant isolation assertion (`contractorReasons` length 1) is real, not decorative.

The **F4 leg is materially weaker than the comments claim**: `makeGateClient` honours only `taskType` and `workflowRunId`, while the real gate (`workflow-shared.ts:332-340`) also filters on `status: { in: [...] }` and `organizationId`. The composed test threads `organizationId` into `assertRunCompletable` but the mock ignores it, so F4 tenant isolation and the open-task status predicate are unproven. One advisory assertion (`not.toHaveProperty('projectedBand')`) is a type-level tautology that can never fail. Several comparison assertions use `?? 0` / `?? 1` fallbacks that convert a null regression into a silently-passing arithmetic comparison. Several comments embed source line-number breadcrumbs and review-finding IDs that violate the project's no-inline-breadcrumb convention and already mis-cite.

No BLOCKERs (test-only file): no incorrect production behavior, no security exposure (all I/O mocked, no secrets, no dynamic eval), no `console.*`, no empty catches.

## Structural Findings (fallow)

None provided for this review (no `<structural_findings>` block supplied).

## Narrative Findings (AI reviewer)

All findings below are from direct read of the test plus its real-service contracts and collaborators (`gulf-fixtures`, `legal/ae.ts`, `legal/sa.ts`, `expiry.ts`, `free-zone-compliance.ts`). The highest-value items are **WR-01** (F4 mock omits the real `status` + `organizationId` predicates, so the composed F4 tenant-isolation claim is unproven and could pass while production diverges) and **WR-02** (the `projectedBand` guard is a tautology that can never fail). The F1 path holds up: real services, a real TZ-boundary flip, a load-bearing gate `where` filter proven by the second-tenant isolation assertion — no tautologies or always-pass mocks found there.

## Warnings

### WR-01: F4 gate mock ignores `status` and `organizationId` — the load-bearing claim is false for two of four predicates

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:537-561` (mock), `401-443` + `303-318` (assertions)
**Issue:** The real `assertRunCompletable` query filters on four fields (`workflow-shared.ts:332-340`):
```
where: { workflowRunId, organizationId, taskType: 'IP_VERIFICATION',
         status: { in: ['TODO','IN_PROGRESS','BLOCKED'] } }
```
`makeGateClient.workflowTaskRun.findMany` (lines 548-552) inspects only `args.where?.taskType` and `args.where?.workflowRunId`; it returns the open task regardless of `status` or `organizationId`. Consequences:
- The WR-03 predicate test (lines 401-443) titles itself "honour their where predicates" but proves only 2 of the 4 real predicates. A `DONE`/`CANCELLED` IP_VERIFICATION task, or a cross-org task, would be excluded by the real query yet returned by this mock — a regression that loosened the real `status`/`organizationId` filter would not be caught.
- In the composed `it` (line 310) `SEEDED.organizationId` is threaded into `assertRunCompletable`, and the inline comment (lines 303-304) asserts "the taskType/workflowRunId filter is load-bearing" — but the org argument is inert. F4 tenant isolation is implied by the scenario narrative yet never exercised, unlike the genuinely load-bearing F1 org filter.

This is a false-confidence / mock-divergence defect: the test can pass while the F4 production gate behaves differently on status and tenant scope.
**Fix:** Make the mock honour all four predicates and add controls proving each is load-bearing:
```ts
findMany: async (args: {
  where?: { taskType?: string; workflowRunId?: string;
            organizationId?: string; status?: { in?: string[] } };
}) => {
  if (args.where?.taskType !== 'IP_VERIFICATION') return [];
  if (opts.workflowRunId && args.where?.workflowRunId !== opts.workflowRunId) return [];
  if (opts.organizationId && args.where?.organizationId !== opts.organizationId) return [];
  const wantStatus = args.where?.status?.in;
  if (wantStatus && !wantStatus.includes(opts.openTaskStatus ?? 'TODO')) return [];
  return (opts.openIpTaskIds ?? []).map(id => ({ id }));
},
```
Then add WR-03 cases proving a wrong-org query and a closed-status task both return `[]`, and assert in the composed `it` that calling with `OTHER_ORG_ID` does NOT block.

### WR-02: `expect(traj).not.toHaveProperty('projectedBand')` is a type-level tautology that can never fail

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:301`, `517`, `529`
**Issue:** `projectOffboardingTrajectory` returns the fixed-shape `OffboardingTrajectoryResult` (`saudization-dashboard.ts:172-218`) — a 5-field object literal (`currentRate`, `projectedRate`, `currentBand`, `advisory`, `authoritative`) with no `projectedBand` key and no code path that ever attaches one. The assertion is guaranteed to pass regardless of any behaviour change short of someone widening the return type, so it provides zero protection for the "locked anti-feature" (Pitfall 8 / D-12) it claims to guard. The companion `advisory:true` / `authoritative:false` / `projectedRate < currentRate` assertions ARE meaningful; only the `projectedBand` guard is hollow.
**Fix:** Assert the exhaustive key set so adding ANY new key (including an accidental `projectedBand`) trips the test:
```ts
expect(Object.keys(traj).sort()).toEqual(
  ['advisory', 'authoritative', 'currentBand', 'currentRate', 'projectedRate'].sort(),
);
```

### WR-03: Hardcoded source line-number breadcrumbs in comments will silently rot and already mis-cite

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:110`, `288`, `338`, `545`
**Issue:** Comments pin behaviour to exact source line ranges: `compliance-payment-gate.ts:86-99` (line 110), `:114-120` (line 288), `:106-120` (line 338), `workflow-shared.ts:332-340` (line 545). These decay the moment the referenced files change. They are also already imprecise — the gate `where` block body begins at `compliance-payment-gate.ts:87` (the `findMany` call) / `88` (the `where` literal), not 86; and the would-block path's actual `writeAuditLog` call lives in `recordWouldBlock` (`compliance-payment-gate.ts:176-183`), reached via the call at lines 106-112, not "106-120". A reader trusting the comment is pointed at the wrong span.
**Fix:** Reference the symbol, not the line number — e.g. "mirrors the `contractorId` / `contractor.is.organizationId` scope in `assertContractorPaymentEligibility`'s findMany `where`" and "the enforced branch throws without writing audit; only the flag-OFF `recordWouldBlock` path emits a row." Symbols survive refactors; line numbers do not.

### WR-04: Review-finding IDs and decision breadcrumbs embedded in source comments violate the no-inline-breadcrumb convention

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:39`, `111`, `196-197`, `283`, `304`, `339`, `547` (`WR-02`/`WR-03`); `30`, `242`, `533-536` (`D-01`, `Phase-74`)
**Issue:** Project convention (CLAUDE.md + MEMORY: "No legacy / restoration / GAP-ID refs in source comments" — the codebase should read self-contained; migration and review breadcrumbs belong in commit messages + `.planning/`, not inline). The test threads review-finding IDs `(WR-02)` / `(WR-03)` and decision IDs `(D-01)`, `Phase-74` directly into source comments. A future reader has no `WR-02` registry to resolve. The intent (explaining WHY the second tenant exists) is good; the encoding (an opaque finding ID) is the violation.
**Fix:** Keep the rationale, drop the IDs:
```ts
// A second synthetic tenant so the payment-gate where filters
// (contractorId.in + contractor.is.organizationId) are load-bearing, not decorative.
```
The `WR-02`/`WR-03`/`D-01` traceability already lives in the 80-05 commit body and SUMMARY, which is the correct home.

### WR-05: Regional reminder mock diverges from the real `select` / tenant scope — the second-tenant EXPIRED row is silently re-scanned

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:67-97` (mock), `253-265` (composed step 1)
**Issue:** The real scan query (`compliance-reminder-scan.ts:212-230`) uses a `select` projection and `status: { in: ['PENDING','EXPIRED'] }`; `processItem` then reads `item.contractor.displayName` after a fire. The `regionClientFactory.findMany` mock returns full row objects (not a projection) and honours `statusIn`, so the happy path works. But because the mock does NOT scope by `organizationId`, the composed step-1 scan also returns the OTHER-tenant EXPIRED row (seeded at lines 254-260) and runs the full band/fire/dispatch pipeline against it. That row's `contractor.displayName` is populated by `recordFreeZoneItemFor` (line 224), so it does not crash today — but the test incidentally exercises a cross-tenant fan-out it never asserts on, and a future change to `recordFreeZoneItemFor` that omits `contractor` would make the SCAN (not the gate) throw, producing a confusing failure unrelated to the assertion under test. The mock's divergence from the real `select` also masks whether the scan tolerates a projection-shaped row.
**Fix:** Scope the regional mock by `organizationId`/region the way the gate mock now scopes (so the scan only sees the seeded tenant's rows), OR make the OTHER row PENDING-with-future-expiry so it is irrelevant to the scan; add a one-line comment that the regional mock intentionally returns full rows rather than the `select` projection.

### WR-06: `?? 0` / `?? 1` fallbacks in comparison assertions can convert a null regression into a silent pass

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:300`, `515`
**Issue:** Both rate-comparison assertions use null-coalescing on the values under test:
```ts
expect(traj.projectedRate ?? 1).toBeLessThan(traj.currentRate ?? 0);
```
`projectOffboardingTrajectory` returns `projectedRate: number | null` and `currentRate: number | null` (`saudization-dashboard.ts:172-182`). Placing `?? 1` / `?? 0` on the value under test means a regression in which the source returns `null` is coerced into an arithmetic comparison whose pass/fail depends on the chosen sentinel rather than on a real defect — exactly the kind of silent masking adversarial review exists to catch. A null regression should fail loudly with a clear message, not be arithmetically absorbed. The dedicated F3 test at `:513-514` already pins exact values (`toBeCloseTo(0.5)` / `toBeCloseTo(49/99)`), so the coalescing comparison adds no coverage — only fragility.
**Fix:** Assert non-nullness explicitly before comparing:
```ts
expect(traj.projectedRate).not.toBeNull();
expect(traj.currentRate).not.toBeNull();
expect(traj.projectedRate as number).toBeLessThan(traj.currentRate as number);
```

## Info

### IN-01: F4-no-audit assertion is triplicated across three describes

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:289`, `582`, `632`
**Issue:** `expect(auditWriteSpy).not.toHaveBeenCalled()` after the F4 hard-block path appears three times (composed `it`, the F4 describe, the audit describe), and the would_block audit-row capture is asserted twice (lines 347-356 and 613-623). Not harmful, but the composed `it` was meant to subsume the per-feature checks; the duplication dilutes the "one composed proof" intent. Additionally, the composed-`it` form at `:289` measures cumulative spy call state, not the F4 leg in isolation — if a future edit inserts an audit-writing step earlier in the same `it` (e.g. switching step 2 to a flag-OFF would-block, which DOES write), this assertion would flip to a failure that looks like an F4 regression but isn't.
**Fix:** Optional — if the composed `it` is the canonical SC#1 proof, trim the standalone F4-no-audit and would_block audit `it`s to the unique edge each adds (override-clears, flag-OFF return shape). For the composed `it`, `mockClear()` immediately before the F4 call so the no-write assertion is scoped to that leg.

### IN-02: `reasons[0]?.itemId` hardcodes the fixture default id

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:398`
**Issue:** The assertion pins `itemId` to the literal `'clmefzitemaaaaaaaaaaaaaaaaa'`, the default id baked into `makeFreeZoneComplianceItem` (`gulf-fixtures.ts:99`). If that fixture default changes, the test breaks for an unrelated reason and the literal gives no hint of its origin.
**Fix:** Capture the seeded row's id and assert against it (the test already does this elsewhere, e.g. line 494): `const item = recordValidFreeZoneItem(...); ... expect(...itemId).toBe(item.id);`

### IN-03: Synthetic item-id literals are hand-typed per call with copy-paste collision risk

**File:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts:256`, `328`, `365`, `385`
**Issue:** Each `recordFreeZoneItemFor` call invents a fresh CUID-shaped literal inline. They are distinct per test today, but a duplicated suffix across two seeds in the same `describe` would create two store rows with the same id, and the store's `find(r => r.id === ...)` update would mutate only the first — a silent foot-gun. (Note: `recordValidFreeZoneItem` always uses the fixture default id `...aaa`; if it were ever paired in one test with a `recordFreeZoneItemFor({ id: '...aaa' })` the same collision would occur.)
**Fix:** Optional — add a `nextOtherItemId()` helper / counter so ids are generated, not hand-typed.

---

_Reviewed: 2026-06-06T02:50:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
