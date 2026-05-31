/**
 * Reminders handler. Fans out:
 *
 *   1. `evaluateReminderRules()` — active `ReminderRule` rows fire on
 *      BEFORE_CONTRACT_END / BEFORE_DUE_DATE / AFTER_DUE_DATE triggers.
 *      Each rule creates a `ReminderInstance` row keyed on
 *      `(ruleId, entityId, entityType, scheduledFor)` and dispatches a
 *      notification to recipients resolved per `recipientMode`
 *      (ENTITY_OWNER / FINANCE_TEAM / ASSIGNEE / SPECIFIC_USER / ROLE).
 *   2. `detectOverdueTasks()` — built-in TASK_OVERDUE detection
 *      (NOTF-01) with 24h dedup via the Notification table itself.
 *   3. `detectDrvClearanceExpiries()` — Phase 60 CLASS-09 sub-job (see
 *      ./drv-clearance-expiries.ts).
 *
 * F-ASYNC-06 — outer per-tx `pg_try_advisory_xact_lock` so overlapping
 * ticks can't double-fire reminders. F-SCALE-07 — 60s tx timeout / 10s
 * maxWait so a slow Resend dispatch can't hold the lock past the next tick.
 */

import { tryAcquireXactLock } from '@contractor-ops/api/lib/advisory-lock';
import { dispatch } from '@contractor-ops/api/services/notification-service';
import { prisma, prismaRaw } from '@contractor-ops/db';
import { gcExpiredProvenance } from '@contractor-ops/idp-saga';
import { metrics } from '@contractor-ops/logger/metrics';
import { Sentry } from '../../../lib/sentry.js';
import type { JobHandler } from '../../runner.js';
import { detectDrvClearanceExpiries } from './drv-clearance-expiries.js';
import { addDays, startOfDay } from './shared.js';

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
  title: string;
  body: string;
  entityType: 'CONTRACT' | 'INVOICE';
}

async function resolveRecipients(
  organizationId: string,
  recipientMode: string,
  configJson: Record<string, unknown> | null,
  entityOwnerId?: string | null,
): Promise<string[]> {
  switch (recipientMode) {
    case 'ENTITY_OWNER':
      return entityOwnerId ? [entityOwnerId] : [];
    case 'FINANCE_TEAM': {
      const financeMembers = await prisma.member.findMany({
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
      const members = await prisma.member.findMany({
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
  rule: { id: string; organizationId: string; recipientMode: string; configJson: unknown },
  entities: ReminderEntity[],
  dispatchParams: ReminderDispatchParams,
  now: Date,
  today: Date,
): Promise<number> {
  let sent = 0;
  const scheduledFor = startOfDay(today);

  for (const entity of entities) {
    const existing = await prisma.reminderInstance.findFirst({
      where: {
        reminderRuleId: rule.id,
        entityId: entity.id,
        entityType: dispatchParams.entityType,
        scheduledFor,
      },
    });
    if (existing) continue;

    await prisma.reminderInstance.create({
      data: {
        organizationId: rule.organizationId,
        reminderRuleId: rule.id,
        entityType: dispatchParams.entityType,
        entityId: entity.id,
        scheduledFor,
        status: 'PENDING',
      },
    });

    const recipientIds = await resolveRecipients(
      rule.organizationId,
      rule.recipientMode,
      rule.configJson as Record<string, unknown> | null,
      entity.contractorId,
    );

    if (recipientIds.length > 0) {
      await dispatch({
        organizationId: rule.organizationId,
        type: dispatchParams.notificationType,
        recipientUserIds: recipientIds,
        title: dispatchParams.title.replace('{label}', entity.label),
        body: dispatchParams.body,
        entityType: dispatchParams.entityType,
        entityId: entity.id,
      });
      sent++;
    }

    await prisma.reminderInstance.updateMany({
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
  organizationId: string,
  today: Date,
  offsetDays: number,
): Promise<ReminderEntity[]> {
  const targetDate = addDays(today, offsetDays);
  const contracts = await prisma.contract.findMany({
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
  organizationId: string,
  where: { dueDate: Record<string, unknown> },
): Promise<ReminderEntity[]> {
  const invoices = await prisma.invoice.findMany({
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: rule trigger branches ported 1:1
async function evaluateReminderRules(): Promise<{ processed: number; sent: number }> {
  const now = new Date();
  const today = startOfDay(now);
  let processed = 0;
  let sent = 0;

  const activeRules = await prisma.reminderRule.findMany({ where: { active: true } });

  for (const rule of activeRules) {
    processed++;
    const offsetDays = rule.offsetDays ?? 0;

    if (rule.triggerType === 'BEFORE_CONTRACT_END' && rule.entityType === 'CONTRACT') {
      const entities = await findMatchingContracts(rule.organizationId, today, offsetDays);
      sent += await processRuleEntities(
        rule,
        entities,
        {
          notificationType: 'CONTRACT_EXPIRING',
          title: 'Contract expiring soon: {label}',
          body: 'A contract is approaching its end date.',
          entityType: 'CONTRACT',
        },
        now,
        today,
      );
    }

    if (rule.triggerType === 'BEFORE_DUE_DATE' && rule.entityType === 'INVOICE') {
      const targetDate = addDays(today, offsetDays);
      const entities = await findMatchingInvoices(rule.organizationId, {
        dueDate: { lte: targetDate, gt: today },
      });
      sent += await processRuleEntities(
        rule,
        entities,
        {
          notificationType: 'INVOICE_RECEIVED',
          title: 'Invoice due soon: {label}',
          body: 'An invoice is approaching its due date.',
          entityType: 'INVOICE',
        },
        now,
        today,
      );
    }

    if (rule.triggerType === 'AFTER_DUE_DATE' && rule.entityType === 'INVOICE') {
      const targetDate = addDays(today, -offsetDays);
      const entities = await findMatchingInvoices(rule.organizationId, {
        dueDate: { lte: targetDate },
      });
      sent += await processRuleEntities(
        rule,
        entities,
        {
          notificationType: 'INVOICE_RECEIVED',
          title: 'Invoice overdue: {label}',
          body: 'An invoice is past its due date.',
          entityType: 'INVOICE',
        },
        now,
        today,
      );
    }
  }

  return { processed, sent };
}

async function detectOverdueTasks(): Promise<number> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let notified = 0;

  const overdueTasks = await prisma.workflowTaskRun.findMany({
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

    const recentNotification = await prisma.notification.findFirst({
      where: {
        type: 'TASK_OVERDUE',
        entityType: 'WORKFLOW_TASK_RUN',
        entityId: task.id,
        createdAt: { gte: oneDayAgo },
      },
    });
    if (recentNotification) continue;

    const contractorName = task.workflowRun?.contractor?.displayName ?? '';
    const workflowName = task.workflowRun?.workflowTemplate?.name ?? '';

    await dispatch({
      organizationId: task.organizationId,
      type: 'TASK_OVERDUE',
      recipientUserIds: [task.assigneeUserId],
      title: `Task overdue: ${task.title}`,
      body: `${workflowName}${contractorName ? ` - ${contractorName}` : ''}`,
      entityType: 'WORKFLOW_TASK_RUN',
      entityId: task.id,
    });

    notified++;
  }

  return notified;
}

/**
 * Phase 76 D-12 — IdpChangeProvenance 90-day GC. Isolated try/catch so a GC failure
 * never aborts the other reminder sub-tasks (T-76-10-02). Cross-org retention sweep —
 * uses the non-tenant raw client and deletes purely by `initiatedAt < now - 90d`.
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
            overdueTasksNotified: 0,
            drvExpiriesNotified: 0,
            idpProvenanceGced: 0,
          };
        }

        const [ruleResults, overdueTasksNotified, drvExpiriesNotified, idpProvenanceGced] =
          await Promise.all([
            evaluateReminderRules(),
            detectOverdueTasks(),
            detectDrvClearanceExpiries(),
            // Phase 76 D-12 — never rejects (internal try/catch), so it can't abort the others.
            gcIdpProvenance(ctx.log),
          ]);

        return {
          skipped: false as const,
          processed: ruleResults.processed,
          sent: ruleResults.sent,
          overdueTasksNotified,
          drvExpiriesNotified,
          idpProvenanceGced,
        };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );

    ctx.log.info(result, 'reminders cron completed');
    if (!result.skipped) {
      metrics.gauge('cron.reminders.sent', result.sent);
      metrics.gauge('cron.reminders.overdue_tasks', result.overdueTasksNotified);
      metrics.gauge('cron.reminders.drv_expiries', result.drvExpiriesNotified);
      metrics.gauge('cron.reminders.idp_provenance_gced', result.idpProvenanceGced);
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
