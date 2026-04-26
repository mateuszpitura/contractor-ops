import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { dispatch } from '@contractor-ops/api/services/notification-service';
import { resolveRbacRecipients } from '@contractor-ops/api/services/rbac-recipients';
import { parseMemberRole } from '@contractor-ops/auth/role-normalization';
import { prisma } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { detectDrvClearanceExpiries } from './drv-clearance-expiries.js';
import { addDays, claimCronNotificationDedup, startOfDay } from './reminders-shared.js';

const log = createCronLogger('reminders');

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === cronSecret;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLLING_24H_MS = 24 * 60 * 60 * 1000;

function rolling24hWindowId(now: Date): number {
  return Math.floor(now.getTime() / ROLLING_24H_MS);
}

// ---------------------------------------------------------------------------
// Reminder rule evaluation
// ---------------------------------------------------------------------------

interface ReminderEntity {
  id: string;
  label: string;
  contractorId: string | null;
  ownerUserId: string | null;
  organizationId: string;
}

type ReminderNotificationType = 'CONTRACT_EXPIRING' | 'INVOICE_RECEIVED';

interface ReminderDispatchParams {
  notificationType: ReminderNotificationType;
  title: string;
  body: string;
  entityType: 'CONTRACT' | 'INVOICE';
}

/**
 * Processes a batch of matched entities for a single rule:
 * dedup check, create instance, resolve recipients, dispatch, mark sent.
 */
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
    // Idempotency: the DB unique constraint on (ruleId, entityType, entityId, scheduledFor)
    // makes this safe under overlapping cron ticks. If another tick already created the
    // instance, we skip dispatch.
    try {
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
    } catch (err) {
      const maybePrismaError = err as unknown as { code?: string };
      if (maybePrismaError?.code === 'P2002') {
        continue;
      }
      throw err;
    }

    const recipientIds = await resolveRecipients(
      rule.organizationId,
      rule.recipientMode,
      rule.configJson as Record<string, unknown> | null,
      entity.ownerUserId,
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
    select: {
      id: true,
      title: true,
      contractorId: true,
      organizationId: true,
      contractor: { select: { ownerUserId: true } },
    },
  });
  return contracts.map(c => ({
    id: c.id,
    label: c.title,
    contractorId: c.contractorId,
    ownerUserId: c.contractor?.ownerUserId ?? null,
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
    select: {
      id: true,
      invoiceNumber: true,
      organizationId: true,
      contractorId: true,
      contractor: { select: { ownerUserId: true } },
    },
  });
  return invoices.map(inv => ({
    id: inv.id,
    label: inv.invoiceNumber,
    contractorId: inv.contractorId,
    ownerUserId: inv.contractor?.ownerUserId ?? null,
    organizationId: inv.organizationId,
  }));
}

async function evaluateReminderRules(): Promise<{
  processed: number;
  sent: number;
}> {
  const now = new Date();
  const today = startOfDay(now);
  let processed = 0;
  let sent = 0;

  const activeRules = await prisma.reminderRule.findMany({
    where: { active: true },
  });

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

// ---------------------------------------------------------------------------
// Built-in TASK_OVERDUE detection (NOTF-01)
// ---------------------------------------------------------------------------

async function detectOverdueTasks(): Promise<number> {
  const now = new Date();
  let notified = 0;

  // Find all overdue workflow tasks across all organizations
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
          workflowTemplate: {
            select: { name: true },
          },
          contractor: {
            select: { displayName: true },
          },
        },
      },
    },
  });

  for (const task of overdueTasks) {
    if (!task.assigneeUserId) continue;

    const dedupeKey = `TASK_OVERDUE:WORKFLOW_TASK_RUN:${task.id}:${task.assigneeUserId}:${rolling24hWindowId(now)}`;
    if (!(await claimCronNotificationDedup(dedupeKey))) {
      continue;
    }

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

// ---------------------------------------------------------------------------
// Recipient resolution
// ---------------------------------------------------------------------------

async function resolveRecipients(
  organizationId: string,
  recipientMode: string,
  configJson: Record<string, unknown> | null,
  entityOwnerId?: string | null,
): Promise<string[]> {
  switch (recipientMode) {
    case 'ENTITY_OWNER': {
      if (!entityOwnerId) return [];
      // For contracts/invoices, the "owner" is the contractor's linked user or the creator
      return entityOwnerId ? [entityOwnerId] : [];
    }

    case 'FINANCE_TEAM': {
      const financeMembers = await prisma.member.findMany({
        where: {
          organizationId,
          role: {
            in: ['finance_admin', 'external_accountant'],
          },
        },
        select: { userId: true },
      });
      return financeMembers.map(m => m.userId);
    }

    case 'ASSIGNEE': {
      if (!entityOwnerId) return [];
      return [entityOwnerId];
    }

    case 'SPECIFIC_USER': {
      const userId = configJson?.userId as string | undefined;
      return userId ? [userId] : [];
    }

    case 'ROLE': {
      const role = configJson?.role as string | undefined;
      const parsedRole = parseMemberRole(role);
      if (!parsedRole) return [];
      const members = await prisma.member.findMany({
        where: { organizationId, role: parsedRole },
        select: { userId: true },
      });
      return members.map(m => m.userId);
    }

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// GET /api/cron/reminders
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Sentry.withMonitor(
    'reminders',
    () =>
      withCronMonitor('reminders', async () => {
        try {
          const [ruleResults, overdueTasksNotified, drvExpiriesNotified] = await Promise.all([
            evaluateReminderRules(),
            detectOverdueTasks(),
            detectDrvClearanceExpiries(),
          ]);

          log.info(
            {
              processed: ruleResults.processed,
              sent: ruleResults.sent,
              overdueTasksNotified,
              drvExpiriesNotified,
            },
            'reminders cron completed',
          );
          metrics.gauge('cron.reminders.sent', ruleResults.sent);
          metrics.gauge('cron.reminders.overdue_tasks', overdueTasksNotified);
          metrics.gauge('cron.reminders.drv_expiries', drvExpiriesNotified);

          return NextResponse.json({
            processed: ruleResults.processed,
            sent: ruleResults.sent,
            overdueTasksNotified,
            drvExpiriesNotified,
          });
        } catch (error) {
          log.error({ err: error }, 'reminders cron failed');
          Sentry.captureException(error, {
            tags: { 'cron.job': 'reminders' },
          });
          return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
        }
      }),
    {
      schedule: { type: 'crontab', value: '0 9 * * *' },
      timezone: 'UTC',
    },
  );
}
