# Phase 80: v6.0 Verification + Hardening + Manual UAT - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 4 (1 new integration test + 3 planning/doc markdown)
**Analogs found:** 4 / 4 (all exact or near-exact)

This is a milestone-close VERIFICATION phase. It writes ONE new cross-feature integration test in `packages/api` and THREE planning/doc markdown files in the phase dir. It modifies NO feature source. Every gate primitive the test composes already exists and is independently unit-tested — the new test only *composes* them on one seeded contractor.

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `packages/api/src/__tests__/v6-cross-feature-composition.test.ts` (name at planner's discretion) | test (integration) | request-response + event-driven (cron) | `packages/api/src/__tests__/free-zone-record-then-expire.test.ts` | exact (end-to-end wiring of real services against one shared mutable store) |
| `.../80-HUMAN-UAT.md` | doc (UAT scenarios) | n/a | `.planning/milestones/v6.0-phases/79-*/79-HUMAN-UAT.md` (+ v5.0 `63-HUMAN-UAT.md`) | exact (same frontmatter + Tests + Summary structure) |
| `.../80-LEGAL-SIGNOFF.md` | doc (post-deploy legal catalogue) | n/a | `69-VERIFICATION.md` "Post-Deploy Items" + `signoff-registry-flags.json` `notes` | role-match (no standalone `*-LEGAL*` precedent exists; mirror Post-Deploy Items + per-namespace notes) |
| `.../80-RETROSPECTIVE.md` | doc (milestone-close retro) | n/a | `69-VERIFICATION.md` (final-phase milestone-close shape) | role-match (no standalone `*-RETROSPECTIVE*` precedent; mirror VERIFICATION verdict + post-deploy sections) |

---

## Pattern Assignments

### `packages/api/src/__tests__/v6-cross-feature-composition.test.ts` (test, integration)

**Primary analog:** `packages/api/src/__tests__/free-zone-record-then-expire.test.ts` (the only existing test that wires REAL services end-to-end against one shared mutable store — exactly the D-01/D-02 composition shape). Secondary analogs cited per gate below.

**IMPORTANT seed decision (resolves D-03 "Claude's Discretion"):**
Do **NOT** seed via `packages/db/scripts/seed-dev.ts`. That script is a heavyweight live-DB seeder (`prisma.contractorComplianceItem.createMany`, region host-guards, `--confirm` wipe) with **no** Gulf/free-zone/Saudization section — it cannot build the composed contractor and would require a running Postgres. Every gate analog in this codebase instead uses **plain-object fixtures + a hoisted mock-Prisma store + `vi.mock('@contractor-ops/db', …)`**. Replicate that. The fixtures already exist:
- `packages/api/src/__tests__/__fixtures__/gulf-fixtures.ts` — `makeMeOrg()`, `makeFreeZoneComplianceItem()`, `makeFreeZoneAssignment()` (DB-free factories; F1+F3 free-zone leg).

**Imports + fixtures** (`free-zone-record-then-expire.test.ts:17-22`):
```typescript
import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFreeZoneComplianceItem, makeMeOrg } from './__fixtures__/gulf-fixtures';

const ME_ORG = makeMeOrg();
const CONTRACTOR_ID = 'clmectraaaaaaaaaaaaaaaaaaaa';
```

**Shared-mutable-store + region client pattern** (`free-zone-record-then-expire.test.ts:38-100`) — this is the key composition primitive: one `vi.hoisted` store that BOTH the cron reminder-scan (writes PENDING→EXPIRED) and the payment gate (reads `status='EXPIRED'`) see, so the cross-boundary flip arms the gate in the same run:
```typescript
const { store } = vi.hoisted(() => ({ store: { items: [] as Record<string, unknown>[] } }));

function regionClientFactory(region: string) {
  return {
    contractorComplianceItem: {
      findMany: vi.fn(async (args) => { /* honours where.severity / where.status.in / expiresAt / expiryJurisdictionTz */ }),
      update: vi.fn(async (args) => { const row = store.items.find(r => r.id === args.where.id); if (row) Object.assign(row, args.data); return row; }),
    },
    /* contractorComplianceReminderState, organization … */
  };
}

vi.mock('@contractor-ops/db', () => ({
  prisma: { contractorComplianceItem: { findMany: vi.fn(async (args) => store.items.filter(/* severity + status */)) } },
  prismaRaw: {},
  SUPPORTED_REGIONS: ['EU', 'ME'] as const,
  getRegionalClient: vi.fn((region) => /* cached regionClientFactory(region) */),
}));
vi.mock('@contractor-ops/feature-flags', () => ({ isPaymentBlockEnforced: vi.fn(() => true) }));
vi.mock('../services/audit-writer', () => ({ writeAuditLog: vi.fn(async () => undefined) }));
```

**F1 + F3 leg — payment hard-block (`assertContractorPaymentEligibility`)** (`free-zone-record-then-expire.test.ts:120,180-199`; gate selects `severity='BLOCKING'` AND `status='EXPIRED'`, throws `PRECONDITION_FAILED`):
```typescript
import { assertContractorPaymentEligibility } from '../services/compliance-payment-gate';
import { runComplianceReminderScan } from '../services/compliance-reminder-scan';

// record valid (PENDING) → cron crosses Asia/Dubai boundary → gate blocks
await runComplianceReminderScan(new Date('2026-06-03T09:00:00Z')); // flips PENDING→EXPIRED via reEvaluateFreeZoneStatus
await expect(
  assertContractorPaymentEligibility([CONTRACTOR_ID], { organizationId: ME_ORG.id }),
).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
```
Service signatures verified: `assertContractorPaymentEligibility(contractorIds, { organizationId })` (`compliance-payment-gate.ts:75`); `runComplianceReminderScan(now)` → flips via `reEvaluateFreeZoneStatus` (`compliance-reminder-scan.ts:167,279`). The free-zone gate-row shape (joined contractor) is in `free-zone-payment-block.test.ts:46-57` (`gateRow()` helper); the `PRECONDITION_FAILED` `cause.contractorReasons` deep-link assertion is `free-zone-payment-block.test.ts:82-112` — replicate to assert the F1/F3 reason surfaces.

**F4 leg — offboarding hard-block (IP `LIKELY_MISSING` ratification gate)** — analog `packages/api/src/routers/__tests__/workflow-execution-ip-block.test.ts:1-43`. The primitive is `assertRunCompletable(client, runId, orgId)` from `../workflow/workflow-shared` (`workflow-shared.ts:315`), exercised through a structural in-memory `RunGateClient`:
```typescript
import { assertRunCompletable } from '../routers/workflow/workflow-shared';

// open IP_VERIFICATION task, no override → PRECONDITION_FAILED with cause.blockedTaskKind
const client = makeGateClient({ openIpTaskIds: ['task_ip'] });
await expect(assertRunCompletable(client, 'run_1', ME_ORG.id)).rejects.toMatchObject({
  code: 'PRECONDITION_FAILED',
});
// cause shape: { blockedTaskKind: 'IP_VERIFICATION', openTaskIds: [...] }   (ip-block.test.ts:32-43)
```
The IP item originates from `LIKELY_MISSING` in `packages/api/src/services/contract-health/run-health-check.ts:136,215-216` (materialises a `ContractorComplianceItem` on `LIKELY_MISSING`); the offboarding override/re-assert path is `packages/api/src/routers/workflow/workflow-execution.ts:1157-1260`. For an audit-row-on-override assertion, use `workflow-override-blocking-task.test.ts` (action `workflow.offboarding.override_blocking_task`).

**F3 advisory — Saudization band-trajectory render (non-gating)** — analog `packages/api/src/__tests__/saudization-derivation.test.ts:147-198`. Pure function `projectOffboardingTrajectory({ headcount, currentBand, offboardingContractorIsSaudi })` from `../services/saudization-dashboard` — assert it returns `advisory:true, authoritative:false`, recomputes `projectedRate`, and **never** asserts a band (the locked anti-feature):
```typescript
import { projectOffboardingTrajectory } from '../services/saudization-dashboard';
const traj = projectOffboardingTrajectory({ headcount: { totalHeadcount: 100, saudiHeadcount: 50 }, currentBand: 'MID_GREEN', offboardingContractorIsSaudi: true });
expect(traj.advisory).toBe(true);
expect(traj.authoritative).toBe(false);
expect(traj).not.toHaveProperty('projectedBand');
```

**writeAuditLog assertion pattern** (D-02 "every expected audit row") — analog `packages/api/src/__tests__/gulf-override-audit.test.ts:21,50,92,209-261`. Spy the writer via `vi.mock('../services/audit-writer', () => ({ writeAuditLog: auditWriteSpy }))` and assert with `expect.objectContaining`:
```typescript
const { auditWriteSpy } = vi.hoisted(() => ({ auditWriteSpy: vi.fn(async () => undefined) }));
vi.mock('../services/audit-writer', () => ({ writeAuditLog: auditWriteSpy }));
expect(auditWriteSpy).toHaveBeenCalledWith(
  expect.objectContaining({ action: 'gulf.nitaqat_threshold.override', organizationId: ME_ORG.id, metadata: expect.objectContaining({ custom: true }) }),
);
// transaction-threaded variant: auditWriteSpy.mock.calls.at(-1)?.[0]?.tx is defined (gulf-override-audit.test.ts:251-260)
```

**Locked-phrase guard (green) assertion** (D-02 "green locked-phrase guard"; resolves the discretion "reuse existing guard vs inline check") — the canonical guard is `packages/validators/src/__tests__/locked-phrases-guard.test.ts`, which imports `LOCKED_AE_PHRASES`/`RESERVED_AE_LEGAL_KEYS` from `../legal/ae.js` and `LOCKED_SA_PHRASES`/`RESERVED_SA_LEGAL_KEYS` from `../legal/sa.js` (`locked-phrases-guard.test.ts:17,44`). For the composed test, **reuse** that invariant rather than re-implementing: import the locked-phrase constants from `@contractor-ops/validators` and assert the Gulf advisory/statutory copy the F3 surfaces render matches verbatim (UAE free-zone + KSA Nitaqat/Qiwa phrases). The cross-package dynamic-import-parity technique (when a static import would cross a `rootDir` boundary) is in `packages/einvoice/src/profiles/xrechnung-de/__tests__/locked-phrase-parity.test.ts:33-61` — only needed if the package boundary blocks a static import.

**tRPC caller harness (if the test drives a procedure instead of a service directly)** — analog `compliance-item-audit-trail.test.ts:144-188` / `deprovisioning-eligibility.test.ts:98-147`: `createCallerFactory(appRouter)` + a full `makeCaller()` session object + the standard `@contractor-ops/db` / `@contractor-ops/auth` / `@contractor-ops/logger` / `@sentry/node` / `@contractor-ops/feature-flags` mock block. For Gulf flag-gated procedures, the `lazyFlagBag` enable pattern is `gulf-override-audit.test.ts:74-83` (`'gulf.saudization-dashboard': true`, `'gulf.free-zone-tracking': true`). Prefer the **direct-service** wiring (record-then-expire style) for the gate composition and reserve the caller harness only if a leg must go through a procedure.

---

### `.planning/phases/80-.../80-HUMAN-UAT.md` (doc)

**Analog:** `.planning/milestones/v6.0-phases/79-*/79-HUMAN-UAT.md` (most recent, v6.0 Gulf — closest) and `.planning/milestones/v5.0-phases/63-*/63-HUMAN-UAT.md` (richer multi-step example).

**Frontmatter + section skeleton** (`79-HUMAN-UAT.md:1-37`):
```markdown
---
status: partial
phase: 80-v6-0-verification-hardening-manual-uat
source: [80-VERIFICATION.md]
started: 2026-06-03
updated: 2026-06-03
---

## Current Test
[awaiting human testing — requires running the app with v6.0 feature flags enabled]

## Tests

### 1. <scenario title>
expected: <repro steps + expected behaviour>
why_human: <why grep cannot verify — visual render, dialog flow, RTL, role gating, PDF/byte inspection>
result: [pending]

## Summary
total: N
passed: 0
issues: 0
pending: N
skipped: 0
blocked: 0

## Gaps
```
Per-test `expected:` / `why_human:` / `result:` is the canonical body (`63-HUMAN-UAT.md:15-49`). Cover F1/F2/F3/F4 scenarios; **F2 IdP MUST appear here** (it is deliberately excluded from the integration test per D-01). Dedup against already-captured per-phase UAT (`79-HUMAN-UAT.md` scenarios 1-3 already cover Arabic RTL + de/pl genuineness + Arabic statutory sign-off — re-list or cross-reference, per discretion).

---

### `.planning/phases/80-.../80-LEGAL-SIGNOFF.md` (doc)

**Analog:** No standalone `*-LEGAL*` doc exists in v5.0/v6.0. Two layout sources to mirror:
1. **Per-item post-deploy disposition** — `69-VERIFICATION.md:59-66` "Post-Deploy Items (Non-Blocking)" — numbered list, each item = `**<adviser> review of <copy/artifact>**` + what to verify + which queue it joins. This is the canonical "catalogued, not blocking" framing (Standing Constraint: legal review DEFERRED post-deploy, never hard-blocks).
2. **Per-adviser content + namespace mapping** — `packages/feature-flags/src/signoff-registry-flags.json` `notes` fields are already written per-namespace with the exact legal text to verify. Each PENDING entry names its adviser and what needs sign-off. Use these verbatim as the source rows.

**One section per adviser (D-05):** DE Steuerberater (`compliance-policy-engine.de.*`: §48b EStG / A1 / Aufenthaltstitel + Werkvertrag IP wording from `offboarding-ip-foundation` notes), UK tax/legal (`compliance-policy-engine.uk.*`: right_to_work / utr / sds — IR35/ITEPA), UAE legal (`gulf.free-zone-tracking` + `compliance-policy-engine.uae.*`: free-zone permitted-activity catalogues + NOC wording + `LOCKED_AE_PHRASES`), KSA MOL/HRSD + legal (`gulf.saudization-dashboard` + `compliance-policy-engine.ksa.*`: Nitaqat band labels / Qiwa-auth / Iqama + `LOCKED_SA_PHRASES`). The `79-HUMAN-UAT.md:23-24` note explicitly routes "Arabic statutory copy legal sign-off" to "the v6.0 consolidated legal sign-off list (Phase 80)" — that item belongs here.

Cross-link or restate the "Needs verification by legal entity" annotations is at planner's discretion (per CONTEXT discretion bullet); the signoff-registry `notes` are the single source either way.

---

### `.planning/phases/80-.../80-RETROSPECTIVE.md` (doc)

**Analog:** `69-VERIFICATION.md` (the v5.0 *final-phase* milestone-close artifact — there is no separate `69-RETROSPECTIVE.md`; the milestone-close content lives in the final phase's VERIFICATION verdict). Mirror its sections: Goal Recap, a results table, Cross-Phase Regression Check, Schema Drift, **Post-Deploy Items**, and a **Verdict** that explicitly notes milestone completion under the LOCAL-ONLY / DEFERRED Standing Constraint (`69-VERIFICATION.md:67-69`).

**Three retrospective-specific sections (D-05 + SC#4):**
1. **Dependency play-out + security scan** (D-04 hardening) — record results of the milestone-wide gate re-run: `lint:audit-log`, `lint:raw-sql`, `lint:logs`, `lint:silent-catch`, `lint:schema`, `i18n:parity`, `db:audit-enum-casing`, `check:web-vite-{data-layer,page-shells,presentational,table-pattern,dialog-pattern}`, plus `pnpm audit` + `pnpm security:scan`. Use the per-gate PASS/evidence table format of `69-VERIFICATION.md:43-47` (Cross-Phase Regression Check).
2. **PENDING Unleash flags by namespace + ticket pointers** — the inventory source is `packages/feature-flags/src/signoff-registry-flags.json` (24 PENDING entries: `idp-deprovisioning*`, `compliance-payment-block`, `compliance-policy-engine.*`, `compliance-portal-self-service`, `offboarding-ip-foundation`, `gulf.free-zone-tracking`, `gulf.saudization-dashboard`). The `notes` field on each is the post-deploy approval pointer. The validators-side disclaimer registry has a parallel `getAllPending()` helper (`packages/validators/src/legal/signoff-registry.ts:40`) returning PENDING keys — usable to programmatically enumerate. Group by namespace prefix (matches `isGatedFlag` namespace gating in `packages/feature-flags/src/registry.ts`).
3. **Velocity vs v5.0** — plans/day metric (computation at planner's discretion). v5.0 ran 14 phases (56-69, `.planning/milestones/v5.0-phases/`); v6.0 ran phases 70-80 (`.planning/milestones/v6.0-phases/`). Count `*-PLAN.md` / `*-SUMMARY.md` per phase dir as the plan-completion denominator.

---

## Shared Patterns

### Mock block (every `packages/api` test that touches DB + auth + logger)
**Source:** `compliance-item-audit-trail.test.ts:47-142`, `deprovisioning-eligibility.test.ts:46-96`, `gulf-override-audit.test.ts:53-148`
**Apply to:** the integration test
The standard, copy-forward `vi.mock` block: `@contractor-ops/db` (full surface incl. `withRlsTransactions/withRlsReads/tenantStore/getRegionalClient`), `@contractor-ops/auth` (`authApi.hasPermission → {success:true}`), `@contractor-ops/logger` (all factories → noop), `@contractor-ops/logger/metrics`, `@sentry/node`, `@contractor-ops/feature-flags`. The lighter record-then-expire variant (`free-zone-record-then-expire.test.ts:101-118`) is sufficient when driving services directly (no caller).

### Enum casing (D-17 / db:audit-enum-casing)
**Source:** `__fixtures__/gulf-fixtures.ts:9-16`
**Apply to:** all fixture string values in the test
UPPER_SNAKE_CASE: `dataRegion 'ME'`, `severity 'BLOCKING'`, `status 'EXPIRED'`, `documentType 'UAE_FREE_ZONE_LICENSE'`, `policyRuleId 'uae.free_zone_license@v2'`, `expiryJurisdictionTz 'Asia/Dubai'`.

### LOCAL-ONLY post-deploy disposition
**Source:** `69-VERIFICATION.md:59-69`, `signoff-registry-flags.json` notes
**Apply to:** both `80-LEGAL-SIGNOFF.md` and `80-RETROSPECTIVE.md`
Legal/UAT items are recorded as **non-blocking post-deploy** tasks; they NEVER hard-block phase or milestone closure (Standing Constraint). Verdict language must state milestone-complete-pending-post-deploy.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All four deliverables have at least a role-match analog. `80-LEGAL-SIGNOFF.md` and `80-RETROSPECTIVE.md` have no standalone single-file precedent, but their structure is fully covered by `69-VERIFICATION.md` (Post-Deploy Items + Verdict) plus the `signoff-registry-flags.json` per-namespace `notes`. |

---

## Metadata

**Analog search scope:** `packages/api/src/__tests__/`, `packages/api/src/services/__tests__/`, `packages/api/src/routers/__tests__/`, `packages/api/src/routers/workflow/`, `packages/api/src/services/`, `packages/api/src/__tests__/__fixtures__/`, `packages/validators/src/legal/` + `__tests__/`, `packages/feature-flags/src/`, `packages/db/scripts/`, `.planning/milestones/v5.0-phases/`, `.planning/milestones/v6.0-phases/`
**Files scanned:** ~30 test files + 4 doc precedents + 3 source services + signoff registry
**Pattern extraction date:** 2026-06-03
