/**
 * Reminders handler. Fans out:
 *
 *   1. `evaluateReminderRules()` — active `ReminderRule` rows fire on
 *      BEFORE_CONTRACT_END / BEFORE_DUE_DATE / AFTER_DUE_DATE triggers.
 *      Each rule creates a `ReminderInstance` row keyed on
 *      `(ruleId, entityId, entityType, scheduledFor)` and dispatches a
 *      notification to recipients resolved per `recipientMode`
 *      (ENTITY_OWNER / FINANCE_TEAM / ASSIGNEE / SPECIFIC_USER / ROLE).
 *      A row is skipped only once it is SENT; a PENDING row (dispatch threw
 *      last tick) is re-dispatched so a failed notification is never lost.
 *   2. `detectOverdueTasks()` — built-in TASK_OVERDUE detection
 *      with 24h dedup via the Notification table itself.
 *   3. `detectDrvClearanceExpiries()` — DRV clearance expiry sub-job (see
 *      ./drv-clearance-expiries.ts).
 *   4. `detectOverdueApprovals()` — approval-SLA breach nudges + one-shot
 *      escalation to the next chain step (see ./approval-sla.ts).
 *
 * Every sub-job runs on the lock-holding transaction connection (`tx`), so the
 * `pg_advisory_xact_lock` genuinely serializes the guarded reads/writes — a tx
 * timeout that releases the lock also aborts the work on the same connection
 * instead of letting it continue on a second pool connection.
 *
 * Isolation: each fan-out sub-job is wrapped so a throw in one (or a poison
 * rule/org inside `evaluateReminderRules`) cannot abort the others.
 *
 * Outer per-tx `pg_try_advisory_xact_lock` so overlapping ticks can't
 * double-fire reminders. 60s tx timeout / 10s maxWait so a slow Resend
 * dispatch can't hold the lock past the next tick.
 */

import { tryAcquireXactLock } from '@contractor-ops/api/lib/advisory-lock';
import { dispatch } from '@contractor-ops/api/services/notification-service';
import type { Prisma } from '@contractor-ops/db';
import { prismaRaw } from '@contractor-ops/db';
import { gcExpiredProvenance } from '@contractor-ops/idp-saga';
import { metrics } from '@contractor-ops/logger/metrics';
import type { Logger } from 'pino';
import { Sentry } from '../../../lib/sentry.js';
import type { JobHandler } from '../../runner.js';
import { executeComplianceReminderScan } from '../compliance-reminder.js';
import { detectOverdueApprovals } from './approval-sla.js';
import { detectDrvClearanceExpiries } from './drv-clearance-expiries.js';
import { addDays, startOfDay } from './shared.js';
import { executeWtLimitScan } from './wt-limit-scan.js';

type ReminderTx = Prisma.TransactionClient;

const REMINDERS_LOCK_KEY = 'reminders';

interface ReminderEntity {
  id: string;
  label: string;
  contractorId: string | null;
  organizationId: string;
}

type ReminderNotificationType = 'CONTRACT_EXPIRING' | 'INVOICE_RECEIVED';

interface ReminderDispatchParams {
  notificationType: ReminderNotificationType;
  /**
   * Dotted i18n keys into `apps/web-vite/messages/<locale>.json`. The
   * notification dispatcher (`resolveEventCopy`) resolves them against the
   * originating org's `Organization.language`, using `metadata` for the
   * `{label}` placeholder, so in-app + email copy ship in the org locale.
   */
  titleKey: string;
  bodyKey: string;
  entityType: 'CONTRACT' | 'INVOICE';
}

async function resolveRecipients(
  db: ReminderTx,
  organizationId: string,
  recipientMode: string,
  configJson: Record<string, unknown> | null,
  entityOwnerId?: string | null,
): Promise<string[]> {
  switch (recipientMode) {
    case 'ENTITY_OWNER':
      return entityOwnerId ? [entityOwnerId] : [];
    case 'FINANCE_TEAM': {
      const financeMembers = await db.member.findMany({
        where: { organizationId, role: { in: ['FINANCE_ADMIN', 'ACCOUNTANT'] } },
        select: { userId: true },
      });
      return financeMembers.map(m => m.userId);
    }
    case 'ASSIGNEE':
      return entityOwnerId ? [entityOwnerId] : [];
    case 'SPECIFIC_USER': {
      const userId = configJson?.userId as string | undefined;
      return userId ? [userId] : [];
    }
    case 'ROLE': {
      const role = configJson?.role as string | undefined;
      if (!role) return [];
      const members = await db.member.findMany({
        where: { organizationId, role },
        select: { userId: true },
      });
      return members.map(m => m.userId);
    }
    default:
      return [];
  }
}

async function processRuleEntities(
  db: ReminderTx,
  rule: { id: string; organizationId: string; recipientMode: string; configJson: unknown },
  entities: ReminderEntity[],
  dispatchParams: ReminderDispatchParams,
  now: Date,
  today: Date,
): Promise<number> {
  let sent = 0;
  const scheduledFor = startOfDay(today);

  for (const entity of entities) {
    const existing = await db.reminderInstance.findFirst({
      where: {
        reminderRuleId: rule.id,
        entityId: entity.id,
        entityType: dispatchParams.entityType,
        scheduledFor,
      },
    });
    // Already delivered → done. A PENDING row means a prior tick's dispatch
    // threw before the SENT transition; re-dispatch it instead of skipping
    // forever (the unique index also blocks re-create, so the row would
    // otherwise be lost permanently).
    if (existing?.status === 'SENT') continue;

    if (!existing) {
      await db.reminderInstance.create({
        data: {
          organizationId: rule.organizationId,
          reminderRuleId: rule.id,
          entityType: dispatchParams.entityType,
          entityId: entity.id,
          scheduledFor,
          status: 'PENDING',
        },
      });
    }

    const recipientIds = await resolveRecipients(
      db,
      rule.organizationId,
      rule.recipientMode,
      rule.configJson as Record<string, unknown> | null,
      entity.contractorId,
    );

    if (recipientIds.length === 0) continue;

    // Dispatch may throw (email provider outage). Leaving the row PENDING here
    // is intentional — the next tick re-enters this branch and re-sends.
    await dispatch({
      organizationId: rule.organizationId,
      type: dispatchParams.notificationType,
      recipientUserIds: recipientIds,
      title: dispatchParams.titleKey,
      body: dispatchParams.bodyKey,
      entityType: dispatchParams.entityType,
      entityId: entity.id,
      metadata: { label: entity.label },
    });
    sent++;

    await db.reminderInstance.updateMany({
      where: {
        reminderRuleId: rule.id,
        entityId: entity.id,
        entityType: dispatchParams.entityType,
        scheduledFor,
        status: 'PENDING',
      },
      data: { status: 'SENT', sentAt: now },
    });
  }

  return sent;
}

async function findMatchingContracts(
  db: ReminderTx,
  organizationId: string,
  today: Date,
  offsetDays: number,
): Promise<ReminderEntity[]> {
  const targetDate = addDays(today, offsetDays);
  const contracts = await db.contract.findMany({
    where: {
      organizationId,
      endDate: { lte: targetDate, gt: today },
      status: { not: 'TERMINATED' },
      deletedAt: null,
    },
    select: { id: true, title: true, contractorId: true, organizationId: true },
  });
  return contracts.map(c => ({
    id: c.id,
    label: c.title,
    contractorId: c.contractorId,
    organizationId: c.organizationId,
  }));
}

async function findMatchingInvoices(
  db: ReminderTx,
  organizationId: string,
  where: { dueDate: Record<string, unknown> },
): Promise<ReminderEntity[]> {
  const invoices = await db.invoice.findMany({
    where: {
      organizationId,
      dueDate: where.dueDate,
      status: { notIn: ['PAID', 'VOID'] },
      deletedAt: null,
    },
    select: { id: true, invoiceNumber: true, organizationId: true, contractorId: true },
  });
  return invoices.map(inv => ({
    id: inv.id,
    label: inv.invoiceNumber,
    contractorId: inv.contractorId,
    organizationId: inv.organizationId,
  }));
}

interface ReminderRuleRow {
  id: string;
  organizationId: string;
  recipientMode: string;
  configJson: unknown;
  triggerType: string;
  entityType: string;
  offsetDays: number | null;
}

/** Fires a single rule's matching entities. Returns the number of dispatches. */
async function processReminderRule(
  db: ReminderTx,
  rule: ReminderRuleRow,
  now: Date,
  today: Date,
): Promise<number> {
  const offsetDays = rule.offsetDays ?? 0;

  if (rule.triggerType === 'BEFORE_CONTRACT_END' && rule.entityType === 'CONTRACT') {
    const entities = await findMatchingContracts(db, rule.organizationId, today, offsetDays);
    return processRuleEntities(
      db,
      rule,
      entities,
      {
        notificationType: 'CONTRACT_EXPIRING',
        titleKey: 'Notifications.reminders.contractExpiring.title',
        bodyKey: 'Notifications.reminders.contractExpiring.body',
        entityType: 'CONTRACT',
      },
      now,
      today,
    );
  }

  if (rule.triggerType === 'BEFORE_DUE_DATE' && rule.entityType === 'INVOICE') {
    const targetDate = addDays(today, offsetDays);
    const entities = await findMatchingInvoices(db, rule.organizationId, {
      dueDate: { lte: targetDate, gt: today },
    });
    return processRuleEntities(
      db,
      rule,
      entities,
      {
        notificationType: 'INVOICE_RECEIVED',
        titleKey: 'Notifications.reminders.invoiceDueSoon.title',
        bodyKey: 'Notifications.reminders.invoiceDueSoon.body',
        entityType: 'INVOICE',
      },
      now,
      today,
    );
  }

  if (rule.triggerType === 'AFTER_DUE_DATE' && rule.entityType === 'INVOICE') {
    const targetDate = addDays(today, -offsetDays);
    const entities = await findMatchingInvoices(db, rule.organizationId, {
      dueDate: { lte: targetDate },
    });
    return processRuleEntities(
      db,
      rule,
      entities,
      {
        notificationType: 'INVOICE_RECEIVED',
        titleKey: 'Notifications.reminders.invoiceOverdue.title',
        bodyKey: 'Notifications.reminders.invoiceOverdue.body',
        entityType: 'INVOICE',
      },
      now,
      today,
    );
  }

  return 0;
}

async function evaluateReminderRules(
  db: ReminderTx,
  log: Logger,
): Promise<{ processed: number; sent: number; errors: number }> {
  const now = new Date();
  const today = startOfDay(now);
  let processed = 0;
  let sent = 0;
  let errors = 0;

  const activeRules = await db.reminderRule.findMany({ where: { active: true } });

  for (const rule of activeRules) {
    processed++;
    // Per-rule isolation: a poison rule/org (bad recipient config, dispatch
    // throw) must not abort the remaining rules or the sibling sub-jobs.
    try {
      sent += await processReminderRule(db, rule, now, today);
    } catch (err) {
      errors++;
      log.error(
        {
          err: err instanceof Error ? err.message : String(err),
          sub_task: 'evaluate_reminder_rules',
          reminderRuleId: rule.id,
          organizationId: rule.organizationId,
        },
        'reminder rule failed — remaining rules unaffected',
      );
    }
  }

  return { processed, sent, errors };
}

async function detectOverdueTasks(db: ReminderTx): Promise<number> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let notified = 0;

  const overdueTasks = await db.workflowTaskRun.findMany({
    where: {
      dueAt: { lt: now },
      status: { notIn: ['DONE', 'CANCELLED', 'SKIPPED'] },
      assigneeUserId: { not: null },
    },
    select: {
      id: true,
      title: true,
      assigneeUserId: true,
      organizationId: true,
      workflowRun: {
        select: {
          id: true,
          workflowTemplate: { select: { name: true } },
          contractor: { select: { displayName: true } },
        },
      },
    },
  });

  for (const task of overdueTasks) {
    if (!task.assigneeUserId) continue;

    const recentNotification = await db.notification.findFirst({
      where: {
        type: 'TASK_OVERDUE',
        entityType: 'WORKFLOW_TASK_RUN',
        entityId: task.id,
        createdAt: { gte: oneDayAgo },
      },
    });
    if (recentNotification) continue;

    const contractorName = task.workflowRun?.contractor?.displayName?.trim() ?? '';
    const workflowName = task.workflowRun?.workflowTemplate?.name?.trim() ?? '';
    const bodyLabel = workflowName || task.title;

    await dispatch({
      organizationId: task.organizationId,
      type: 'TASK_OVERDUE',
      recipientUserIds: [task.assigneeUserId],
      title: 'Notifications.reminders.taskOverdue.title',
      body: 'Notifications.reminders.taskOverdue.body',
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: task.id,
      metadata: {
        label: task.title,
        detail: bodyLabel,
        contractorSuffix: contractorName ? ` - ${contractorName}` : '',
      },
    });

    notified++;
  }

  return notified;
}

/**
 * IdpChangeProvenance 90-day GC. Isolated try/catch so a GC failure never aborts
 * the other reminder sub-tasks. Cross-org retention sweep — uses the non-tenant
 * raw client and deletes purely by `initiatedAt < now - 90d`.
 */
async function gcIdpProvenance(log: {
  info: (o: unknown, m: string) => void;
  error: (o: unknown, m: string) => void;
}): Promise<number> {
  try {
    const result = await gcExpiredProvenance(prismaRaw);
    log.info(
      { deleted: result.deleted, sub_task: 'idp_provenance_gc' },
      'IdpChangeProvenance GC completed',
    );
    return result.deleted;
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), sub_task: 'idp_provenance_gc' },
      'IdpChangeProvenance GC failed — other cron sub-tasks unaffected',
    );
    return 0;
  }
}

/**
 * Runs a fan-out sub-job so a throw inside it can never reject the shared
 * `Promise.all` (which would abort the sibling sub-jobs). The idempotency
 * guards (ReminderInstance unique index, Notification 24h dedup,
 * claimCronNotificationDedup) make partial progress safe to retry next tick.
 */
async function runIsolated<T>(
  log: Logger,
  subTask: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), sub_task: subTask },
      `reminders sub-task ${subTask} failed — other sub-tasks unaffected`,
    );
    return fallback;
  }
}

export const remindersHandler: JobHandler = async ctx => {
  const start = performance.now();
  try {
    const result = await prismaRaw.$transaction(
      async tx => {
        const acquired = await tryAcquireXactLock(tx, 'cron', REMINDERS_LOCK_KEY);
        if (!acquired) {
          ctx.log.info('another reminders cron tick is in flight; skipping');
          metrics.increment('cron.reminders.skipped_locked');
          return {
            skipped: true as const,
            processed: 0,
            sent: 0,
            ruleErrors: 0,
            overdueTasksNotified: 0,
            drvExpiriesNotified: 0,
            overdueApprovalsNotified: 0,
            idpProvenanceGced: 0,
            complianceReminderFires: 0,
            complianceReminderDigests: 0,
            wtLimitBreaches: 0,
            wtLimitDigests: 0,
          };
        }

        // Every DB-reading sub-job runs on `tx` — the lock-holding connection —
        // so the advisory lock actually covers the guarded reads/writes.
        const [
          ruleResults,
          overdueTasksNotified,
          drvExpiriesNotified,
          overdueApprovalsNotified,
          idpProvenanceGced,
          complianceReminderResult,
          wtLimitScanResult,
        ] = await Promise.all([
          runIsolated(
            ctx.log,
            'evaluate_reminder_rules',
            () => evaluateReminderRules(tx, ctx.log),
            {
              processed: 0,
              sent: 0,
              errors: 0,
            },
          ),
          runIsolated(ctx.log, 'detect_overdue_tasks', () => detectOverdueTasks(tx), 0),
          runIsolated(ctx.log, 'detect_drv_expiries', () => detectDrvClearanceExpiries(tx), 0),
          runIsolated(ctx.log, 'detect_overdue_approvals', () => detectOverdueApprovals(tx), 0),
          // Never rejects (internal try/catch), so it can't abort the others.
          gcIdpProvenance(ctx.log),
          // Never rejects (top-level try/catch in the helper),
          // so it can't abort the shared reminders transaction.
          // INTENTIONAL: runComplianceReminderScan uses its own prismaRaw connections,
          // NOT the lock-holding tx above. Crash-isolation is the goal — the scan's
          // dedup unique index (claimCronNotificationDedup) is the real idempotency
          // guard; the advisory lock does not need to cover these connections.
          executeComplianceReminderScan(),
          // Same crash-isolation contract: runWtLimitScan fans out over its own
          // regional clients and never rejects; the dedup unique index is the
          // idempotency guard, not the lock-holding tx above.
          executeWtLimitScan(),
        ]);

        return {
          skipped: false as const,
          processed: ruleResults.processed,
          sent: ruleResults.sent,
          ruleErrors: ruleResults.errors,
          overdueTasksNotified,
          drvExpiriesNotified,
          overdueApprovalsNotified,
          idpProvenanceGced,
          complianceReminderFires: complianceReminderResult.fires,
          complianceReminderDigests: complianceReminderResult.digests,
          wtLimitBreaches: wtLimitScanResult.breaches,
          wtLimitDigests: wtLimitScanResult.digests,
        };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    ctx.log.info(result, 'reminders cron completed');
    if (!result.skipped) {
      metrics.gauge('cron.reminders.sent', result.sent);
      metrics.gauge('cron.reminders.rule_errors', result.ruleErrors);
      metrics.gauge('cron.reminders.overdue_tasks', result.overdueTasksNotified);
      metrics.gauge('cron.reminders.drv_expiries', result.drvExpiriesNotified);
      metrics.gauge('cron.reminders.overdue_approvals', result.overdueApprovalsNotified);
      metrics.gauge('cron.reminders.idp_provenance_gced', result.idpProvenanceGced);
      metrics.gauge('cron.reminders.compliance_reminder_fires', result.complianceReminderFires);
      metrics.gauge('cron.reminders.compliance_reminder_digests', result.complianceReminderDigests);
      metrics.gauge('cron.reminders.wt_limit_breaches', result.wtLimitBreaches);
      metrics.gauge('cron.reminders.wt_limit_digests', result.wtLimitDigests);
    }

    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { ...result } as Record<string, unknown>,
    };
  } catch (err) {
    ctx.log.error({ err }, 'reminders cron failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'reminders' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
