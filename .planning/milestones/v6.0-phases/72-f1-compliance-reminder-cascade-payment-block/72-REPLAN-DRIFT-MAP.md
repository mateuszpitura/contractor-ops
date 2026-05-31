# Phase 72 Replan — Verified Current-Tree Drift Map

**Generated:** 2026-05-31 (branch `audit/post-migration-parity`)
**Why:** Plans 72-01..08 + RESEARCH.md + PATTERNS.md authored 2026-04-27, BEFORE the web migration. Paths reference a tree that no longer exists.

This file is the authoritative path-correction reference for the replanned PLAN.md files. Every entry below was verified by reading the current tree, not from memory.

## App-layer moves

| Stale (pre-migration) | Current (verified) | Notes |
|---|---|---|
| `apps/web` (Next.js) | `apps/web-vite` (React + Vite SPA) | Page→Container→Hook→Component; `react-i18next`, TanStack Router, tRPC v11 client. No `next-intl`, no `next/link`. |
| `apps/web/src/app/api/cron/reminders/route.ts` (Next route) | `apps/cron-worker/src/jobs/handlers/reminders/index.ts` (`remindersHandler`) | Fastify in-process job, registered in `apps/cron-worker/src/jobs/registry.ts` (`name: 'reminders'`, `CRON_REMINDERS_SCHEDULE`). Fans out `evaluateReminderRules` / `detectOverdueTasks` / `detectDrvClearanceExpiries` inside a `prismaRaw.$transaction` guarded by `tryAcquireXactLock(tx,'cron','reminders')`. The Phase 72 4th orchestrator wires in HERE. |
| `apps/web/src/app/api/cron/reminders/reminders-shared.ts` (`claimCronNotificationDedup`) | `apps/cron-worker/src/jobs/handlers/reminders/shared.ts` | Exports `addDays`, `startOfDay`, `claimCronNotificationDedup` (uses `prisma.notificationCronDedup.create`, P2002 → false). **No move into a package is needed** — cron-worker already imports cleanly from `@contractor-ops/api`. The Plan 72-03 "move dedup helper out of apps/web" task is OBSOLETE; instead the API-package service should accept a `claimDedup` fn injection OR import the helper from the cron-worker handler is inverted — see decision below. |
| `apps/web/src/app/api/cron/reminders/drv-clearance-expiries.ts` | `apps/cron-worker/src/jobs/handlers/reminders/drv-clearance-expiries.ts` (`detectDrvClearanceExpiries`) | Smaller-scope band-cascade precedent. |
| `apps/web/src/components/payment/payment-block-modal.tsx` | `apps/web-vite/src/components/payments/` (NEW: `payment-block-modal.tsx`) | Dir is `payments/` (plural). |
| `apps/web/src/components/payment/payment-run-wizard.tsx` (assumed) | **No wizard exists.** Use `apps/web-vite/src/components/payments/new-payment-run-dialog/` | `new-payment-run-dialog-container.tsx`, `step-select-container.tsx`, `step-review-container.tsx`, `step-review.tsx`, `step-confirmation.tsx`. The create + lock-and-export mutations live in hook `apps/web-vite/src/components/payments/hooks/use-payment-run-step-review.ts` via `useResourceMutation`. |
| `apps/web/src/components/contractors/classification/drv-clearance/drv-clearance-panel.tsx` | `apps/web-vite/src/components/contractors/classification/drv-clearance/drv-clearance-panel-container.tsx` (+ `drv-clearance-form.tsx`, hook `hooks/use-drv-clearance.ts`) | UI analog for structured-error + deep-link display. |
| `apps/web/src/components/billing/top-up-dialog.tsx` | (verify in web-vite; modal pattern = shadcn `Dialog` + `DialogBody`/`DialogFooter` per repo Dialog convention) | web-vite Dialog convention: content in `DialogBody` (scroll) + actions in `DialogFooter` (sticky). |
| `apps/web/src/messages/{en,de,pl}/compliance.json` (next-intl per-namespace) | `apps/web-vite/messages/{en,de,pl,ar}.json` (FLAT per-locale, 4 locales incl. `ar` RTL) | Accessed via custom `useTranslations` from `apps/web-vite/src/i18n/` (NOT next-intl). Add a `compliance.paymentBlockModal.*` + `compliance.documentType.*` key group under the appropriate flat-file namespace; mirror existing key structure. Arabic (`ar.json`) must also get keys (RTL locale). |

## packages/api moves

| Stale | Current (verified) | Notes |
|---|---|---|
| `packages/api/src/routers/payment.ts` | `packages/api/src/routers/finance/payment.ts` | Mounted as `payment` in `root.ts` (line 173). Procedures: `create` (~499), `lockAndExport` (~734, action `payment_run.lock_and_export`), `removeFromRun` (~1331), `markAllPaid`, `updateItemStatus`, `cancel`, `importStatement`, etc. **Export mutation is `payment.lockAndExport`, NOT `paymentRun.export`/`exportBankFile`.** Returns `{ run, fileBase64, fileName }`; R2 upload (where used, e.g. BACS) via `putObjectAndSignDownload`. Bank-file generation for BACS lives in `packages/api/src/routers/finance/bacs.ts`. |
| `packages/api/src/routers/approval.ts` | `packages/api/src/routers/core/approval.ts` (+ `core/approval-types.ts`) | Admin mutations to anchor near: `requestClarification` (~1107), `bulkApprove` (~1143), `bulkReject` (~1183). `approve` (~842). New `resumeFromCompliance` goes here. |
| `packages/api/src/routers/classification.ts` | `packages/api/src/routers/compliance/classification.ts` | Phase 72 listeners wire in here. (`packages/api/src/routers/compliance/` also has `classification-dashboard.ts`, `classification-document.tsx`, `reassessment-trigger.ts`, `economic-dependency-alert.ts`.) |
| `packages/api/src/services/approval-engine/` (dir, assumed) | `packages/api/src/services/approval-engine.ts` (SINGLE FILE) | The `operators/` subdir does NOT exist yet — it is to be CREATED at `packages/api/src/services/approval-engine/operators/{registry,index,compliance-critical}.ts`. To create a `approval-engine/` dir alongside the existing `approval-engine.ts` file is fine (TS resolves `approval-engine.ts` and `approval-engine/` separately). The barrel side-effect import in `approval-engine.ts` becomes `import './approval-engine/operators/index.js'`. |

## packages that are CORRECT (no drift)

- `packages/api/src/services/economic-dependency-scan.ts` (+ `__tests__/economic-dependency-scan.test.ts`) — architectural twin, path valid. Cron entry is `apps/cron-worker/src/jobs/handlers/classification-economic-dependency.ts`.
- `packages/api/src/services/notification-service.ts` (`dispatch`) — valid.
- `packages/api/src/services/compliance-supersession.ts` — valid (Phase 71 tx-overload pattern).
- `packages/api/src/services/rbac-recipients.ts` (`resolveRbacRecipients`) — valid.
- `packages/db/prisma/schema/{contractor,approval,payment,audit}.prisma` — valid.
- `packages/db/scripts/push-all-regions.ts` — valid (multi-region migration tool).
- `packages/feature-flags/src/{registry.ts,signoff-registry-flags.ts,signoff-registry-flags.json,signoff-registry-flags-schema.ts}` — valid.
- `packages/compliance-policy/src/{expiry,version,registry,freeze,types,index}.ts` + `policies/` — valid.

## lint-guards layout (different from plan assumption)

Plans assume flat `packages/lint-guards/src/compliance-payment-gate-presence.ts`. Actual layout is **per-guard subdirectory**:
- `packages/lint-guards/src/index.ts` — typed barrel (`runSchemaGuard`, `runLogsGuard`, `runI18nParity` + their `format-offence` + option/offence types).
- `packages/lint-guards/src/schema-guard/{run-guard.ts,format-offence.ts,global-lookup-allowlist.ts}`
- `packages/lint-guards/src/logs-guard/{run-guard.ts,format-offence.ts}`
- `packages/lint-guards/src/i18n-parity/{run-guard.ts,format-offence.ts}`
- Tests: `packages/lint-guards/src/__tests__/{schema-guard,logs-guard,i18n-parity}.test.ts`. Fixtures: `packages/lint-guards/src/__fixtures__/`.

**Correction:** the payment-gate-presence guard should follow the same shape:
- `packages/lint-guards/src/payment-gate-guard/run-guard.ts` (exports `runPaymentGateGuard` returning offences `{file, procedure, line}[]`) + `format-offence.ts`.
- Test: `packages/lint-guards/src/__tests__/payment-gate-guard.test.ts`.
- Export from `packages/lint-guards/src/index.ts`.
- `PAYMENT_WRITE_PROCEDURES` set targets `payment.create` and `payment.lockAndExport` (NOT `paymentRun.*`). The guard reads `packages/api/src/routers/finance/payment.ts`. `addItems`/`updateItems` do NOT exist as create-time payment-write entry points (there is `removeFromRun`, `markAllPaid`, `updateItemStatus`) — scope the set to create + lockAndExport.

## Cron dedup architecture decision (resolves obsolete Plan 72-03 task)

OLD plan: move `claimCronNotificationDedup` out of `apps/web` into a package because the API service imported across the app boundary.

NEW reality: dedup helper lives in `apps/cron-worker/src/jobs/handlers/reminders/shared.ts`; the API-package service `compliance-reminder-scan.ts` must NOT import from an app. Cleanest fix: the dedup helper is trivial (`prisma.notificationCronDedup.create` + P2002 guard). Put the canonical helper in `packages/api/src/services/cron-dedup.ts` (or reuse an existing API-layer dedup if one exists — verify) and have the cron-worker `shared.ts` re-export from it, OR keep `shared.ts` as-is and have the API service own its own copy of the 6-line helper (no cross-boundary import). Recommend: API service owns `claimComplianceReminderDedup` locally in `compliance-reminder-scan.ts` (or a sibling `packages/api/src/services/cron-dedup.ts`), since the API package cannot depend on `apps/cron-worker`. The cron-worker `index.ts` calls `runComplianceReminderScan()` as a 4th `Promise.all` member inside the existing reminders tx.

## Wiring entry-point (replaces Plan 72-08 cron-route task)

Wire `runComplianceReminderScan` into `apps/cron-worker/src/jobs/handlers/reminders/index.ts` `remindersHandler` — add to the existing `Promise.all([...])` inside the `prismaRaw.$transaction`, extend the returned `result` object + `metrics.gauge('cron.reminders.compliance_reminder_fires'|'...digests', n)`. Update test `apps/cron-worker/src/jobs/handlers/reminders/__tests__/*` (verify exact test path during planning). NO Next.js route, NO schedule string in the handler (schedule is env-driven via `CRON_REMINDERS_SCHEDULE` in `registry.ts`).
