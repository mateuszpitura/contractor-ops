---
title: Cron worker jobs
type: structure
tags: [structure, cron, background]
source_commit: f0779951
source_commit: f9de62452
source_commit: 28061f01e
verify_with:
  - apps/cron-worker/src/jobs/handlers/
  - apps/cron-worker/src/jobs/handlers/reminders/wt-limit-scan.ts
  - packages/api/src/services/wt-limit-scan.ts
  - apps/api/src/lib/qstash-route.ts
  - packages/db/prisma/schema/cron.prisma
updated: 2026-07-05
---

# Cron worker jobs

## Purpose

`apps/cron-worker` runs QStash-triggered and scheduled background work. Shared business logic stays in `packages/api/src/services/`.

## Flow

```mermaid
sequenceDiagram
  participant Render as Render cron
  participant API as apps/api
  participant QStash as QStash
  participant Worker as cron-worker
  Render->>API: trigger route
  API->>QStash: enqueue
  QStash->>Worker: callback
  Worker->>Worker: handler in jobs/handlers/
```

## Entry points

| Handler | Path | Domain |
|---------|------|--------|
| `exchange-rates.ts` | ECB daily rates | [[integrations/einvoice-profiles]] |
| `boe-rate-poll.ts` | BoE base rate | [[domains/payments-and-bank-files]] |
| `compliance-reminder.ts` | compliance renewals | [[domains/compliance-dashboard]] |
| `classification-economic-dependency.ts` | §2 SGB VI scan | [[domains/classification-ir35]] |
| `form-1099k-tracker.ts` | informational 1099-K band scan (`module.us-expansion`; never files) | [[domains/us-tax-forms]] |
| `year-end-1099-reminder.ts` | notify-only 1099-NEC batch-due reminder (`module.us-expansion`; **never generates or transmits**; mid-January, deduped per tax year) | [[domains/us-tax-year-end-filing]] |
| `classification-reassessment-triggers.ts` | IR35 triggers | [[domains/classification-ir35]] |
| `reminders/` + `drv-clearance-expiries.ts` | DRV expiry | [[domains/classification-ir35]] |
| `reminders/wt-limit-scan.ts` (`runWtLimitScan`) | daily working-time-limit scan — region fan-out, per-worker rolling weekly average, ONE `employee.wt_limit_breach` digest per recipient/day (region-prefixed dedup key); `module.workforce-employees` | [[domains/leave-and-time]] |
| `reminders/index.ts` (+ `drv-clearance-expiries.ts`) | reminder-rule fan-out, overdue workflow tasks, DRV expiry | [[domains/notifications-and-reminders]] |
| `reminders/index.ts` (+ `drv-clearance-expiries.ts`, `approval-sla.ts`) | reminder-rule fan-out, overdue workflow tasks, DRV expiry, approval-SLA escalation | [[domains/notifications-and-reminders]] |
| `token-refresh.ts` | OAuth token refresh | [[integrations/framework-core]] |
| `org-definition-sync.ts` | org definitions | [[domains/settings-and-org-admin]] |
| `hris-sync.ts` (`runScheduledHrisSync`, `CRON_HRIS_SYNC_SCHEDULE` hourly) | HRIS two-way sync — fan-out over CONNECTED Personio/BambooHR connections, `lastSyncAt` throttle, per-connection `tenantStore.run` pull | [[domains/hris-sync]] |
| `trial-notifications.ts` | billing trial | [[domains/billing-and-feature-gates]] |
| `stripe-reconcile.ts` | daily Stripe subscription status/tier drift repair (`0 1 * * *`; `CRON_STRIPE_RECONCILE_SCHEDULE`) | [[integrations/stripe-billing]] |
| `data-purge.ts` | GDPR retention | [[domains/consent-gdpr-pdpl]] |
| `inpost-status-poll.ts` | courier polling | [[domains/equipment-logistics]] |
| `late-interest-pdf-reaper.ts` | LPC PDF cleanup | [[domains/payments-and-bank-files]] |
| `job-health.ts` | cron monitor | [[integrations/qstash-cron]] |

## Invariants

- **Per-job last-success is persisted, not in-memory.** `CronJobRunState` (`packages/db/prisma/schema/cron.prisma`, global/non-tenant, keyed `jobName @unique`, `lastSuccessAt`/`lastRunAt`) survives cron-worker restarts (the previous in-memory `lastSuccessByJob` map was wiped on restart, hiding missed ticks). `job-health.ts` reads it to alert on staleness (`now - lastSuccessAt` beyond the schedule interval) — today job-health watches only `WebhookDelivery`, so a dead cron job is undetected. The runner-side write + health staleness comparison land in a later change set; the table + unique are the schema backstop.
- `createCronLogger` — no `console.*`
- QStash routes: `defineQStashRoute` + Zod body (`apps/api/src/lib/qstash-route.ts`)
- `cronProcedure` with `Authorization: Bearer CRON_SECRET`
- **Reminders handler is crash-safe and overlap-safe.** `reminders/index.ts` fans out its sub-jobs inside one `pg_advisory_xact_lock('cron','reminders')` transaction and runs every read/write on that lock-holding `tx` connection — a tx-timeout that drops the lock also aborts the work, instead of letting it continue on a second pool connection past the released lock. A `ReminderInstance` row is skipped only once `status='SENT'`; a row left `PENDING` (a prior tick's `dispatch` threw before the SENT transition) is **re-dispatched** next tick, so a failed notification is never lost behind the `(reminderRuleId, entityType, entityId, scheduledFor)` unique. Each rule runs in its own try/catch and each fan-out sub-job in a `runIsolated` wrapper, so one poison rule/org can't abort the remaining rules or the sibling sub-jobs (`detectOverdueTasks`, DRV sweep, `detectOverdueApprovals`).
- **Approval-SLA breaches are escalated by this cron, not just shown in the UI.** `reminders/approval-sla.ts` (`detectOverdueApprovals`) mirrors `detectOverdueTasks`: it finds PENDING `ApprovalStep` rows past `slaDeadline`, nudges the assigned approver (24h Notification-table dedup), and after N daily breaches escalates once (guarded by `claimCronNotificationDedup`) to the next chain step's approver. It only notifies — flow-state transitions stay owned by the approval engine (see [[domains/approvals-engine]]).
- **User-facing notification copy is i18n, never hardcoded English.** Cron handlers pass dotted `Notifications.*` keys (into `apps/web-vite/messages/<locale>.json`) as `dispatch({ title, body, metadata })`. `dispatch`'s `resolveEventCopy` resolves them against the org's `Organization.language` (single locale per org, resolved at write time), with `metadata` supplying `{placeholder}` params — used by `reminders/` (contract/invoice/task) and `drv-clearance-expiries.ts`.
- **Bespoke cron emails** that bypass the React-Email pipeline (`trial-notifications.ts` → `sendAppEmail` raw HTML) resolve copy directly via `resolveMessage(key, normalizeLocale(org.language))` from `@contractor-ops/api/i18n/email-i18n` — the same bundle reader the email templates use.
- **`stripe-reconcile.ts` is the entitlement-drift backstop, not the primary path.** Webhooks own subscription state; this daily job pages `stripe.subscriptions.list({ status: 'all' })` and repairs any `Subscription` row whose `status`/`tier` disagrees with Stripe (source of truth). It writes Stripe's value directly but **never touches `lastEventCreated`**, so the webhook out-of-order guard stays intact. Idempotent (a re-run is a no-op on matching rows) and no advisory lock — it makes no in-place decisions, only convergent writes. Reaches Stripe via `@contractor-ops/api/services/stripe-client` (lazy `getServerEnv()`) + `buildSubscriptionData` from `@contractor-ops/billing/webhook`.

## Related

- [[integrations/qstash-cron]]
- [[apps]]

## Verify live

```bash
ls apps/cron-worker/src/jobs/handlers/
semble search "defineQStashRoute"
```

## Agent mistakes

- Duplicating service logic in worker — call `packages/api` services
- Webhook verify fail-open — see [[decisions/tech-debt-hotspots]]
