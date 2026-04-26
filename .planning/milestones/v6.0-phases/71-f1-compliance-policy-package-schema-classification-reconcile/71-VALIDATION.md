---
phase: 71
slug: f1-compliance-policy-package-schema-classification-reconcile
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 71 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Every plan ships failing tests in Wave 0; subsequent waves turn them green. Per-package vitest runtime <3s. Multi-region apply is the only manual step (mirrors Phase 70 Plan 09 precedent).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (existing — `packages/*/vitest.config.ts`, `apps/web/vitest.config.ts`) |
| **Config file** | per-package `vitest.config.ts` — new `packages/compliance-policy/vitest.config.ts` follows the existing template (`packages/feature-flags/vitest.config.ts`) |
| **Quick run command** | `pnpm --filter @contractor-ops/<pkg> test` (per package, <3s) |
| **Full suite command** | `pnpm test && pnpm lint:schema && pnpm lint:logs && pnpm i18n:parity` |
| **Estimated runtime** | ~50s full / <3s per-package quick |
| **Multi-region apply** | manual — `DATABASE_URL=$DATABASE_URL_EU pnpm --filter @contractor-ops/db prisma migrate deploy` then same against `$DATABASE_URL_ME` (LOCAL-ONLY constraint) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/<pkg-touched> test` for the touched package.
- **After every plan wave:** Run `pnpm test` (turbo orchestrates per-package).
- **Before `/gsd-verify-work`:** Full suite + Phase 70 lint commands all green.
- **Max feedback latency:** **3 seconds** per-package vitest run (Nyquist requirement).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 71-01-01 | 01 | 0 | COMPL-09 | T-71-01-01 | Failing test scaffold for `@contractor-ops/compliance-policy` registry shape | unit | `pnpm --filter @contractor-ops/compliance-policy test registry` | ❌ W0 | ⬜ pending |
| 71-01-02 | 01 | 0 | COMPL-09 | T-71-01-01 | Failing test scaffold for `POLICY_RULE_SET_VERSION` ↔ package.json sync | unit | `pnpm --filter @contractor-ops/compliance-policy test version` | ❌ W0 | ⬜ pending |
| 71-01-03 | 01 | 0 | COMPL-02 | T-71-04-01 | Failing test scaffold for resolver — 4 ROADMAP fixtures | unit | `pnpm --filter @contractor-ops/compliance-policy test resolve` | ❌ W0 | ⬜ pending |
| 71-01-04 | 01 | 0 | COMPL-08 | T-71-02-02 | Failing test scaffold for TZ boundary helper (`isExpired`) — Riyadh fixture | unit | `pnpm --filter @contractor-ops/compliance-policy test expiry` | ❌ W0 | ⬜ pending |
| 71-01-05 | 01 | 0 | COMPL-09 | T-71-02-01 | Failing test scaffold asserting 13 PENDING signoff entries | unit | `pnpm --filter @contractor-ops/feature-flags test signoff-registry-flags-compliance-entries` | ❌ W0 | ⬜ pending |
| 71-01-06 | 01 | 0 | COMPL-02 | T-71-04-01 | Failing test scaffold for `submit` supersession-on-outcome-change | integration | `pnpm --filter @contractor-ops/api test classification-supersession` | ❌ W0 | ⬜ pending |
| 71-01-07 | 01 | 0 | COMPL-10 | T-71-05-01 | Failing test scaffold for `recreateComplianceAssessment` idempotency + audit log | integration | `pnpm --filter @contractor-ops/api test classification-recompute` | ❌ W0 | ⬜ pending |
| 71-01-08 | 01 | 0 | COMPL-08 | T-71-07-01 | Failing test scaffold for backfill idempotency | unit | `pnpm --filter @contractor-ops/db test backfill-compliance-policy` | ❌ W0 | ⬜ pending |
| 71-01-09 | 01 | 0 | COMPL-10 | T-71-06-01 | Failing test scaffold for recompute UI button + confirm dialog | unit (RTL) | `pnpm --filter web test recompute-compliance-button` | ❌ W0 | ⬜ pending |
| 71-02-01 | 02 | 1 | COMPL-09 | T-71-02-01 | Policy registry tree: 5 jurisdiction modules export rules; resolver returns correct set per fixture | unit | `pnpm --filter @contractor-ops/compliance-policy test` | ❌ W0 | ⬜ pending |
| 71-02-02 | 02 | 1 | COMPL-09 | T-71-02-03 | `policyRuleId` regex `^[a-z]+\.[a-z_]+@v\d+$`; no duplicates | unit | `pnpm --filter @contractor-ops/compliance-policy test registry --grep regex` | ❌ W0 | ⬜ pending |
| 71-02-03 | 02 | 1 | COMPL-08 | T-71-02-02 | TZ boundary: 6 fixtures across 5 jurisdictions; Riyadh "today" resolves at 00:00 Asia/Riyadh | unit | `pnpm --filter @contractor-ops/compliance-policy test expiry` | ❌ W0 | ⬜ pending |
| 71-02-04 | 02 | 1 | COMPL-09 | T-71-02-04 | 13 PENDING signoff entries appended to `signoff-registry-flags.json`; Phase 70 boot gate not tripped | unit | `pnpm --filter @contractor-ops/feature-flags test` | ❌ W0 | ⬜ pending |
| 71-03-01 | 03 | 2 | COMPL-08 | T-71-03-01 | Prisma schema gains `severity`, `policyRuleId`, `expiryJurisdictionTz`, `waivedReason` on `ContractorComplianceItem` | unit | `pnpm --filter @contractor-ops/db db:generate && grep -q 'expiryJurisdictionTz' packages/db/generated/prisma/client/index.d.ts` | ❌ W0 | ⬜ pending |
| 71-03-02 | 03 | 2 | COMPL-08 | T-71-03-01 | New `Severity` + `WaivedReason` enums in schema; `policyRuleSetVersion` on `ClassificationAssessment` | unit | `grep -q 'enum Severity' packages/db/prisma/schema/contractor.prisma && grep -q 'policyRuleSetVersion' packages/db/prisma/schema/classification.prisma` | ❌ W0 | ⬜ pending |
| 71-03-03 | 03 | 2 | COMPL-08 | T-71-03-04 | Migration SQL has no DROP/RENAME (manual visual review per `autonomous: false`) | manual | review generated `migration.sql` | ❌ W0 | ⬜ pending |
| 71-03-04 | 03 | 2 | COMPL-08 | T-71-03-02 | New `@@index([organizationId, policyRuleId])` index supports drift queries | unit | `grep -q 'organizationId, policyRuleId' packages/db/prisma/schema/contractor.prisma` | ❌ W0 | ⬜ pending |
| 71-03-05 | 03 | 2 | COMPL-08 | T-71-03-03 | `pnpm lint:schema` (Phase 70) still passes — no new tenant-scoping violations | integration | `pnpm lint:schema` | ❌ W0 | ⬜ pending |
| 71-04-01 | 04 | 2 | COMPL-02 | T-71-04-01 | `submit` mutation wraps body in `$transaction`; existing happy path unchanged | integration | `pnpm --filter @contractor-ops/api test classification-submit` | ✅ existing | ⬜ pending |
| 71-04-02 | 04 | 2 | COMPL-02 | T-71-04-01 | First classification materialises 4 rows for UK B2B (RTW + UTR + business-registration + SDS-when-INSIDE) | integration | `pnpm --filter @contractor-ops/api test classification-supersession --grep first-classification` | ❌ W0 | ⬜ pending |
| 71-04-03 | 04 | 2 | COMPL-02 | T-71-04-02 | Outcome change UK B2B → DE ABHANGIG: old 4 rows WAIVED with `classification_outcome_change`, new 3 rows inserted | integration | `pnpm --filter @contractor-ops/api test classification-supersession --grep outcome-change` | ❌ W0 | ⬜ pending |
| 71-04-04 | 04 | 2 | COMPL-02 | T-71-04-03 | Same outcome on resubmit: no row churn (old rows untouched, no new rows) | integration | `pnpm --filter @contractor-ops/api test classification-supersession --grep same-outcome` | ❌ W0 | ⬜ pending |
| 71-04-05 | 04 | 2 | COMPL-02 | T-71-04-04 | Carry-forward: when new rule's `documentType` equals old rule's, `satisfiedByDocumentId` + `expiresAt` copied; status remains SATISFIED | integration | `pnpm --filter @contractor-ops/api test classification-supersession --grep carry-forward` | ❌ W0 | ⬜ pending |
| 71-04-06 | 04 | 2 | COMPL-02 | T-71-04-05 | Transactional atomicity: induced failure mid-supersession leaves 0 mutations | integration | `pnpm --filter @contractor-ops/api test classification-supersession --grep atomicity` | ❌ W0 | ⬜ pending |
| 71-05-01 | 05 | 3 | COMPL-10 | T-71-05-01 | `recreateComplianceAssessment` accepts `{contractorIds, reason}`; admin-only via `adminProcedure` | integration | `pnpm --filter @contractor-ops/api test classification-recompute --grep authz` | ❌ W0 | ⬜ pending |
| 71-05-02 | 05 | 3 | COMPL-10 | T-71-05-02 | Idempotency: second invocation returns `noop: true, reason: 'already_current'` per contractor | integration | `pnpm --filter @contractor-ops/api test classification-recompute --grep idempotent` | ❌ W0 | ⬜ pending |
| 71-05-03 | 05 | 3 | COMPL-10 | T-71-05-03 | Single AuditLog row emitted per invocation with deltas in `metadataJson` | integration | `pnpm --filter @contractor-ops/api test classification-recompute --grep audit-log` | ❌ W0 | ⬜ pending |
| 71-05-04 | 05 | 3 | COMPL-10 | T-71-05-04 | Bulk recompute (N>1 contractorIds): processes each in independent transaction; 1 AuditLog row total | integration | `pnpm --filter @contractor-ops/api test classification-recompute --grep bulk` | ❌ W0 | ⬜ pending |
| 71-05-05 | 05 | 3 | COMPL-10 | T-71-05-05 | Reason validation: invalid reason rejected with `BAD_REQUEST`; missing reason rejected | integration | `pnpm --filter @contractor-ops/api test classification-recompute --grep reason-validation` | ❌ W0 | ⬜ pending |
| 71-06-01 | 06 | 3 | COMPL-10 | T-71-06-01 | Per-contractor button renders on profile compliance tab; opens confirm dialog | unit (RTL) | `pnpm --filter web test recompute-compliance-button` | ❌ W0 | ⬜ pending |
| 71-06-02 | 06 | 3 | COMPL-10 | T-71-06-02 | Confirm dialog requires reason selection; calls mutation with `{contractorIds: [contractorId], reason}` | unit (RTL) | `pnpm --filter web test recompute-compliance-button --grep confirm-dialog` | ❌ W0 | ⬜ pending |
| 71-06-03 | 06 | 3 | COMPL-10 | T-71-06-03 | Bulk action on contractors-list: selected IDs passed to mutation | unit (RTL) | `pnpm --filter web test contractors-list --grep recompute-bulk` | ❌ W0 | ⬜ pending |
| 71-06-04 | 06 | 3 | COMPL-10 | T-71-06-04 | Success toast shows affected-row count; error toast on mutation failure | unit (RTL) | `pnpm --filter web test recompute-compliance-button --grep toast` | ❌ W0 | ⬜ pending |
| 71-07-01 | 07 | 3 | COMPL-08 | T-71-07-01 | Backfill is idempotent: `WHERE policyRuleId IS NULL` precondition; second run returns 0 updates | unit | `pnpm --filter @contractor-ops/db test backfill-compliance-policy --grep idempotent` | ❌ W0 | ⬜ pending |
| 71-07-02 | 07 | 3 | COMPL-08 | T-71-07-02 | Backfill resolves policy rules from contractor's latest `completed` assessment; populates `policyRuleId`, `severity`, `expiryJurisdictionTz` | unit | `pnpm --filter @contractor-ops/db test backfill-compliance-policy --grep resolve` | ❌ W0 | ⬜ pending |
| 71-07-03 | 07 | 3 | COMPL-08 | T-71-07-03 | Multi-region application documented (manual step per Standing Constraints) | manual | review `packages/db/scripts/README.md` | ❌ W0 | ⬜ pending |
| 71-07-04 | 07 | 3 | COMPL-08 | T-71-07-04 | Skips contractors without a completed assessment (no rule set to apply); logs count | unit | `pnpm --filter @contractor-ops/db test backfill-compliance-policy --grep skip` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/compliance-policy/` — new package with `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts` exporting empty registry. Failing test stubs:
  - `src/__tests__/registry.test.ts`
  - `src/__tests__/version.test.ts`
  - `src/__tests__/resolve.test.ts`
  - `src/__tests__/expiry.test.ts`
- [ ] `packages/feature-flags/src/__tests__/signoff-registry-flags-compliance-entries.test.ts` — failing scaffold asserting 13 entries.
- [ ] `packages/api/src/__tests__/classification-supersession.test.ts` — failing scaffold for `submit` outcome-change branch (uses Prisma test util).
- [ ] `packages/api/src/__tests__/classification-recompute.test.ts` — failing scaffold for `recreateComplianceAssessment`.
- [ ] `packages/db/src/__tests__/backfill-compliance-policy.test.ts` — failing scaffold for backfill correctness.
- [ ] `apps/web/src/components/contractors/compliance/__tests__/recompute-compliance-button.test.tsx` — failing scaffold for the UI button.

**No new framework install.** Vitest already runs in every target package. The new `@contractor-ops/compliance-policy` package reuses the workspace vitest config pattern (`packages/feature-flags/vitest.config.ts` is the closest analog).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-region migration applies to EU + ME databases (Plan 71-03) | COMPL-08 | LOCAL-ONLY constraint; no hosted multi-region staging available | After Plan 71-03 lands and developer reviews the generated `migration.sql`: run `cd packages/db && DATABASE_URL=$DATABASE_URL_EU npx prisma migrate deploy` then same with `$DATABASE_URL_ME`. Both regions must succeed or both must be rolled back. |
| Multi-region backfill (Plan 71-07) executes against EU + ME | COMPL-08 | Same — LOCAL-ONLY | After 71-07 lands: `DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-compliance-policy.ts --dry-run` then without `--dry-run`; same against `$DATABASE_URL_ME`. Idempotent (second run reports 0 writes). |
| Visual review of generated migration SQL (Plan 71-03 task 71-03-03) | COMPL-08 | Migration auto-generation can produce unexpected DROP/RENAME under unusual conditions | Developer opens `packages/db/prisma/migrations/<ts>_add_compliance_policy_columns/migration.sql` in editor, confirms only ALTER TABLE ADD COLUMN + CREATE TYPE statements, no DROP or RENAME. |
| Admin recompute UI on real contractors (Plan 71-06) | COMPL-10 | Real Prisma rows + admin session required | Developer logs in as admin, navigates to a contractor's compliance tab, clicks "Recompute compliance" button, selects reason, observes success toast and updated rows. Bulk action: select 2+ contractors on list page, run "Recompute compliance" action, observe single AuditLog row. |
| Legal text in `signoff-registry-flags.json` flips PENDING→APPROVED | COMPL-09 | Out of phase scope per Standing Constraint (legal review DEFERRED post-deploy) | Each per-jurisdiction document gets a follow-up PR that flips its entry to `status: APPROVED` with `legalTicketRef`, `approvedBy`, `approvedAt`, `approverRole`. Tracked as a separate post-deploy backlog item. |

*Legal review (the actual content correctness of the 13 documents — UK Right-to-Work text, A1 24-month wording, Iqama 1-year semantics, etc.): **DEFERRED per Standing Project Constraints**. Recorded as post-deploy items in 71-SUMMARY.md.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (one task per row above maps to a `pnpm ... test` command, OR a manual review item documented above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (manual-only items above are post-implementation, not interspersed with build tasks)
- [ ] Wave 0 covers all MISSING references (`packages/compliance-policy/` is the new home; existing packages get `__tests__/` additions)
- [ ] No watch-mode flags (every command above runs `vitest run` semantics, not `vitest`)
- [ ] Feedback latency < 3s per package (existing vitest configs hit this; new `@contractor-ops/compliance-policy` uses small fixture trees)
- [ ] `nyquist_compliant: true` set in frontmatter — flip after Wave 0 lands
- [ ] Plan 71-03 marked `autonomous: false` per Phase 70 Plan 09 precedent (multi-region schema migration)
- [ ] Plan 71-07 marked `autonomous: false` per Phase 70 Plan 09 precedent (multi-region backfill)

**Approval:** pending
