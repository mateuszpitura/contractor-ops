/**
 * Approval-SLA overdue escalation sub-job.
 *
 * Piggybacks on the reminders cron (NOT a separate cron). Mirrors
 * `detectOverdueTasks`: finds PENDING `ApprovalStep` rows whose `slaDeadline`
 * has passed and notifies the assigned approver, deduped to one nudge per step
 * per rolling 24h (via the Notification table). After a step has breached on
 * `ESCALATE_AFTER_BREACHES` separate ticks it additionally escalates once — a
 * one-shot notification to the next chain step's approver so a higher authority
 * is alerted that the flow has stalled.
 *
 * The sub-job deliberately does NOT mutate flow state (step status /
 * `ApprovalFlow.currentStepOrder`): activating steps and advancing the flow
 * stays owned by the approval engine, so the cron never races the approval
 * decision path. The cron only surfaces the stall via notifications.
 */

import { dispatch } from '@contractor-ops/api/services/notification-service';
import type { Prisma } from '@contractor-ops/db';
import { claimCronNotificationDedup } from './shared.js';

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Daily breach nudges (≈ days overdue) before the stall is escalated to the next chain step. */
const ESCALATE_AFTER_BREACHES = 3;

export async function detectOverdueApprovals(db: Prisma.TransactionClient): Promise<number> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - MS_PER_DAY);
  let notified = 0;

  const overdueSteps = await db.approvalStep.findMany({
    where: {
      status: 'PENDING',
      slaDeadline: { lt: now },
      approverUserId: { not: null },
      approvalFlow: { status: 'PENDING' },
    },
    select: {
      id: true,
      organizationId: true,
      approvalFlowId: true,
      stepOrder: true,
      name: true,
      approverUserId: true,
      slaDeadline: true,
    },
  });

  for (const step of overdueSteps) {
    if (!(step.approverUserId && step.slaDeadline)) continue;

    // One nudge per step per rolling 24h — the breach series is keyed on the
    // step id (APPROVAL_FLOW/step.id), distinct from the submit-time
    // APPROVAL_REQUEST which is keyed on the invoice, so there is no collision.
    const recentNudge = await db.notification.findFirst({
      where: {
        type: 'APPROVAL_REQUEST',
        entityType: 'APPROVAL_FLOW',
        entityId: step.id,
        createdAt: { gte: oneDayAgo },
      },
    });
    if (recentNudge) continue;

    const priorBreaches = await db.notification.count({
      where: {
        type: 'APPROVAL_REQUEST',
        entityType: 'APPROVAL_FLOW',
        entityId: step.id,
      },
    });

    const overdueHours = Math.ceil((now.getTime() - step.slaDeadline.getTime()) / MS_PER_HOUR);

    await dispatch({
      organizationId: step.organizationId,
      type: 'APPROVAL_REQUEST',
      recipientUserIds: [step.approverUserId],
      title: 'Notifications.reminders.approvalOverdue.title',
      body: 'Notifications.reminders.approvalOverdue.body',
      entityType: 'APPROVAL_FLOW',
      entityId: step.id,
      metadata: { label: step.name, hours: overdueHours },
    });
    notified++;

    if (priorBreaches + 1 >= ESCALATE_AFTER_BREACHES) {
      notified += await escalateToNextStep(db, step);
    }
  }

  return notified;
}

async function escalateToNextStep(
  db: Prisma.TransactionClient,
  step: { id: string; approvalFlowId: string; stepOrder: number },
): Promise<number> {
  // One-shot per stalled step: the daily nudges to the current approver keep
  // firing, but the next-in-line approver is alerted only once.
  if (!(await claimCronNotificationDedup(`approval_sla_escalation:${step.id}`))) return 0;

  const nextStep = await db.approvalStep.findFirst({
    where: {
      approvalFlowId: step.approvalFlowId,
      stepOrder: { gt: step.stepOrder },
      status: 'NOT_STARTED',
      approverUserId: { not: null },
    },
    orderBy: { stepOrder: 'asc' },
    select: { id: true, name: true, approverUserId: true, organizationId: true },
  });
  if (!nextStep?.approverUserId) return 0;

  await dispatch({
    organizationId: nextStep.organizationId,
    type: 'APPROVAL_REQUEST',
    recipientUserIds: [nextStep.approverUserId],
    title: 'Notifications.reminders.approvalEscalated.title',
    body: 'Notifications.reminders.approvalEscalated.body',
    entityType: 'APPROVAL_FLOW',
    entityId: nextStep.id,
    metadata: { label: nextStep.name },
  });

  return 1;
}
