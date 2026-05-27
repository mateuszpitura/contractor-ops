import type { Prisma } from '@contractor-ops/db';
import type { CalendarTaskConfig } from '@contractor-ops/validators';
import { getServerEnv } from '@contractor-ops/validators';
import { createCalendarEvent, updateCalendarEvent } from './calendar-event-service';
import type { CalendarPrismaClient } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function appBaseUrl(): string {
  return getServerEnv().PUBLIC_APP_URL;
}
const TITLE_PREFIX = '[Contractor Ops] ';

const DURATION_MS: Record<string, number> = {
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  full_day: 0, // handled separately
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether a calendar event already exists for this entity.
 * If it does, updates instead of creating a new one.
 */
async function hasExistingCalendarEvent(
  prisma: CalendarPrismaClient,
  organizationId: string,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const count = await prisma.externalLink.count({
    where: {
      organizationId,
      entityType: entityType as Prisma.ExternalLinkWhereInput['entityType'],
      entityId,
      externalType: {
        in: ['GOOGLE_CALENDAR_EVENT', 'OUTLOOK_CALENDAR_EVENT'],
      },
    },
  });
  return count > 0;
}

/**
 * Calculates end-of-day for a full_day duration.
 * Returns the same date at 23:59:00 UTC.
 */
function endOfDay(dateStr: string): string {
  const date = new Date(dateStr);
  date.setUTCHours(23, 59, 0, 0);
  return date.toISOString();
}

// ---------------------------------------------------------------------------
// Contract Expiry Deadline
// ---------------------------------------------------------------------------

/**
 * Syncs a contract expiry date to the calendar.
 *
 * Creates or updates a calendar event with the [Contractor Ops] prefix (D-15).
 * Event is a 30-minute block at 09:00 UTC on the expiry date.
 */
export async function syncContractExpiryDeadline(
  prisma: CalendarPrismaClient,
  input: {
    organizationId: string;
    contractId: string;
    contractName: string;
    contractorName: string;
    expiryDate: Date;
    userId?: string;
  },
): Promise<void> {
  const title = `${TITLE_PREFIX}Contract expiry: ${input.contractorName} - ${input.contractName}`;
  const description = `Contract "${input.contractName}" with ${input.contractorName} expires on ${input.expiryDate.toISOString().split('T')[0]}.\n\nView in Contractor Ops: ${appBaseUrl()}/contracts/${input.contractId}`;

  const expiryDay = new Date(input.expiryDate);
  expiryDay.setUTCHours(9, 0, 0, 0);
  const startDateTime = expiryDay.toISOString();

  const endDate = new Date(expiryDay);
  endDate.setUTCMinutes(30);
  const endDateTime = endDate.toISOString();

  const exists = await hasExistingCalendarEvent(
    prisma,
    input.organizationId,
    'CONTRACT',
    input.contractId,
  );

  if (exists) {
    await updateCalendarEvent(prisma, {
      organizationId: input.organizationId,
      entityType: 'CONTRACT',
      entityId: input.contractId,
      summary: title,
      description,
      startDateTime,
      endDateTime,
    });
  } else {
    await createCalendarEvent(prisma, {
      organizationId: input.organizationId,
      userId: input.userId,
      entityType: 'CONTRACT',
      entityId: input.contractId,
      summary: title,
      description,
      startDateTime,
      endDateTime,
    });
  }
}

// ---------------------------------------------------------------------------
// Approval SLA Deadline
// ---------------------------------------------------------------------------

/**
 * Syncs an approval SLA deadline to the calendar.
 *
 * Creates or updates a calendar event for the approval deadline
 * with the [Contractor Ops] prefix (D-15).
 */
export async function syncApprovalSlaDeadline(
  prisma: CalendarPrismaClient,
  input: {
    organizationId: string;
    approvalFlowId: string;
    itemType: string;
    itemName: string;
    deadline: Date;
    userId?: string;
  },
): Promise<void> {
  const title = `${TITLE_PREFIX}Approval deadline: ${input.itemType} - ${input.itemName}`;
  const description = `Approval for ${input.itemType} "${input.itemName}" is due by ${input.deadline.toISOString().split('T')[0]}.\n\nView in Contractor Ops: ${appBaseUrl()}/approvals`;

  const deadlineDay = new Date(input.deadline);
  deadlineDay.setUTCHours(9, 0, 0, 0);
  const startDateTime = deadlineDay.toISOString();

  const endDate = new Date(deadlineDay);
  endDate.setUTCMinutes(30);
  const endDateTime = endDate.toISOString();

  const exists = await hasExistingCalendarEvent(
    prisma,
    input.organizationId,
    'APPROVAL_FLOW',
    input.approvalFlowId,
  );

  if (exists) {
    await updateCalendarEvent(prisma, {
      organizationId: input.organizationId,
      entityType: 'APPROVAL_FLOW',
      entityId: input.approvalFlowId,
      summary: title,
      description,
      startDateTime,
      endDateTime,
    });
  } else {
    await createCalendarEvent(prisma, {
      organizationId: input.organizationId,
      userId: input.userId,
      entityType: 'APPROVAL_FLOW',
      entityId: input.approvalFlowId,
      summary: title,
      description,
      startDateTime,
      endDateTime,
    });
  }
}

// ---------------------------------------------------------------------------
// Payment Due Deadline
// ---------------------------------------------------------------------------

/**
 * Syncs a payment due date to the calendar.
 *
 * Creates or updates a calendar event for the payment deadline
 * with the [Contractor Ops] prefix (D-15).
 */
export async function syncPaymentDueDeadline(
  prisma: CalendarPrismaClient,
  input: {
    organizationId: string;
    invoiceId: string;
    invoiceNumber: string;
    contractorName: string;
    dueDate: Date;
    userId?: string;
  },
): Promise<void> {
  const title = `${TITLE_PREFIX}Payment due: ${input.contractorName} - ${input.invoiceNumber}`;
  const description = `Invoice ${input.invoiceNumber} from ${input.contractorName} is due on ${input.dueDate.toISOString().split('T')[0]}.\n\nView in Contractor Ops: ${appBaseUrl()}/invoices/${input.invoiceId}`;

  const dueDay = new Date(input.dueDate);
  dueDay.setUTCHours(9, 0, 0, 0);
  const startDateTime = dueDay.toISOString();

  const endDate = new Date(dueDay);
  endDate.setUTCMinutes(30);
  const endDateTime = endDate.toISOString();

  const exists = await hasExistingCalendarEvent(
    prisma,
    input.organizationId,
    'INVOICE',
    input.invoiceId,
  );

  if (exists) {
    await updateCalendarEvent(prisma, {
      organizationId: input.organizationId,
      entityType: 'INVOICE',
      entityId: input.invoiceId,
      summary: title,
      description,
      startDateTime,
      endDateTime,
    });
  } else {
    await createCalendarEvent(prisma, {
      organizationId: input.organizationId,
      userId: input.userId,
      entityType: 'INVOICE',
      entityId: input.invoiceId,
      summary: title,
      description,
      startDateTime,
      endDateTime,
    });
  }
}

// ---------------------------------------------------------------------------
// Workflow Task Calendar Event
// ---------------------------------------------------------------------------

/**
 * Creates a calendar event when a workflow task is activated with calendar config.
 *
 * Substitutes template variables in the title ({contractor}, {contract}, {task})
 * and calculates event duration from the config. Prepends [Contractor Ops] prefix (D-15).
 */
export async function createTaskCalendarEvent(
  prisma: CalendarPrismaClient,
  input: {
    organizationId: string;
    workflowTaskRunId: string;
    config: CalendarTaskConfig;
    contractorName: string;
    contractName: string;
    taskName: string;
    userId?: string;
  },
): Promise<void> {
  if (!input.config.calendarEnabled) return;

  // Substitute template variables in title
  let title = input.config.titleTemplate ?? '{task} - {contractor} ({contract})';
  title = title.replace(/\{contractor\}/g, input.contractorName);
  title = title.replace(/\{contract\}/g, input.contractName);
  title = title.replace(/\{task\}/g, input.taskName);
  title = `${TITLE_PREFIX}${title}`;

  const description = `Workflow task "${input.taskName}" for ${input.contractorName} (${input.contractName}).\n\nView in Contractor Ops: ${appBaseUrl()}/workflows`;

  const now = new Date();
  const startDateTime = now.toISOString();

  let endDateTime: string;
  if (input.config.duration === 'full_day') {
    endDateTime = endOfDay(startDateTime);
  } else {
    const durationMs = DURATION_MS[input.config.duration] ?? DURATION_MS['1h'] ?? 60 * 60 * 1000;
    endDateTime = new Date(now.getTime() + durationMs).toISOString();
  }

  await createCalendarEvent(prisma, {
    organizationId: input.organizationId,
    userId: input.userId,
    entityType: 'WORKFLOW_TASK_RUN',
    entityId: input.workflowTaskRunId,
    summary: title,
    description,
    startDateTime,
    endDateTime,
    attendees: input.config.attendees,
  });
}
