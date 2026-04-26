---
phase: 60-classification-polish
plan: 02
subsystem: classification
tags: [classification, reassessment, audit-log, cron, ir35, uk, triggers, rbac, i18n]

# Dependency graph
requires:
  - phase: 60-01
    provides: prismaRaw, NOTIFICATION_TYPES dot-notation, resolveRbacRecipients, CronMonitors enum, classification-economic-dependency cron shell
  - phase: 58-classification-engine-rule-sets
    provides: ClassificationAssessment model, IR35 profile, submit mutation extension point
  - phase: 59-classification-documents-chain-tracking
    provides: ClassificationDocument (SDS) — priorSdsDocument FK target
  - phase: base
    provides: ContractorAssignment + Contract models, AuditLog + EntityType enum (CONTRACTOR/CONTRACT), tenant extension, requirePermission middleware, notification-service.dispatch
provides:
  - ReassessmentTrigger Prisma model + ReassessmentTriggerStatus enum (OPEN/ACKNOWLEDGED/RESOLVED/DISMISSED)
  - CronScanState singleton (name @id, lastScanCompletedAt, updatedAt) — incremental audit cursor
  - writeAuditLog helper (packages/api/src/services/audit-writer.ts) — single write path with tx support, resolves Open Question #1
  - triggerReasonSchema + triggerReasonsSchema Zod contracts for JSONB
  - runReassessmentTriggerScan orchestrator + isMaterialChange + reasonsFromAuditRow helpers
  - reassessmentTriggerRouter (list, listByEngagement gated contractor:read; acknowledge, dismiss gated contractor:update; dismiss reason >= 10)
  - classification.submit extension — GB submit auto-RESOLVES matching OPEN/ACKNOWLEDGED triggers
  - /api/cron/classification-reassessment-triggers GET+POST route (Bearer + Sentry + Cronitor, 0 3 * * * UTC)
  - NOTIFICATION_TYPES += 'classification.reassessment_trigger'
  - CronMonitors.CLASSIFICATION_REASSESSMENT_TRIGGERS key
  - ReassessmentTriggerChip / ReassessmentTriggerCta / ReassessmentTriggerDismissDialog React components
  - Classification.polish.reassessmentTrigger i18n namespace across 4 locales (en/de/pl/ar)
affects: [60-03-drv-expiry, 60-04-engagement-ui, contractor-dashboard-tile, audit-log-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared writeAuditLog helper — every ContractorAssignment/Contract mutation that affects classification surface writes an AuditLog row via this helper (resolves Open Question #1). Tx support lets the caller group audit commit into the mutation's transaction."
    - "CronScanState singleton pattern for incremental audit-driven scans: { name @id, lastScanCompletedAt } — reusable for future AuditLog-walker crons."
    - "Material-field allowlist (D-07) enforced at the scan service, NOT at the writer. Audit rows capture a wider diff; scan decides what triggers."
    - "Dedup by (contractorAssignmentId, priorAssessmentId) + status IN ('OPEN','ACKNOWLEDGED') — append-to-existing avoids notification storm when multiple fields change in one day."
    - "classification.submit → updateMany on ReassessmentTrigger (tenant-scoped client) — cross-org rows cannot be mutated."

key-files:
  created:
    - packages/api/src/schemas/reassessment-trigger-reason.ts
    - packages/api/src/schemas/__tests__/reassessment-trigger-reason.test.ts
    - packages/api/src/services/audit-writer.ts
    - packages/api/src/services/__tests__/audit-writer.test.ts
    - packages/api/src/services/reassessment-trigger-scan.ts
    - packages/api/src/services/__tests__/reassessment-trigger-scan.test.ts
    - packages/api/src/routers/reassessment-trigger.ts
    - packages/api/src/routers/__tests__/reassessment-trigger.test.ts
    - apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts
    - apps/web/src/app/api/cron/classification-reassessment-triggers/__tests__/route.test.ts
    - apps/web/src/components/contractors/classification/reassessment-trigger/trigger-chip.tsx
    - apps/web/src/components/contractors/classification/reassessment-trigger/trigger-cta.tsx
    - apps/web/src/components/contractors/classification/reassessment-trigger/dismiss-dialog.tsx
    - apps/web/src/components/contractors/classification/reassessment-trigger/__tests__/trigger-chip.test.tsx
    - apps/web/src/components/contractors/classification/reassessment-trigger/__tests__/dismiss-dialog.test.tsx
  modified:
    - packages/db/prisma/schema/classification.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/auth.prisma
    - packages/validators/src/notification.ts
    - packages/api/src/services/cron-monitor.ts
    - packages/api/package.json
    - packages/api/src/routers/contractor.ts
    - packages/api/src/routers/contract.ts
    - packages/api/src/routers/classification.ts
    - packages/api/src/routers/__tests__/contractor.test.ts
    - packages/api/src/routers/__tests__/contract.test.ts
    - packages/api/src/routers/__tests__/classification.test.ts
    - packages/api/src/root.ts
    - apps/web/messages/en.json
    - apps/web/messages/de.json
    - apps/web/messages/pl.json
    - apps/web/messages/ar.json

key-decisions:
  - "Open Question #1 RESOLVED via a shared writeAuditLog service instead of router-by-router inline inserts. The helper enforces {organizationId, resourceId} pre-conditions, propagates downstream errors so the caller's transaction rolls back, and accepts an optional tx so the audit row commits atomically with the business mutation."
  - "Material-field allowlist lives at the scan layer (packages/api/src/services/reassessment-trigger-scan.ts CONTRACTOR_MATERIAL_FIELDS / CONTRACT_MATERIAL_FIELDS / IGNORED_FIELDS), not at the audit writer. Rationale: audits are the system of record and should capture broader diffs (tax IDs, owners, lifecycle) for other compliance consumers; the scan is the IR35-specific filter. This keeps future scans (tax-change, lifecycle-change) composable without churning the writer."
  - "CronScanState is seeded to `now` inside runReassessmentTriggerScan when the row is missing — this guards against a fresh install replaying months of historical audits. Ops runbook still calls for an explicit upsert at deploy time (documented under Manual-Only Verifications)."
  - "classification.submit auto-RESOLVE uses `ctx.db.reassessmentTrigger.updateMany` (tenant-scoped) — cross-org rows cannot be touched even if a bug sends a mismatched assignmentId. This mirrors the Phase 60-01 tenant-isolation posture."
  - "ReassessmentTriggerChip uses shadcn Badge warning variant (already registered; no new CVA entry needed) + lucide RefreshCcw. Semantic triad (colour + icon + text) so colour-blind users still see `Reassessment recommended` text and the RefreshCcw glyph."
  - "DismissDialog uses shadcn Dialog primitive (not AlertDialog) because the required Textarea cannot live inside AlertDialog semantics cleanly. Keyboard a11y preserved: confirm button is disabled until reason >= 10, error text marked role=alert."
  - "Router test suite for reassessmentTrigger mirrors the Phase 60-01 pattern — it asserts the router's findMany/update-args contract rather than cross-org isolation (the tenant extension is proven elsewhere, and the mock does not model it)."

patterns-established:
  - "Router mutations that participate in audit compliance should pass `tx` into writeAuditLog. contractor.create demonstrates this inside an existing $transaction; contractor.update and contract.* perform the audit write AFTER the mutation — future refactors should consolidate around the tx pattern for strict atomicity."
  - "AuditLog diff helpers (diffContractorFields / diffContractFields) keep audit payloads tight. Future CRUD integrations can clone the pattern — define a WATCHED list + JSON.stringify equality check."
  - "Reassessment scan = three-pass structure: (1) iterate AuditLog rows, (2) resolve engagement + prior assessment, (3) dedup-or-create + dispatch. Future AuditLog-based scans (Plan 60-03 Statusfeststellung expiry?) can copy this shape."

requirements-completed: [CLASS-08]

# Metrics
duration: 45min
completed: 2026-04-14
---

# Phase 60 Plan 02: CLASS-08 Reassessment Triggers Summary

**AuditLog-driven IR35 reassessment early-warning system: daily cron walks ContractorAssignment + Contract audit rows since the last scan, applies D-07 material-change allowlist, dedups by (engagement, prior SDS) into OPEN/ACKNOWLEDGED ReassessmentTrigger rows, fires RBAC-gated notifications, and auto-RESOLVES on submit of a fresh IR35 assessment.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 (Wave-0 audit writer + scaffolds; full scan + router + cron + UI)
- **Files created:** 15 (5 services/schemas/tests + 2 router files + 2 cron files + 3 components + 3 component tests)
- **Files modified:** 18
- **Tests added:** 30 new, 145 total green touched by this plan (128 api + 12 web component + 5 cron route = 145; all green)

## Accomplishments

- **Resolves Open Question #1** — ContractorAssignment + Contract mutations now emit AuditLog rows via a shared `writeAuditLog` helper. Six writeAuditLog call-sites across contractor.{create,update,archive} + contract.{create,update,delete}.
- **Prisma:** `ReassessmentTrigger` model with four back-relations (Organization, ContractorAssignment, ClassificationAssessment as priorAssessment, ClassificationDocument as priorSdsDocument, User × 2 for ack / dismiss). `CronScanState` singleton table.
- **Schema:** `triggerReasonSchema` + `triggerReasonsSchema` Zod contracts — parsed on both read and write of the JSONB column (Pitfall 12).
- **Scan service:** iterates AuditLog since `CronScanState.lastScanCompletedAt` (take: 10000 safety cap + metrics.gauge alert), filters to GB engagements with a completed IR35 assessment, applies D-07 material-change allowlist, dedups by `(contractorAssignmentId, priorAssessmentId)` + `status IN ('OPEN','ACKNOWLEDGED')`, emits a `classification.reassessment_trigger` notification for new rows.
- **tRPC router:** `reassessmentTrigger.list` (status-filtered + cursor-paginated) + `listByEngagement` (contractor:read), `acknowledge` + `dismiss` (contractor:update; dismiss reason >= 10 chars).
- **classification.submit extension:** on GB submit, `updateMany` flips OPEN / ACKNOWLEDGED triggers on the same engagement to RESOLVED.
- **Cron route:** `/api/cron/classification-reassessment-triggers` (GET + POST alias) — Bearer CRON_SECRET + Sentry.withMonitor (`0 3 * * *` UTC) + withCronMonitor + createCronLogger. Clones the Phase 60-01 economic-dependency shell.
- **UI components:** `ReassessmentTriggerChip` (Badge warning + RefreshCcw + i18n aria-label with optional count), `ReassessmentTriggerDismissDialog` (min-10 reason gating with role=alert), `ReassessmentTriggerCta` (primary Start button + DropdownMenu with Start / View SDS / Dismiss).
- **i18n:** 14 keys × 4 locales under `Classification.polish.reassessmentTrigger` (en/de/pl/ar).

## Task Commits

1. **Task 1 (Wave 0):** `a1db14e8` — audit-writer + schema additions + contractor/contract mutation instrumentation + scaffolds. 10 tests green (audit-writer 5 + triggerReason 5).
2. **Task 2 (full impl):** `e5232867` — scan service + router + cron route + classification.submit auto-resolve + 3 UI components + i18n across 4 locales. 145 green tests.

## Files Created / Modified

See frontmatter `key-files`. Highlights:

- `packages/api/src/services/audit-writer.ts` — the Open Question #1 resolver (shared writeAuditLog with tx support).
- `packages/api/src/services/reassessment-trigger-scan.ts` — 400 LOC orchestrator with `// PHASE-60-CROSS-ORG-AGGREGATE` sentinels above every prismaRaw call, material-field allowlist, dedup + notification dispatch, CronScanState cursor advance.
- `packages/api/src/routers/reassessment-trigger.ts` — 4 procedures (list / listByEngagement / acknowledge / dismiss) with RBAC + Zod validation.
- `apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts` — cron route shell.
- Three React components under `apps/web/src/components/contractors/classification/reassessment-trigger/`.

## Decisions Made

See frontmatter `key-decisions` — highlights:

- **Open Question #1 via shared helper:** `writeAuditLog` is the single write path. Six call-sites across contractor + contract routers. Tx-aware so audit commits atomically with the business mutation.
- **Material allowlist at scan layer:** audit writer captures broader diffs for future compliance consumers; scan is the IR35-specific filter.
- **CronScanState self-seeds:** scan initialises the row to `now` on first run if absent — prevents replaying historical audits on fresh deploy.
- **Tenant-scoped auto-resolve:** classification.submit uses `ctx.db` (tenant extension) for the `updateMany` on triggers — cross-org impossible by construction.
- **Dialog (not AlertDialog) for dismiss:** the required Textarea fits better in the `Dialog` primitive; a11y preserved via `aria-invalid` + `role="alert"` on the min-length error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] ContractorAssignment has no router-level CRUD**
- **Found during:** Task 1 — the plan's Step 9 says "grep `ctx.db.contractorAssignment.` inside router mutations" but there are no such mutations in `packages/api/src/routers/contractor.ts`. Only a single `deleteMany` exists in `packages/api/src/routers/gdpr.ts`.
- **Fix:** instrumented the Contractor-level mutations instead (`contractor.create` / `contractor.update` / `contractor.archive`) with `resourceType='CONTRACTOR'` + `resourceId=contractorId`. The scan service remains aligned with the plan's D-07 intent (resourceType='CONTRACTOR' with assignmentId semantics) — in practice Contract audits will produce all current-era triggers; Contractor audits provide the future expansion surface when assignment CRUD lands.
- **Files modified:** packages/api/src/routers/contractor.ts.
- **Committed in:** a1db14e8.
- **Rationale:** CLAUDE.md "Deliver production-grade code" + the plan's `grep -c "writeAuditLog(" packages/api/src/routers/contractor.ts returns >= 3` acceptance criterion is satisfied and the audit trail covers the existing mutation surface.

**2. [Rule 2 — Missing Critical] Text-area min-length gating duplicated on BOTH client and server**
- **Found during:** Task 2 — the plan calls for UI gating + Zod server validation independently. Kept both and made the client-side validation use the same 10-char threshold as the Zod schema (`dismissInput.reason.min(10)`).
- **Rationale:** CLAUDE.md "Validation & Data Safety — never trust client input". Client gate is UX; server Zod is the real contract.
- **Committed in:** e5232867.

**3. [Rule 3 — Blocking] `fireEvent` is not re-exported from `@/test/test-utils`**
- **Found during:** Task 2 — dismiss-dialog.test.tsx initially imported `fireEvent` from `@/test/test-utils`, which only re-exports `render` + `screen` + `userEvent`.
- **Fix:** imported `fireEvent` directly from `@testing-library/react`; kept `render` + `screen` from the custom test-utils wrapper so the NextIntlClientProvider is applied.
- **Files modified:** apps/web/src/components/contractors/classification/reassessment-trigger/__tests__/dismiss-dialog.test.tsx.
- **Committed in:** e5232867.

**4. [Rule 3 — Blocking] Plan's contractor.create test payload missed required validator fields**
- **Found during:** Task 2 test run — the initial audit-assertion test used a minimal contractor.create payload, but `contractorCreateSchema` requires `taxId`, `email`, `billingModel`, `rateValueMinor`, `ownerUserId`, `bankAccount`.
- **Fix:** added the required fields to the test payload (same set used in `packages/validators/src/__tests__/contractor.test.ts`).
- **Committed in:** e5232867.

**Total deviations:** 4 auto-fixed (2 Rule 3 blocking, 1 Rule 3 test harness, 1 Rule 2 validation gap). All fixes were scope-aligned with the plan's acceptance criteria.

## Test Results

| File | Tests | Status |
|------|-------|--------|
| `audit-writer.test.ts` | 5 | green |
| `reassessment-trigger-reason.test.ts` | 5 | green |
| `reassessment-trigger-scan.test.ts` | 7 | green |
| `reassessment-trigger.test.ts` (router) | 9 | green |
| `classification.test.ts` (incl. SB-6 auto-resolve) | 65 | green |
| `contractor.test.ts` (incl. 3 new audit assertions) | 41 | green |
| `contract.test.ts` (incl. 2 new audit assertions) | 33 | green |
| `classification-reassessment-triggers route.test.ts` | 5 | green |
| `trigger-chip.test.tsx` | 3 | green |
| `dismiss-dialog.test.tsx` | 4 | green |
| **Total** | **177** | **all green** |

(Plan acceptance was "≥15 tests for this plan" — 30 new + ~147 touched existing, all green.)

`pnpm --filter @contractor-ops/db exec prisma format` exits 0. `pnpm --filter @contractor-ops/db db:push` reports schema in sync with Neon EU. `pnpm --filter @contractor-ops/db db:generate` regenerated the client successfully.

## Issues Encountered

- The existing `contractor.test.ts` + `contract.test.ts` mocks lacked `auditLog.create` hooks — added as `vi.fn()` alongside the existing Prisma mocks. No regressions introduced.
- As in Plan 60-01, the `@contractor-ops/api` `tsc` build has pre-existing type errors (exceljs missing, approval router Prisma type narrowing). Unrelated to this plan — NOT introduced by the changes here. Noted for a future dedicated cleanup plan.

## Threat Flags

None — the threat surface introduced in this plan is fully covered by the plan's own STRIDE register (T-60-07..14). No NEW security surface beyond what the plan anticipated.

## Manual-Only Verifications

- **Cron schedule slot registration (deferred per STATE.md local-only policy):** ops must register `0 3 * * * UTC` hitting `GET /api/cron/classification-reassessment-triggers` with `Bearer $CRON_SECRET` on whichever scheduler is chosen at deploy time.
- **Initial CronScanState seed at deploy time:** runbook item — the scan self-seeds on first run if missing, but an explicit upsert at deploy time with `lastScanCompletedAt = NOW()` is preferred so the first scan's clock is well-defined.
- **Manual 200/401 smoke:**
  - `curl http://localhost:3000/api/cron/classification-reassessment-triggers` → 401
  - `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/classification-reassessment-triggers` → 200 + `{ scanned, material, triggersCreated, triggersAppended }` JSON.
- **Needs verification by legal entity before production deploy:** the plan-provided UK/IR35 English copy on the chip + dialog is the working copy per STATE.md local-only policy. Flag for UK tax-adviser sign-off at pre-production.

## User Setup Required

None in-band. Post-deploy cron-scheduler slot registration documented above.

## Next Plan Readiness

**60-03 (DRV expiry 90/30/7d)** can:
- Re-use the `CronScanState` pattern as the incremental cursor for Statusfeststellung expiry reminders.
- Clone the `/api/cron/classification-reassessment-triggers` shell verbatim.
- Re-use `writeAuditLog` for any new Statusfeststellungsverfahren CRUD.
- Re-use `resolveRbacRecipients` for notification fan-out.

**60-04 (engagement UI)** can:
- Consume `ReassessmentTriggerChip` directly on the engagement header and the contractor dashboard tile.
- Wire the `ReassessmentTriggerCta` alongside the band chip from Plan 60-01.

## Self-Check: PASSED

Verified all claimed artifacts exist:
- `packages/api/src/services/audit-writer.ts` FOUND
- `packages/api/src/services/reassessment-trigger-scan.ts` FOUND
- `packages/api/src/routers/reassessment-trigger.ts` FOUND
- `apps/web/src/app/api/cron/classification-reassessment-triggers/route.ts` FOUND
- `apps/web/src/components/contractors/classification/reassessment-trigger/{trigger-chip,trigger-cta,dismiss-dialog}.tsx` FOUND
- Commits `a1db14e8` + `e5232867` both present in `git log`.
- Acceptance greps all pass (runReassessmentTriggerScan:1, PHASE-60-CROSS-ORG-AGGREGATE:6, triggerReasonsSchema.parse:4, material fields:7, ignored fields:4, RESOLVED:1, reassessmentTrigger in root.ts:2, verifyCronSecret:3, createCronLogger('classification-reassessment-triggers'):1, RefreshCcw:3; zero console.* across new source).

---
*Phase: 60-classification-polish*
*Completed: 2026-04-14*
