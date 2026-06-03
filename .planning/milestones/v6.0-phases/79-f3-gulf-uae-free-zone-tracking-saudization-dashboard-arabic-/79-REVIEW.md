---
phase: 79-f3-gulf-uae-free-zone-tracking-saudization-dashboard-arabic
reviewed: 2026-06-03T10:56:33Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - packages/db/prisma/schema/gulf.prisma
  - packages/db/prisma/schema/contractor.prisma
  - packages/db/prisma/schema/contract.prisma
  - packages/db/prisma/schema/organization.prisma
  - packages/validators/src/legal/ae.ts
  - packages/validators/src/legal/sa.ts
  - packages/validators/src/legal/compliance-uae.ts
  - packages/validators/src/contract.ts
  - packages/compliance-policy/src/policies/uae.ts
  - packages/api/src/services/free-zone-compliance.ts
  - packages/api/src/services/compliance-reminder-scan.ts
  - packages/api/src/services/permitted-activity-check.ts
  - packages/api/src/services/saudization-dashboard.ts
  - packages/api/src/services/compliance-supersession.ts
  - packages/api/src/routers/gulf/free-zone.ts
  - packages/api/src/routers/gulf/saudization.ts
  - packages/api/src/routers/gulf/index.ts
  - packages/api/src/routers/core/contract.ts
  - packages/api/src/routers/core/contractor.ts
  - packages/db/scripts/lint-region-leakage.ts
  - packages/db/scripts/backfill-free-zone-assignment.ts
  - packages/db/scripts/check-rtl-logical-props.mjs
  - apps/web-vite/src/components/saudization/saudization-config-dialog.tsx
  - apps/web-vite/src/components/contractors/country-compliance-section.tsx
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 79: Code Review Report

**Reviewed:** 2026-06-03T10:56:33Z
**Depth:** deep
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed the phase-79 (F3 Gulf) source set: the new Gulf Prisma models + additive
columns, the locked-phrase registries (ae/sa), the `uae.free_zone_license@v2`
BLOCKING rotation, the four deterministic services (free-zone-compliance,
permitted-activity-check, saudization-dashboard, compliance-reminder-scan region
fan-out), the supersession isolation change, the `gulf` tRPC namespace + contract
wiring, the two db lint/backfill scripts, and the web-vite free-zone / saudization
surfaces. Tenant scoping, Zod inputs, audit logging, region-awareness, RTL logical
props, and loading/empty/error states are largely well-implemented and match the
plan intent.

One genuine correctness gap is a BLOCKER: the headline GULF-02 payment hard-block
never arms for a free-zone license that expires *after* it was recorded, because
the only PENDING→EXPIRED transition function is dead code (never wired into the
reminder fan-out it claims to be consumed by). Five warnings cover a per-engagement
data-loss bug on partial updates, the legal-sensitive Gulf API not being flag-gated
despite the "ship dark" flags created this phase, NOC items being silently waived
by unrelated classification recomputes, a backfill that aborts the whole transaction
on one unparseable date, and a config dialog that can silently clear a recorded band.

The concurrent "demo read-only mode" workstream (uncommitted changes to middleware,
peppol/zatca/ksef, dashboard-shell, errors.ts, message JSONs) was excluded from
scope and not reviewed.

## Critical Issues

### CR-01: Free-zone payment hard-block never arms for licenses that expire after they were recorded — the only PENDING→EXPIRED transition is dead code

**File:** `packages/api/src/services/free-zone-compliance.ts:199-221` (and `compliance-reminder-scan.ts` fan-out)
**Issue:**
The payment gate hard-blocks strictly on the `ContractorComplianceItem` row having
`severity='BLOCKING' AND status='EXPIRED'` (`compliance-payment-gate.ts:89-90`).
The free-zone item's status is derived only at *write time* inside
`writeFreeZoneComplianceItem` via `deriveStatus(...)` (line 117). The header comment
states "There is NO background sweep flipping PENDING→EXPIRED ... status is computed
here at write time" and points to `reEvaluateFreeZoneStatus` as the transition
mechanism "Consumed by the region-aware reminder fan-out" (lines 84-90, 191-196).

`reEvaluateFreeZoneStatus` is **never called** anywhere in production source — only
in its own module and tests (`git grep` outside the module/tests returns nothing).
The reminder fan-out (`runComplianceReminderScanForClient` → `processItem`) computes
a reminder *band* and fires digest notifications, but it never updates the item's
`status` column. Consequently, the realistic case — an admin records a free-zone
assignment while the license is still valid (`status='PENDING'`), and the license
later crosses its Asia/Dubai expiry boundary — leaves the row at `status='PENDING'`
forever. The BLOCKING payment gate (the GULF-02 / C2 / C4 headline behavior) never
engages for that contractor.

The tests only assert the gate when the item is *written already-expired*; they do
not cover the record-then-expire path, so the gap is green in CI.

**Fix:** Wire `reEvaluateFreeZoneStatus` into the per-region reminder fan-out so
free-zone PENDING items flip to EXPIRED at the TZ boundary during the scan (the
function is already idempotent and tx-safe). In `processItem` (or a dedicated pass
in `runComplianceReminderScanForClient`), for free-zone items detect the boundary
crossing and persist the status flip before/alongside the reminder band:

```ts
// inside the per-region scan, for items with policyRuleId starting 'uae.free_zone'
const flipped = await reEvaluateFreeZoneStatus(
  client,
  { id: item.id, status: /* current */ 'PENDING', expiresAt: item.expiresAt, expiryJurisdictionTz: item.expiryJurisdictionTz },
  now,
);
// flipped === 'EXPIRED' now arms the payment gate
```

Add a regression test for the record-PENDING → cross-boundary → gate-blocks path.

## Warnings

### WR-01: `setSaudiAssignmentFields` wipes unrelated per-engagement fields on any partial update (data loss)

**File:** `packages/api/src/routers/gulf/free-zone.ts:175-201`
**Issue:**
`isSaudi`, `nationality`, and `qiwaContractAuthenticated` are three independent
nullable columns on `ContractorAssignment` (schema commit `3117ab7d`). The Zod input
marks all three `.nullish()` (optional), but the `update` writes all three
unconditionally with `input.X ?? null`. A client sending only
`{ assignmentId, qiwaContractAuthenticated: true }` will null out the previously
recorded `isSaudi` and `nationality`. There is no partial-update / "only update
provided fields" semantics. These fields feed the Saudization dashboard derivation,
so silent loss directly corrupts the rate cross-check and Qiwa gap count.
**Fix:** Build the `data` object conditionally so only keys present in the input are
written (treat `undefined` as "leave unchanged", `null` as "explicit clear"):

```ts
const data: Prisma.ContractorAssignmentUpdateInput = {};
if (input.isSaudi !== undefined) data.isSaudi = input.isSaudi;
if (input.nationality !== undefined) data.nationality = input.nationality;
if (input.qiwaContractAuthenticated !== undefined)
  data.qiwaContractAuthenticated = input.qiwaContractAuthenticated;
```

### WR-02: Legal-sensitive Gulf tRPC namespace is not feature-flag-gated despite the "ship dark" flags created this phase

**File:** `packages/api/src/routers/gulf/free-zone.ts:65-220`, `packages/api/src/routers/gulf/saudization.ts:55-312`, `packages/api/src/root.ts:211`
**Issue:**
Phase 79 created `gulf.free-zone-tracking` and `gulf.saudization-dashboard` flags,
explicitly documented as "ship dark (default false) ... legal-sensitive ... requires
signoff PENDING→APPROVED before enabling per-org" (`flags-core.ts`). The repo has an
established `tenantFlaggedProcedure` + `requireFeatureFlag(key)` mechanism that throws
`NOT_FOUND` so a disabled feature does not leak its existence
(`packages/api/src/middleware/feature-flag.ts:60-105`), used by e.g. skonto. The
`gulf` router is mounted unconditionally (`root.ts:211`, not via the conditional
pattern used for classification) and every `gulf.*` procedure uses bare
`tenantProcedure`, not `tenantFlaggedProcedure` + `requireFeatureFlag`. The entire
legal-sensitive Gulf API surface is therefore reachable by any authenticated tenant
user with the matching RBAC permission, regardless of the dark flags — the "ship
dark" guarantee is enforced only in the UI. (Local-only deploy posture limits the
blast radius, hence WARNING not BLOCKER, but the gating gap is real and the fix
pattern already exists.)
**Fix:** Switch the Gulf procedures to `tenantFlaggedProcedure` and add
`.use(requireFeatureFlag('gulf.free-zone-tracking'))` (free-zone procedures) /
`.use(requireFeatureFlag('gulf.saudization-dashboard'))` (saudization procedures),
matching the skonto precedent.

### WR-03: Auto-NOC items are silently WAIVED by unrelated classification recomputes (advisory erased)

**File:** `packages/api/src/services/compliance-supersession.ts:126-159`, `packages/api/src/services/permitted-activity-check.ts:41,102-114`
**Issue:**
The permitted-activity scope check creates a WARNING NOC item with
`policyRuleId = 'uae.permitted_activity_noc@v1'`. `supersedeAndMaterialise` WAIVES
every non-WAIVED row for the contractor that is not re-emitted by
`resolvePolicyRules`, excluding only `policyRuleId` starting with `uae.free_zone`
(line 130). The NOC prefix (`uae.permitted_activity_noc`) is **not** excluded, and
the `findMany` filters by `contractorId` only (not `contractId`). So any unrelated
classification recompute on the contractor — even on a different engagement — silently
flips every NOC item to WAIVED, erasing the scope-mismatch advisory that the
contract-create flow surfaced and that the UI links to. The NOC is non-blocking, so
this is less severe than the free-zone case, but it is a demonstrable behavior gap
introduced this phase.
**Fix:** Extend the supersession exclusion to cover NOC items (and any other
out-of-band advisory items), e.g. exclude both prefixes, or filter on a positive
allowlist of classification-owned rule ids:

```ts
where: {
  contractorId: ctx.contractorId,
  status: { not: 'WAIVED' },
  NOT: [
    { policyRuleId: { startsWith: 'uae.free_zone' } },
    { policyRuleId: { startsWith: 'uae.permitted_activity_noc' } },
  ],
},
```

### WR-04: Backfill aborts the entire transaction when any contractor has an unparseable `tradeLicenseExpiry`

**File:** `packages/db/scripts/backfill-free-zone-assignment.ts:102,152-164`
**Issue:**
`licenseExpiresAt: fields.tradeLicenseExpiry ? new Date(fields.tradeLicenseExpiry) : null`
performs no validation. A freeform value that does not parse (e.g. `"2025-13-01"`,
`"soon"`, a localized date) yields `Invalid Date`. The planned inserts are all run in
a single `prisma.$transaction([...])` (line 152), so one `Invalid Date` rejected by
Postgres aborts the whole batch — no contractor is backfilled and the failure is
opaque. Source data is freeform JSONB, so malformed dates are plausible.
**Fix:** Validate/normalize the parsed date in `planFreeZoneBackfill`; on an invalid
date, set `licenseExpiresAt: null` and log a warning (or skip with a recorded
reason) rather than emitting an `Invalid Date`:

```ts
let licenseExpiresAt: Date | null = null;
if (fields.tradeLicenseExpiry) {
  const d = new Date(fields.tradeLicenseExpiry);
  licenseExpiresAt = Number.isNaN(d.getTime()) ? null : d;
}
```

### WR-05: Config dialog "Save band" is enabled when band is null and silently clears the recorded band

**File:** `apps/web-vite/src/components/saudization/saudization-config-dialog.tsx:83-85,151`
**Issue:**
`handleSaveBand` sends `{ band, ... }` with `band` possibly `null`; the Save-band
button (line 151) is only `disabled={isSavingBand}`, never gated on band presence.
`upsertConfigSchema` accepts `band: nitaqatBandEnum.nullish()`, where `null` *clears*
the recorded band server-side. A user who opens the dialog intending to edit only the
industry segment, but whose `band` state is `null` (no band recorded yet, or it was
reset), will wipe / fail to set the manually-recorded Nitaqat band on save. Because
the band drives `bandLastUpdatedAt` and the quarterly-reentry alert, this is
unintended data loss of a deliberately manual value (Pitfall 8).
**Fix:** Either disable the Save-band button while `band === null`
(`disabled={isSavingBand || band === null}`) and surface a hint, or split band vs.
segment into independent save actions so saving the segment never touches the band.

## Info

### IN-01: `reEvaluateFreeZoneStatus` is currently dead code

**File:** `packages/api/src/services/free-zone-compliance.ts:199-221`
**Issue:** Exported and documented as consumed by the reminder fan-out, but never
called outside its module/tests. This is the mechanism missing in CR-01; once CR-01
is fixed by wiring it in, this resolves. Flagged separately so it is not lost if
CR-01 is addressed differently.
**Fix:** Wire it in (see CR-01) or remove the misleading "Consumed by ..." comment.

### IN-02: `numberLocaleTag` falls back to `en` but still indexes the original locale

**File:** `apps/web-vite/src/components/saudization/format-locale.ts:14-17`
**Issue:** `const lang = locale in REGION_BY_LOCALE ? locale : 'en';` then
`REGION_BY_LOCALE[lang]` — correct for known locales and for the `en` fallback, but
the construction is slightly indirect. For `ar` it yields `ar-SA-u-nu-latn` (valid).
No bug; minor readability. Consider returning a constant default tag directly for the
unknown branch.
**Fix:** Optional clarity refactor; current behavior is correct.

### IN-03: RTL physical-property guard does not cover the modified `country-compliance-section.tsx`

**File:** `packages/db/scripts/check-rtl-logical-props.mjs:26-29`, `apps/web-vite/src/components/contractors/country-compliance-section.tsx`
**Issue:** The guard scans only `saudization/` and `contractors/free-zone/`.
`country-compliance-section.tsx` (modified this phase to mount the free-zone surface,
and itself an RTL-relevant AE/SA surface) is outside the scanned dirs. The file does
use logical props (`me-1`, `me-2`) in its current state, so there is no live RTL leak,
but the guard would not catch a future physical-prop regression here.
**Fix:** Optional — add the AE/SA-touching `country-compliance-section.tsx` (or its
directory) to `GULF_SURFACE_DIRS`, accepting it may surface pre-existing offenders.

## Narrative Findings (AI reviewer)

All findings above are narrative (direct adversarial code review). No
`<structural_findings>` substrate was provided for this review.

---

_Reviewed: 2026-06-03T10:56:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
