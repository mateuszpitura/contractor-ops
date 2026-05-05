# Async Processing & Notifications Audit

Scope: Upstash QStash producers/consumers, cron jobs, notification dispatch, idempotency, retry, dead-letter, and fanout patterns. Read-only review.

## Executive summary

The QStash integration is functional but built around a **per-route bespoke pattern**: every consumer rolls its own request parsing, signature verification wrapper, error mapping and dedup strategy. There is **no canonical "enqueue" helper** — each producer hand-writes `getQStashClient().publishJSON({ url: \`${...NEXT_PUBLIC_APP_URL}/api/...\`, body, retries })`, with retries/timeout values varying between 2 and 3 across call sites. There is **no shared payload contract registry**, only `satisfies` annotations at one site (zatca-submission). Idempotency is implemented well in two places (webhooks `_process` claim row, Stripe `Serializable` tx) and missing or weak in most others (OCR, KSeF, GW sync, late-interest PDF, Peppol outbound, all reminder dispatches). The largest correctness gap: **the Steuerberater-required ZATCA submission queue points at `/api/zatca/_submit` which does not exist** — `queueZatcaSubmission` is dead code that returns 200 to the user but never causes a submission.

Notifications use a **fire-and-forget `dispatch()` outside any DB transaction**, so a process crash between the DB write and `dispatch()` silently drops the notification — there is no outbox table. Every call site swallows errors with `.catch(_err => { /* fire-and-forget */ })`. Dedup exists only as a 60-second findFirst window per user+type+entityId in `notification-service.ts:212-219`, which is racy under at-least-once delivery (two concurrent QStash retries can both pass the lookup and double-fire). Cron-driven dedup uses two different mechanisms (`ReminderInstance @@unique` vs `Notification.findFirst`) inconsistently.

QStash retry semantics are **inverted in several places**: routes that catch business errors and 500 will retry forever (Peppol inbound 500s on missing connection, OCR `_process` 500s on any extraction error). Conversely the webhooks `_process` route correctly distinguishes claim-state. Three serverless routes use `setInterval` for in-memory cleanup (broken on Render serverless containers and harmful under multi-instance). No `maxDuration` is set on any QStash consumer despite KSeF sync iterating an unbounded invoice list and trial-notifications scanning every TRIALING subscription serially.

Cron jobs largely lack idempotency under concurrent runs (no advisory lock around `evaluateReminderRules`, `runReassessmentTriggerScan`, `handleTrialNotifications`, `data-purge`). Only KSeF / Google Workspace orchestrators take a Postgres advisory lock.

## Queue consumer matrix

| Route | Idempotent? | Dedup mechanism | Error → status | Timeout safety | Issues |
|---|---|---|---|---|---|
| `/api/webhooks/_process` | Yes | `WebhookDelivery.deliveryStatus` PROCESSED check + atomic `updateMany RECEIVED→PROCESSING` claim | catch → 500 (retry) | None — Jira/Linear handler chain unbounded; `await import()` chains add latency | Per-provider mutations (Jira/Linear) inside the try are NOT individually idempotent — a partial completion that throws after Jira sync but before Resend intake will retry the whole chain |
| `/api/ocr/_process` | Weak | None — re-entry overwrites OcrExtraction status | catch → 500 (retry) | No `maxDuration`; sync R2 download + Claude API call can exceed 60s | Returning 500 on a permanently-bad PDF will retry until QStash gives up; `retryCount: { increment: 1 }` only updated on caught error, no max-retries cap |
| `/api/ksef/_sync` | Yes (orchestrator-level) | `tryAcquireAdvisoryLock` on `ksef-sync:${connectionId}` + `findFirst externalInvoiceId` per invoice | catch → 500 (retry) | No `maxDuration`; iterates `invoiceMetadataList` serially in `for…of`, single sync can exceed serverless timeout; lock held for whole loop (advisory lock released?) | `lockKey` is per-connection but lock released only in `finally`; if request is killed by serverless timeout the connection is closed and Postgres releases automatically — OK |
| `/api/google-workspace/_sync` | Yes | `tryAcquireAdvisoryLock` on `google-workspace-sync:${connectionId}` | catch → 500 (retry) | No `maxDuration`; `listAllDirectoryUsers` paginates entire org directory | Notification fan-out for new hires/departures is sequential `dispatch()` per user — see F-ASYNC-09 |
| `/api/peppol/inbound` | Partial | `PeppolOrchestrator.processInboundInvoice` checks `aspTransmissionId` | NO active connection → 200 (correct); other error → 500 (retry) | No `maxDuration` | `findUniqueOrThrow` on missing delivery throws into the try → 500 → infinite retry of a delivery that no longer exists |
| `/api/peppol/outbound` | NO | None — no check whether transmission already submitted | All errors → 200 (no retry) | No `maxDuration` | Returning 200 on every error means transient Storecove outages drop the submission permanently; "transmission record marked FAILED in orchestrator" is asserted but no manual retry path documented |
| `/api/peppol/poll` | Weak | Relies on `processInboundInvoice` `aspTransmissionId` dedup | catch → 500 (retry whole batch) | Unbounded — iterates ALL `peppolParticipant` rows serially when no `organizationId` arg | A single org's poll failure does not abort the run (per-org try/catch), but a global outer `try` wraps the entire participant loop and a top-level error retries the whole thing — see F-ASYNC-04 |
| `/api/late-interest/_render-claim-pdf` | Weak | None — re-entry can re-render and re-upload to R2 | catch → 500 (retry) | No `maxDuration` | Reaper at `cron/late-interest-pdf-reaper` re-enqueues stuck rows but worker has no claim guard, so two QStash deliveries can race and produce 2× R2 writes |
| `/api/cron/inpost-status-poll` | Weak | None | Always returns 200, all errors swallowed via per-carrier `.catch()` | Unbounded — iterates ALL orgs with any `courierConfig` | Carrier failures silently swallowed (returns `{ checked: 0, updated: 0 }`); no metrics, no Sentry capture |
| `/api/zatca/_submit` (advertised) | N/A | N/A | N/A | N/A | **ROUTE DOES NOT EXIST** — `queueZatcaSubmission` (zatca-submission.ts:308) publishes to a non-existent path. See F-ASYNC-01 |

## Findings

### F-ASYNC-01 — `queueZatcaSubmission` publishes to a non-existent route — ZATCA submissions silently dropped
Severity: **Critical**

`packages/api/src/services/zatca-submission.ts:308-324` publishes a QStash job to `${appUrl}/api/zatca/_submit`, but no consumer route exists at that path:

```bash
$ find apps/web/src/app/api/zatca -type f
# (no results)
```

The producer is wired into `packages/api/src/routers/compliance/zatca.ts:190` (the only call site). User-facing tRPC mutation succeeds (QStash accepts the publish), the user sees "submitted", but the message lands in QStash, retries 3 times against 404, then dies in the QStash DLQ. There is no DB tombstone — the application is unaware. SA's regulatory submission requirement is not met.

Either delete `queueZatcaSubmission` and the router call (if the path was abandoned), or implement the consumer at `apps/web/src/app/api/zatca/_submit/route.ts` wrapping `handleZatcaSubmissionJob` with `verifySignatureAppRouter`.

### F-ASYNC-02 — No canonical "enqueue" helper; every producer hand-rolls `publishJSON` with mismatched config
Severity: **High**

QStash producers spread across 6+ files all call `getQStashClient().publishJSON({...})` directly, with different retry counts, timeouts, and URL conventions:

- `packages/integrations/src/services/webhook-dispatcher.ts:73` — `retries: 3`, no timeout
- `packages/api/src/services/ocr-extraction.ts:53` — `retries: 2, timeout: '60s'`
- `packages/api/src/services/zatca-submission.ts:315` — `retries: QSTASH_CONFIG.retries (3), delay: QSTASH_CONFIG.delay`
- `packages/api/src/routers/integrations/ksef.ts:234` and `peppol.ts:125` (schedule create) — no `retries` in the immediate publish, `retries: 2` on the schedule
- `packages/api/src/routers/integrations/google-workspace.ts:352` — no `retries`, no `timeout`
- `packages/api/src/routers/finance/late-payment-interest.ts:529` — `retries: 3, timeout: '60s'`
- `apps/web/src/app/api/cron/late-interest-pdf-reaper/route.ts:133` — `retries: 3, timeout: '60s'`

There is no payload type registry — only `zatca-submission.ts:320` uses `satisfies ZatcaSubmissionJobPayload`. Consumers re-derive the shape with ad-hoc Zod schemas in each route file. This is a recipe for silent payload drift the moment a producer changes a field name.

Recommended: introduce `packages/integrations/src/services/qstash-jobs.ts` exporting `enqueue<JobName extends keyof JobRegistry>(name, payload, opts?)` with a typed payload registry shared by producers and consumers. Centralise `retries`, `timeout`, `delay`, `deduplicationId` defaults.

### F-ASYNC-03 — Notifications are NOT outboxed; in-app rows can be lost on crash
Severity: **High**

`packages/api/src/services/notification-service.ts:225-238` writes the `Notification` row (in-app) outside the same DB transaction as the event that triggered it:

- `packages/api/src/routers/finance/invoice.ts:467-489` — invoice created in `prisma.$transaction(...)`, then `dispatch()` fired AFTER tx with `.catch(_err => { /* fire-and-forget */ })`. A crash between commit and `dispatch()` permanently loses the INVOICE_RECEIVED notification.
- `packages/api/src/routers/core/approval.ts:110-127, 156-176, 1242` — same pattern for APPROVAL_DECISION and APPROVAL_REQUEST: `dispatch().catch(_err => {})`.
- `packages/api/src/routers/workflow/workflow-execution.ts:543-560` — TASK_ASSIGNED loop after `prisma.$transaction(...)`.
- `packages/api/src/services/billing-webhook.ts:416, 488, 637` — `void dispatch(...).catch(...)` inside Stripe webhook tx (notification will fire even if outer tx rolls back? actually `void` makes it fire-and-forget, see F-ASYNC-13).

The schema has no outbox/event-log model. Recommendation: introduce a `NotificationOutbox` model (id, type, payloadJson, status, createdAt, processedAt, attempts, lastError) written in the same `$transaction` as the trigger event, then drained by a dedicated QStash worker. This also fixes F-ASYNC-04 (notification dedup race) by giving you a stable event ID to dedupe on.

### F-ASYNC-04 — Notification dedup is racy; QStash at-least-once will double-send
Severity: **High**

`packages/api/src/services/notification-service.ts:212-221`:
```ts
const duplicate = await prisma.notification.findFirst({
  where: { userId, type: event.type, entityId: event.entityId, createdAt: { gte: dedupCutoff } },
});
if (duplicate) return;
```

This is a classic `findFirst → if-not-exists → insert` TOCTOU. Two concurrent QStash retries (or two concurrent reminder cron-runs from a duplicated cron schedule) both observe `duplicate = null` and both insert. The Notification model has no unique index that would prevent the dupe at the DB level (`packages/db/prisma/schema/notification.prisma:3-23`).

Compare with `ReminderInstance` which has `@@unique([reminderRuleId, entityType, entityId, scheduledFor])` (notification.prisma:97) — the right pattern. Or `NotificationCronDedup` which uses a unique `dedupeKey` (notification.prisma:104-108) but is referenced by no service code visible in this audit.

Recommendation: add `@@unique([userId, type, entityId, dedupBucket])` where `dedupBucket` = floor(createdAt / 60s), and rely on Prisma's unique-violation error to catch duplicates.

### F-ASYNC-05 — `WebhookDelivery` has no retry/attempt counter; PROCESSING-stuck rows can only be guessed at
Severity: **Medium**

`packages/db/prisma/schema/integration.prisma:81-98` — `WebhookDelivery` has no `attempts`, `lastError`, `nextAttemptAt`, or `maxAttempts` fields. The `_process` handler claims rows by flipping RECEIVED → PROCESSING (`apps/web/src/app/api/webhooks/_process/route.ts:78-92`) and the `cron/job-health` route's "stale" detector (`route.ts:58-101`) assumes anything stuck in PROCESSING > 15min is a crashed worker.

Problem: a slow handler that legitimately needs 20min (Jira pull-request enrichment, e-sign completion ZIP generation) will be marked FAILED by the health check, then the next QStash retry of the same job tries the same delivery and is skipped because PROCESSED-or-FAILED checks succeed (`route.ts:68-71`). Net: legit slow webhook is permanently lost.

Recommendation: add `attempts Int @default(0)`, `lastErrorAt`, `nextAttemptAt` to `WebhookDelivery`. The job-health check should base "stale" on `attempts < maxAttempts` and `nextAttemptAt < now`, not just elapsed wallclock.

### F-ASYNC-06 — Reminders cron is not concurrency-safe; overlapping runs double-fire all rules
Severity: **Medium**

`apps/web/src/app/api/cron/reminders/route.ts:387-435` runs `evaluateReminderRules + detectOverdueTasks + detectDrvClearanceExpiries` in `Promise.all`. There is no advisory lock around the cron itself. If a slow run is still scanning when the next 09:00 UTC tick fires (or if the external scheduler retries due to a transient 5xx), two concurrent runs both walk every active rule.

For `evaluateReminderRules`, the `ReminderInstance @@unique` guards against duplicate DB rows, but the `dispatch()` call on lines 105-115 (`processRuleEntities`) happens AFTER the `findFirst` and BEFORE the `updateMany`, so two workers can both see PENDING and both call `dispatch()` once before the second instance fails the unique-create guard. Result: 2× emails per reminder.

For `detectOverdueTasks` (lines 256-319), dedup is `Notification.findFirst within 24h` — same race as F-ASYNC-04.

Recommendation: wrap the cron handler in `tryAcquireAdvisoryLock('cron:reminders')` like `ksef-sync-orchestrator.ts:230` does.

### F-ASYNC-07 — `trial-notifications` cron is not concurrency-safe and not idempotent
Severity: **Medium**

`apps/web/src/app/api/cron/trial-notifications/route.ts:102-152` iterates every TRIALING subscription, computes `daysUntilTrialEnd`, and calls `sendTrialNotification` (which dispatches in-app + sends an email). There is **no dedup** — if the cron runs twice on the same day (timezone shift, retry, manual re-trigger), every TRIALING org with `daysUntilTrialEnd ∈ {1, 7}` gets two emails to `billingEmail`.

Notification dispatch has the racy 60-second window dedup (F-ASYNC-04), but `sendAppEmail` (line 90) is fully fire-and-forget with no idempotency key — Resend will accept the duplicate.

Recommendation: write a `NotificationCronDedup` row (already exists in schema) keyed `trial-end:${subscriptionId}:${daysUntilTrialEnd}:${YYYY-MM-DD}` before sending, and short-circuit on unique-violation.

### F-ASYNC-08 — Peppol outbound returns 200 on every error — QStash never retries transient Storecove failures
Severity: **High**

`apps/web/src/app/api/peppol/outbound/route.ts:78-85`:
```ts
} catch (error) {
  log.error({ err: error, organizationId, invoiceId }, 'outbound processing failed');
  // Return 200 to prevent QStash retry on business errors
  return NextResponse.json({ error: ... });
}
```

The comment claims "the transmission record is already marked FAILED in the orchestrator" but the catch fires whether the failure is a 500 from Storecove (transient, retry-worthy), a credential decryption failure (auth, not retry-worthy), or a missing-participant DB error (permanent). All collapse to 200 → no retry.

Real-world impact: Storecove returning 502 once during a deploy permanently fails an outbound invoice. There is no operator-visible retry path.

Compare with `packages/api/src/services/zatca-submission.ts:272-301` which classifies errors via `ZatcaApiError.errorType ∈ {retryable, non-retryable, auth}` and re-throws only retryable ones — that's the right pattern. Adopt the same here.

### F-ASYNC-09 — Fan-out via `for…of dispatch()` is unbounded and unbatched
Severity: **Medium**

Multiple cron / sync paths fan out per-recipient or per-entity sequentially:

- `packages/api/src/services/economic-dependency-scan.ts:284-349` — `for (const assignment of assignments)` over EVERY active DE contractor assignment (cross-tenant), with `await dispatch(...)` inside; recipient `resolveRbacRecipients` runs per assignment.
- `packages/api/src/services/notification-service.ts:191-193` — `for (const userId of event.recipientUserIds) await dispatchToUser(...)` is sequential, each user incurring up to 3 await points (prefs, dedup, in-app insert) plus a Resend HTTP call.
- `apps/web/src/app/api/cron/trial-notifications/route.ts:127-141` — sequential for-loop over all trialing subs.
- `apps/web/src/app/api/cron/inpost-status-poll/route.ts:64-67` — sequential for-loop over all orgs with courier configs.

At 1000 contractors × 3 admin recipients × ~150ms per dispatch ≈ 7.5min — well over serverless timeout, and no `maxDuration` is set anywhere. No batching with `Promise.allSettled` chunks, no throttling, no rate-limit observation against Resend.

Recommendation: introduce a fan-out helper that chunks (e.g. 20 in parallel) and passes individual jobs back through QStash for the per-recipient leg.

### F-ASYNC-10 — `setInterval` in serverless code (broken on Render, harmful under multi-instance)
Severity: **Medium**

Serverless functions on Render/Vercel are scaled per-request and can be torn down between invocations; `setInterval` cleanup loops never run reliably. Found:

- `packages/api/src/routers/finance/payment.ts:60` — `setInterval(cleanup, 60_000).unref?.()` for in-memory idempotency cache (`idempotencyCache` Map, line 50). Multi-instance: two pods both accept the same idempotency key.
- `packages/api/src/middleware/classification-rate-limit.ts:70` — same pattern for rate-limit window.
- `packages/api/src/services/resend-email-intake.ts:60` — same for email intake rate limit.
- `packages/api/src/services/api-key-service.ts:170-177` — same for `lastTouchedAt` debounce map.
- `packages/api/src/routers/core/contractor.ts:1225` — `await new Promise(resolve => setTimeout(resolve, 2000))` blocking inside a tRPC procedure (just a delay, but burns serverless seconds).

In-memory state that pretends to be cross-request idempotent is actively dangerous. Move to Redis (Upstash already in stack) or a DB-backed table with a unique key.

### F-ASYNC-11 — Cron jobs lack last-run cursors except `reassessment-trigger-scan`
Severity: **Medium**

Only `runReassessmentTriggerScan` (`packages/api/src/services/reassessment-trigger-scan.ts:273, 359-363`) persists a `CronScanState` cursor. Other cron jobs that conceptually need a "since last run" cursor:

- `economic-dependency-scan` (rolling 12-month window — recomputes from scratch every run; OK because the window is wall-clock not run-relative).
- `data-purge` (uses `cutoff = now - RETENTION_DAYS`, so no cursor needed).
- `late-interest-pdf-reaper` (uses `STALE_AFTER_MS` — OK).
- `reminders` (computes today + offsetDays; OK because `ReminderInstance` per-day uniqueness handles retransmission).
- `trial-notifications` (recomputes per-day from `trialEnd` — but no cursor + no dedup → see F-ASYNC-07).
- `boe-rate-poll` (poller writes upsert; presumably OK).
- `token-refresh` (proactive 30min window — no cursor needed).

For cron-style scans that need "process audit entries since X", the `CronScanState` table pattern is good and should be adopted rather than reinventing per scan.

### F-ASYNC-12 — Orphaned QStash schedules on disconnect failure
Severity: **Medium**

`packages/api/src/routers/integrations/ksef.ts:191-197` and `peppol.ts:191-197` and `google-workspace.ts` all swallow the `qstash.schedules.delete()` error:

```ts
try {
  await qstash.schedules.delete(scheduleId);
} catch (_error) {
  /* fire-and-forget */
}
```

If QStash is briefly down during a disconnect, the schedule continues to fire forever, hitting `_sync` for a connection that no longer exists. The downstream handler then either errors (loop), or (if the connection lookup returns nothing) silently does nothing while QStash bills for the schedule.

Worse: schedule creation on connect is also `try/catch _error` (`ksef.ts:159`, `peppol.ts:144`, `google-workspace.ts` similar) → connection appears CONNECTED with no schedule, so no syncs run; user has to disconnect/reconnect to recover.

Recommendation: store schedule-create failures on `IntegrationConnection.lastErrorMessage` and surface "schedule unhealthy" in the UI; back orphaned-schedule cleanup with a periodic job that lists `qstash.schedules.list()` and removes ones whose connection is gone.

### F-ASYNC-13 — `void dispatch()` inside Stripe webhook tx fires even on rollback
Severity: **Medium**

`packages/api/src/services/billing-webhook.ts:416, 488, 637` use `void dispatch(...)` inside `routeStripeEvent` which itself runs inside a `Serializable` $transaction (`apps/web/src/app/api/webhooks/stripe/route.ts:58-95`). Because `dispatch()` doesn't take the `tx` client and writes directly to `prisma`, and because `void` detaches the promise from the transaction's await chain, three consequences:

1. The notification's `Notification` insert lands on the global `prisma` connection, not the tx — so the transaction's isolation boundary is violated (read-your-writes will not see it from inside the tx, and an outer tx rollback won't roll back the dispatch's writes).
2. If the outer Stripe tx rolls back, the user already received "your subscription changed" email/in-app while the DB state reverted.
3. The `void` makes the promise unawaited, so an exception inside `dispatch()` becomes an unhandled rejection (Node's `--unhandled-rejections=strict` will crash the process — Render default).

Recommendation: make `dispatch` accept an optional `tx` client and gate-fire it AFTER the `prisma.$transaction(...)` resolves, with proper `await + try/catch`.

### F-ASYNC-14 — Notification preferences honored only at dispatch; channel routing leaks org-scope
Severity: **Low/Medium**

`packages/api/src/services/notification-service.ts:84-114` (`getOrCreatePreferences`) keys preferences on `(userId, notificationType)` only — there's no organizationId in the unique key (`@@unique([userId, notificationType])` in notification.prisma:41). For users who are members of multiple orgs (which the codebase allows — `Member` model), changing email-channel for "INVOICE_RECEIVED" in Org A also disables it in Org B. The preference row stores `organizationId` as the org where the row was first auto-created.

For channel routing, `dispatchChannelAlerts` (line 311-339) loops over connected providers and resolves a single channel mapping per category — if both Slack and Teams are connected for the same org, both fire (correct), but `resolveChannelId` returns `null` if the mapping is missing (line 358), silently dropping the alert with no log.

### F-ASYNC-15 — Late-interest PDF render is not idempotent under retry; can produce 2× R2 writes
Severity: **Medium**

`apps/web/src/app/api/late-interest/_render-claim-pdf/route.ts` calls `renderClaimPdf(claimId)` directly with no PROCESSING-claim guard. The reaper at `apps/web/src/app/api/cron/late-interest-pdf-reaper/route.ts:113-147` re-enqueues stuck PENDING_RENDER rows after 10min if no `pdfKey`:

```ts
await getQStashClient().publishJSON({ url: qstashUrl, body: { claimId, organizationId }, retries: 3 });
```

QStash's first delivery worker may still be running when the reaper re-enqueues. Both deliveries call `renderClaimPdf`, both upload to R2 (different storage keys? same? — would need to read `renderClaimPdf` to confirm), and the second `pdfKey: null → READY` update wins. Best case: an orphaned R2 object. Worst case: download URL points to whichever object the reader race observed.

Recommendation: at the top of the worker, atomic compare-and-swap `pdfStatus PENDING_RENDER → RENDERING` via `updateMany`; bail with 200 if claim count is 0.

### F-ASYNC-16 — OCR `_process` returns 500 on every failure → forever-retry on permanently-bad PDFs
Severity: **Medium**

`apps/web/src/app/api/ocr/_process/route.ts:52-55`:
```ts
} catch (error) {
  log.error({ err: error, extractionId }, 'ocr processing failed');
  return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
}
```

QStash retries non-2xx with exponential backoff up to its configured max (`retries: 2` in producer at `ocr-extraction.ts:60`). After 3 attempts the message dies in the QStash DLQ and **nothing in the app knows**. The `OcrExtraction.retryCount` is incremented at `ocr-extraction.ts:161` only when `processOcrExtraction` itself catches — for failures in `processOcrExtraction` that bubble up to the route catch, no DB update happens; the row sits at PROCESSING forever.

Two issues:
1. Permanent failures (corrupt PDF, unsupported format, OCR adapter exception) should classify as non-retryable and return 200 with the row marked FAILED, not 500.
2. There is no DLQ table — when QStash gives up, no operator alert.

Recommendation: implement an `error → response status` classifier in the consumer; add an `ocrFailedStuck` reaper similar to `late-interest-pdf-reaper`.

### F-ASYNC-17 — `cron-monitor` is observability only — no queue depth, no per-job timing histogram
Severity: **Low**

`packages/api/src/services/cron-monitor.ts` only fires Cronitor heartbeats (`run`/`complete`/`fail`). The `metrics.gauge('cron.X.sent', n)` calls in individual cron handlers are inconsistently labeled and not attached to any timing histogram. There is no:

- QStash queue-depth gauge (job-health route counts only `WebhookDelivery` PENDING/PROCESSING, not other QStash topics).
- Per-job duration histogram (job runtimes are only visible via Cronitor pings).
- Last-success-at table queryable from ops dashboards.

Operators rely on Sentry crons + Cronitor — both external services with separate auth. Recommendation: a single `JobRun` table written by a `withJobObservability(jobName, fn)` wrapper would centralize metrics, error logs, and a UI surface.

### F-ASYNC-18 — KSeF and Google Workspace sync schedules created with `retries: 2` — quiet QStash DLQ for whole-org syncs
Severity: **Low/Medium**

`packages/api/src/routers/integrations/ksef.ts:138-146`:
```ts
await qstash.schedules.create({
  destination: ..., cron: '0 * * * *',
  body: JSON.stringify({ organizationId, connectionId }),
  retries: 2,
});
```

After 2 retries on a transient KSeF outage (their gov-API stability is poor), the hourly cron message is dropped. The next hourly tick will recover, but if the orchestrator's `lastSuccessAt` cursor advances on START rather than COMPLETION (need to verify in `updateConnectionAfterSync` logic — currently it advances `lastSyncAt` always, `lastSuccessAt` only on success — OK), there is no compounding loss. However, if the KSeF outage spans multiple hours and the orchestrator's `dateFrom = lastSuccessAt` is stuck, the eventual catch-up sync may exceed serverless timeout because the date range is now large.

Recommendation: cap `dateTo - dateFrom` at e.g. 7 days per cron tick and re-enqueue a continuation if more remains.

---

## Cross-cutting observations

1. **No Redis usage anywhere.** Idempotency caches and rate-limit windows live in process memory (F-ASYNC-10), which is wrong for any multi-instance serverless deployment. Upstash Redis is already an org-acceptable vendor (QStash is theirs).

2. **`prisma` (default tenant-aware) vs `prismaRaw` (cross-tenant) split is well-disciplined** in classification cron jobs — every cross-org aggregate is tagged `// PHASE-60-CROSS-ORG-AGGREGATE`. This is best-practice and should be the template for future cross-tenant work.

3. **`verifySignatureAppRouter` is consistently applied** to every QStash consumer route except `cron/inpost-status-poll` (apps/web/src/app/api/cron/inpost-status-poll/route.ts:122 — actually it IS verified, ignore). All other `/api/cron/*` endpoints rely on `Bearer CRON_SECRET` via `timingSafeEqual` — correct constant-time compare.

4. **Sentry cron monitor + Cronitor heartbeat double-instrumentation** is overkill but acceptable. Consider standardising on one.

5. **`retries: 2` vs `retries: 3` inconsistency** between producers suggests no team-wide policy. Settle on a default (3 with exponential backoff for I/O bound, 0 for non-idempotent submissions where the consumer must be the idempotency boundary).
