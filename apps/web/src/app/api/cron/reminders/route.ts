import { withCronMonitor } from '@contractor-ops/api/services/cron-monitor';
import { dispatch } from '@contractor-ops/api/services/notification-service';
import { resolveRbacRecipients } from '@contractor-ops/api/services/rbac-recipients';
import { prisma, prismaRaw } from '@contractor-ops/db';
import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

// ---------------------------------------------------------------------------
// Reminder rule evaluation
// ---------------------------------------------------------------------------

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
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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

    // 24h dedup: check if TASK_OVERDUE notification already sent for this task today
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

// ---------------------------------------------------------------------------
// Phase 60 · CLASS-09 — DRV § 7a SGB IV clearance expiry detector.
// See .planning/phases/60-classification-polish/60-03-PLAN.md (D-11).
//
// Piggybacks on this existing reminders cron (NOT a new cron) to fire
// notifications 90 / 30 / 7 days before validTo on Statusfeststellungsverfahren
// rows with outcome in {SELBSTANDIG, ABHANGIG}. Day-exact match on
// (gte target, lt target+1) avoids timezone drift. One-shot dedup keyed on
// (type, entityType=CONTRACTOR, entityId=clearance.id) per T-60-12.
// ---------------------------------------------------------------------------

const DRV_EXPIRY_BANDS = [
  { days: 90, type: 'classification.drv_expiry_90d' as const },
  { days: 30, type: 'classification.drv_expiry_30d' as const },
  { days: 7, type: 'classification.drv_expiry_7d' as const },
];

export async function detectDrvClearanceExpiries(): Promise<number> {
  const now = new Date();
  const today = startOfDay(now);
  let notified = 0;

  for (const band of DRV_EXPIRY_BANDS) {
    const target = addDays(today, band.days);
    const targetEnd = addDays(target, 1);

    // PHASE-60-CROSS-ORG-AGGREGATE: cron runs without tenant frame — scans
    // clearances across every organization to fire lead-time reminders.
    const clearances = await prismaRaw.statusfeststellungsverfahren.findMany({
      where: {
        validTo: { gte: target, lt: targetEnd },
        outcome: { in: ['SELBSTANDIG', 'ABHANGIG'] },
      },
    });

    for (const clearance of clearances) {
      // T-60-12 — one-shot dedup on (type, CONTRACTOR, clearance.id).
      const prior = await prismaRaw.notification.findFirst({
        where: {
          type: band.type,
          entityType: 'CONTRACTOR',
          entityId: clearance.id,
        },
      });
      if (prior) continue;

      const recipientUserIds = await resolveRbacRecipients(
        clearance.organizationId,
        'contractor:read',
      );
      if (recipientUserIds.length === 0) continue;

      const validToIso = clearance.validTo
        ? clearance.validTo.toISOString().slice(0, 10)
        : '';

      // T-60-10 — never log drvReference verbatim. The notification title/body
      // text is delivered to recipients who already have contractor:read,
      // so including it in-band is acceptable; logs only reference clearance.id.
      await dispatch({
        organizationId: clearance.organizationId,
        type: band.type,
        recipientUserIds,
        title: `DRV clearance expires in ${band.days} days`,
        body: `Reference ${clearance.drvReference}, valid until ${validToIso}. Begin the renewal filing — DRV processing typically takes 3-6 months.`,
        entityType: 'CONTRACTOR',
        entityId: clearance.id,
      });
      notified++;
    }
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
          role: { in: ['FINANCE_ADMIN', 'ACCOUNTANT'] },
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
