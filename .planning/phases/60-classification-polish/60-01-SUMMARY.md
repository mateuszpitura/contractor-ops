---
phase: 60-classification-polish
plan: 01
subsystem: classification
tags: [classification, alerts, cron, notifications, economic-dependency, germany, drv, sgb-vi, prisma, trpc, rbac, i18n]

# Dependency graph
requires:
  - phase: 58-classification-engine-rule-sets
    provides: ClassificationAssessment + Scheinselbständigkeit rule-set context (§2 SGB VI terminology & thresholds)
  - phase: 57-tax-id-validation
    provides: Kleinunternehmer (isKleinunternehmer) flag on Organization (non-interaction asserted by test)
  - phase: base
    provides: Invoice / ContractorAssignment / Member / NOTIFICATION_TYPES / Better Auth roles / notification-service.dispatch / metrics.gauge / createCronLogger / withCronMonitor / Sentry.withMonitor
provides:
  - EconomicDependencyAlertState Prisma model + EconomicDependencyBand enum (safe/warning/critical)
  - prismaRaw — non-tenant-scoped PrismaClient binding for cron cross-org aggregates
  - resolveRbacRecipients(orgId, permission) — bulk role->permission recipient lookup (Open Question #3 resolved)
  - runEconomicDependencyScan orchestrator + bandFor / bandIndex / computeBillingShare / updateBandState pure helpers
  - economicDependencyAlertRouter (list + listByEngagement, contractor:read gated)
  - /api/cron/classification-economic-dependency GET+POST route (Bearer CRON_SECRET, 0 2 * * * UTC)
  - classification.economic_dependency_{warning,critical} NOTIFICATION_TYPES entries
  - CronMonitors.CLASSIFICATION_ECONOMIC_DEPENDENCY Cronitor heartbeat key
  - EconomicDependencyBandChip React component (semantic triad icon+colour+text)
  - Classification.polish.economicDependency i18n namespace in 4 locales (en/de/pl/ar)
affects: [60-02-reassessment-triggers, 60-03-drv-expiry, 60-04-engagement-ui, classification-dashboard-tile, DRV defense bundle integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-org aggregation via prismaRaw with // PHASE-60-CROSS-ORG-AGGREGATE sentinel — every deliberate tenant-bypass is grep-discoverable for audit"
    - "Bulk RBAC fan-out: resolveRbacRecipients mirrors Better Auth role statements (with snapshot test guarding against drift)"
    - "Daily cron shell: clone reminders/route.ts — verifyCronSecret + Sentry.withMonitor + withCronMonitor + createCronLogger + metrics.gauge triple-counter"
    - "Band state machine with 30-day reminder cadence: lastReminderAt-driven re-emission for same-band non-safe states"
    - "Semantic triad UI (colour + icon + text) reading OKLCh tokens (--success / --warning / --destructive) — never colour-alone per WCAG 1.4.1"

key-files:
  created:
    - packages/db/src/raw.ts
    - packages/api/src/services/rbac-recipients.ts
    - packages/api/src/services/economic-dependency-scan.ts
    - packages/api/src/routers/economic-dependency-alert.ts
    - apps/web/src/app/api/cron/classification-economic-dependency/route.ts
    - apps/web/src/components/contractors/classification/economic-dependency-alerts/band-chip.tsx
    - packages/api/src/services/__tests__/rbac-recipients.test.ts
    - packages/api/src/services/__tests__/economic-dependency-scan.test.ts
    - packages/api/src/routers/__tests__/economic-dependency-alert.test.ts
    - apps/web/src/app/api/cron/classification-economic-dependency/__tests__/route.test.ts
    - apps/web/src/components/contractors/classification/economic-dependency-alerts/__tests__/band-chip.test.tsx
  modified:
    - packages/db/prisma/schema/classification.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/src/index.ts
    - packages/db/src/tenant.ts
    - packages/validators/src/notification.ts
    - packages/api/src/services/cron-monitor.ts
    - packages/api/package.json
    - packages/api/src/root.ts
    - apps/web/messages/en.json
    - apps/web/messages/de.json
    - apps/web/messages/pl.json
    - apps/web/messages/ar.json

key-decisions:
  - "CronMonitors key adopted SCREAMING_SNAKE_CASE (CLASSIFICATION_ECONOMIC_DEPENDENCY) to match existing enum convention (REMINDERS, TOKEN_REFRESH, TRIAL_NOTIFICATIONS, JOB_HEALTH); the kebab-case value 'classification-economic-dependency' satisfies plan's grep assertions without diverging from codebase style (CLAUDE.md consistency)."
  - "resolveRbacRecipients snapshots the auth role->permission map locally (in rbac-recipients.ts) rather than calling authApi.hasPermission per user; a vitest snapshot against Better Auth's live role statements catches any drift. Rationale: avoids N network/auth-session round-trips in the cron path."
  - "Resolved (warning->safe / critical->warning / critical->safe) notifications reuse the classification.economic_dependency_warning NOTIFICATION_TYPE string rather than introducing a dedicated '...resolved' type; the title/body copy signals resolution. Rationale: avoids schema churn for all four notification preference/channel tables; matches Phase 59 pattern."
  - "cron route exports both GET and POST (POST = GET alias) — different schedulers (Render cron, Vercel cron, external) prefer different verbs. Auth gate is identical for both."
  - "EconomicDependencyBandChip uses Badge primitive with existing success/warning/destructive variants + OKLCh token classes; no new badge variant needed."

patterns-established:
  - "PHASE-60-CROSS-ORG-AGGREGATE: grep-auditable sentinel comment placed above every deliberate cross-tenant read via prismaRaw — enables one-glob scan of all cross-org touchpoints."
  - "Dual-aggregate billing-share: numerator (scoped by organizationId) and denominator (contractor-wide) use the SAME prismaRaw binding; only the where clause differs. Filters duplicated (status notIn VOID, deletedAt null) to keep both queries audit-comparable."
  - "Band state machine: bandIndex(previous) vs bandIndex(next) compares to decide cross-up / cross-down / same-band; reminder cadence triggered only when next === prev && !safe && daysBetween(lastReminderAt, now) >= 30."

requirements-completed: [CLASS-07]

# Metrics
duration: 13min
completed: 2026-04-14
---

# Phase 60 Plan 01: CLASS-07 Economic-Dependency Alerts Summary

**§2 SGB VI economic-dependency early-warning system: daily cron computes each DE contractor's 12-month platform billing share, transitions a safe/warning/critical band state machine at 70% / 83.33% thresholds, and fires RBAC-scoped notifications with a 30-day reminder cadence for sustained non-safe bands.**

## Performance

- **Duration:** 13 min
- **Tasks:** 2 (Wave-0 skeleton + full implementation)
- **Files created:** 11
- **Files modified:** 13
- **Tests added:** 36 (all green)

## Accomplishments

- **Backend service:** `runEconomicDependencyScan` iterates DE ACTIVE assignments, computes cross-org billing share via `prismaRaw.invoice.aggregate` (denominator omits organizationId filter — covered by dedicated test), transitions band state via `updateBandState`, dispatches notifications through `notification-service.dispatch` to RBAC-gated recipients.
- **Cron route:** `/api/cron/classification-economic-dependency` cloned from `/api/cron/reminders` — Bearer CRON_SECRET gate, Sentry.withMonitor (`0 2 * * *` UTC), withCronMonitor heartbeat, three `metrics.gauge` counters (scanned, crossings, notifications).
- **tRPC router:** `economicDependencyAlert.list` (cursor-paginated, band-filtered) + `listByEngagement` — both gated by `requirePermission({ contractor: ['read'] })`.
- **Storage model:** `EconomicDependencyAlertState` with `@@unique([contractorAssignmentId])`, back-relations on Organization + ContractorAssignment, three indexed shapes for scan/list queries.
- **Cross-org helper:** `prismaRaw` — non-tenant-scoped PrismaClient singleton re-exported from both `@contractor-ops/db` and `@contractor-ops/db/tenant`. JSDoc explicitly prohibits use in request handlers.
- **RBAC bulk lookup:** `resolveRbacRecipients(orgId, 'contractor:read'|'contractor:update')` returns deduped user ids whose role grants the permission; snapshot-tested against Better Auth's live role statements.
- **UI chip:** `EconomicDependencyBandChip` — semantic triad (CircleCheck/ShieldAlert/ShieldX + --success/--warning/--destructive + i18n label) with aria-label carrying rounded percent.
- **i18n:** 8 keys × 4 locales (en/de/pl/ar) under `Classification.polish.economicDependency`.

## Task Commits

Each task was committed atomically:

1. **Task 1 (Wave 0): schema + raw Prisma + notification types + cron-monitor key + rbac helper scaffolds** — `fb391b2a` (feat)
2. **Task 2 (full impl): scan service + cron route + router + UI chip + i18n + real tests** — `2fd60052` (feat)

## Files Created/Modified

### Created

- `packages/db/src/raw.ts` — PHASE-60-CROSS-ORG-AGGREGATE sentinel + prismaRaw singleton (no tenant extension).
- `packages/api/src/services/rbac-recipients.ts` — resolveRbacRecipients bulk helper + local role→permission mirror with snapshot test hook.
- `packages/api/src/services/economic-dependency-scan.ts` — runEconomicDependencyScan orchestrator + pure bandFor / bandIndex / computeBillingShare / updateBandState.
- `packages/api/src/routers/economic-dependency-alert.ts` — list + listByEngagement (contractor:read gated).
- `apps/web/src/app/api/cron/classification-economic-dependency/route.ts` — cron route with Bearer + Sentry + Cronitor + metrics wrapper (GET + POST).
- `apps/web/src/components/contractors/classification/economic-dependency-alerts/band-chip.tsx` — EconomicDependencyBandChip semantic-triad component.
- Four test files under matching `__tests__/` dirs (scan, router, route, chip, rbac-recipients).

### Modified

- `packages/db/prisma/schema/classification.prisma` — EconomicDependencyAlertState model + EconomicDependencyBand enum.
- `packages/db/prisma/schema/contractor.prisma` — ContractorAssignment back-relation (1:?).
- `packages/db/prisma/schema/organization.prisma` — Organization back-relation (1:N).
- `packages/db/src/index.ts` + `packages/db/src/tenant.ts` — re-export prismaRaw from both modules.
- `packages/validators/src/notification.ts` — NOTIFICATION_TYPES += 2 dot-notation entries.
- `packages/api/src/services/cron-monitor.ts` — CronMonitors.CLASSIFICATION_ECONOMIC_DEPENDENCY.
- `packages/api/package.json` — new subpath exports for the two new services.
- `packages/api/src/root.ts` — wire economicDependencyAlertRouter into appRouter.
- `apps/web/messages/{en,de,pl,ar}.json` — Classification.polish.economicDependency namespace.

## Decisions Made

See frontmatter `key-decisions` block. Highlights:

- **CronMonitors key casing:** used SCREAMING_SNAKE_CASE (matches existing enum style) while keeping the kebab-case *value* the plan's grep asserts on.
- **No dedicated `resolved` notification type:** reused `classification.economic_dependency_warning` for cross-down emissions to avoid churn on notification preference schema; title/body carries the distinction.
- **POST alias for cron route:** supports schedulers that prefer POST (Vercel cron, some Render setups) without duplicating auth.
- **Dual GET/POST entry** is consistent with the plan's `files_modified` contract and matches how cron schedulers across platforms vary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `@contractor-ops/auth` missing `./roles` subpath export**
- **Found during:** Task 1 — rbac-recipients.test.ts import failed with "No `prisma` export is defined on the `@contractor-ops/db` mock" because the bare `@contractor-ops/auth` import transitively pulls in `config.ts` which initialises `prismaAdapter(prisma)` at module load.
- **Fix:** (a) added `prisma: {}` stub to the `@contractor-ops/db` mock object in the test so the auth module loads cleanly; (b) kept the `roles` import from the package root (no change needed to auth package exports since the mock unblocks it).
- **Files modified:** packages/api/src/services/__tests__/rbac-recipients.test.ts.
- **Committed in:** fb391b2a.

**2. [Rule 2 — Missing Critical] `CronMonitors` enum keys used SCREAMING_SNAKE_CASE in prod but plan spec used camelCase**
- **Found during:** Task 1 — reading `packages/api/src/services/cron-monitor.ts` before editing showed the existing four keys (`REMINDERS`, `TOKEN_REFRESH`, `TRIAL_NOTIFICATIONS`, `JOB_HEALTH`) are SCREAMING_SNAKE_CASE, not camelCase as the plan suggested (`classificationEconomicDependency`).
- **Fix:** used `CLASSIFICATION_ECONOMIC_DEPENDENCY: 'classification-economic-dependency'` — matching both the file's existing convention AND the plan's grep assertion on the *value* `'classification-economic-dependency'`.
- **Files modified:** packages/api/src/services/cron-monitor.ts.
- **Committed in:** fb391b2a.
- **Rationale:** CLAUDE.md "Naming is consistent across the codebase" — keeping the one outlier out of the enum avoids future confusion.

**3. [Rule 2 — Missing Critical] `packages/api/package.json` lacked subpath exports for the two new services**
- **Found during:** Task 2 — the cron route at `apps/web/src/app/api/cron/classification-economic-dependency/route.ts` imports from `@contractor-ops/api/services/economic-dependency-scan`, but the subpath was not declared in `package.json#exports`. Without it, the Next.js workspace resolver would refuse the import at build time.
- **Fix:** added `./services/economic-dependency-scan` and `./services/rbac-recipients` to the exports map, mirroring the pattern of the existing ~30 service exports.
- **Files modified:** packages/api/package.json.
- **Committed in:** 2fd60052.

**4. [Rule 3 — Blocking] Router test attempted to simulate tenant-extension isolation in a mocked client**
- **Found during:** Task 2 — the first version of `economic-dependency-alert.test.ts` asserted cross-org filtering (Org A vs Org B rows), which the real Prisma tenant extension enforces automatically but the mock does not model. Two of the six tests failed because mock findMany returned both orgs.
- **Fix:** rewrote those two test cases to assert the router's OWN contract — it calls `findMany` / `findFirst` with the correct where-clause / cursor / band-filter — and documented inline that tenant isolation is proven elsewhere (tenant.test.ts). Cross-org leak-protection remains mechanically enforced in production by the extension; not repeating that assertion at the router layer avoids a misleading false-positive test.
- **Files modified:** packages/api/src/routers/__tests__/economic-dependency-alert.test.ts.
- **Committed in:** 2fd60052.

**5. [Rule 3 — Blocking] `EconomicDependencyBand` type not re-exported from `@contractor-ops/db`**
- **Found during:** Task 2 — the scan service initially imported `import type { EconomicDependencyBand } from '@contractor-ops/db'` but the barrel only re-exports `Prisma` type; the enum lives at `@contractor-ops/db/generated/prisma/client` which isn't in the public surface.
- **Fix:** replaced the import with a local literal type alias `export type Band = 'safe' | 'warning' | 'critical'` — semantically identical and lets the service be referenced by consumers without tight coupling to the generated Prisma namespace.
- **Files modified:** packages/api/src/services/economic-dependency-scan.ts.
- **Committed in:** 2fd60052.

---

**Total deviations:** 5 auto-fixed (3 Rule 3 blocking, 2 Rule 2 missing-critical).
**Impact on plan:** No scope creep. Every fix was either a structural contract hole (exports) or a test-harness mismatch between plan-described behaviour and the mock's capability. All acceptance greps still pass.

## Test Results

| File | Tests | Status |
|------|-------|--------|
| `rbac-recipients.test.ts` | 7 | green |
| `economic-dependency-scan.test.ts` | 20 | green |
| `economic-dependency-alert.test.ts` | 6 | green |
| `route.test.ts` (cron) | 5 | green |
| `band-chip.test.tsx` | 5 | green |
| **Total** | **43** | **green** |

`pnpm --filter @contractor-ops/db exec prisma format` exits 0. `pnpm --filter @contractor-ops/db db:push` reports "already in sync". No new TypeScript errors introduced in `@contractor-ops/api` build (pre-existing errors unrelated to this plan).

## Issues Encountered

- `@contractor-ops/api` `tsc` build has pre-existing type errors (unrelated — `exceljs` missing, approval router Prisma type narrowing, tax-id-validation.service missing exports). These are not regressions from this plan; verified by stash/pop against HEAD. Noted for future dedicated cleanup plan.

## Threat Flags

None — the threat surface introduced in this plan is fully covered by the plan's own STRIDE register (T-60-01..08). No NEW security surface beyond what the plan anticipated.

## Manual-Only Verifications

- **Cron schedule slot registration (deferred per STATE.md local-only policy):** ops must register `0 2 * * * UTC` hitting `GET /api/cron/classification-economic-dependency` with `Bearer $CRON_SECRET` header on whichever scheduler is chosen at deploy time (Render cron / Railway cron / Vercel cron). The route itself is fully implemented and auth-gated; only the scheduler configuration is platform-dependent.
- **Manual 200/401 smoke:**
  - `curl http://localhost:3000/api/cron/classification-economic-dependency` → 401
  - `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/classification-economic-dependency` → 200 + `{ scanned, crossings, notificationsDispatched }` JSON
- **Needs verification by legal entity before production deploy:** the Kleinunternehmer-does-not-alter-threshold assumption (§19 UStG independence from §2 SGB VI) is enforced in code and covered by a unit test, but awaits Steuerberater sign-off per STATE.md standing constraint. NOT a hard-stop for local execution.

## User Setup Required

None in-band. See Manual-Only Verifications above for the post-deploy cron-scheduler slot registration (documented but not gated on).

## Next Plan Readiness

**60-02 (reassessment triggers)** can consume:
- `NOTIFICATION_TYPES` already extended with the dot-notation pattern — 60-02 just appends `classification.reassessment_trigger`.
- `resolveRbacRecipients` reusable as-is for its recipient fan-out.
- `prismaRaw` reusable for any cross-org analytics 60-02 needs.
- `EconomicDependencyAlertState` can be pattern-copied for any new state-machine-backed alert (same shape: id + assignmentId unique + lastX timestamps + currentBand enum + three indexes).

**60-03 (DRV expiry 90/30/7d)** can pattern-copy the cron-route shell from `/api/cron/classification-economic-dependency` — same Sentry.withMonitor + withCronMonitor + createCronLogger + metrics.gauge triple.

**60-04 (engagement UI)** can consume `EconomicDependencyBandChip` as its primary band indicator on the engagement page + contractor dashboard tile.

## Self-Check: PASSED

Verified all claimed artifacts exist:
- `packages/db/src/raw.ts` FOUND
- `packages/api/src/services/rbac-recipients.ts` FOUND
- `packages/api/src/services/economic-dependency-scan.ts` FOUND
- `packages/api/src/routers/economic-dependency-alert.ts` FOUND
- `apps/web/src/app/api/cron/classification-economic-dependency/route.ts` FOUND
- `apps/web/src/components/contractors/classification/economic-dependency-alerts/band-chip.tsx` FOUND
- Commits `fb391b2a` + `2fd60052` both present in `git log`

---
*Phase: 60-classification-polish*
*Completed: 2026-04-14*
