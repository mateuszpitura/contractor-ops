import type { ReactElement } from 'react';
import { createElement } from 'react';
import { ApprovalDecisionEmail } from '../emails/approval-decision.js';
import { ApprovalRequestEmail } from '../emails/approval-request.js';
import { ContractExpiringEmail } from '../emails/contract-expiring.js';
import { InvoiceReceivedEmail } from '../emails/invoice-received.js';
import { TaskAssignedEmail } from '../emails/task-assigned.js';
import { TaskOverdueEmail } from '../emails/task-overdue.js';

// ---------------------------------------------------------------------------
// i18n subject key constants
// ---------------------------------------------------------------------------

export const EMAIL_SUBJECT_KEYS = {
  approvalRequest: 'email.subject.approvalRequest',
  approvalDecision: 'email.subject.approvalDecision',
  taskAssigned: 'email.subject.taskAssigned',
  taskOverdue: 'email.subject.taskOverdue',
  contractExpiring: 'email.subject.contractExpiring',
  invoiceReceived: 'email.subject.invoiceReceived',
} as const;

// ---------------------------------------------------------------------------
// Subject lines — return i18n keys with interpolation params
// ---------------------------------------------------------------------------

interface EmailSubject {
  /** The i18n key for the subject line */
  key: string;
  /** Interpolation parameters for the frontend to resolve */
  params: Record<string, string>;
}

const SUBJECT_LINES: Record<string, (data: Record<string, unknown>) => EmailSubject> = {
  APPROVAL_REQUEST: data => ({
    key: EMAIL_SUBJECT_KEYS.approvalRequest,
    params: { invoiceNumber: (data.invoiceNumber as string) ?? '' },
  }),
  APPROVAL_DECISION: data => ({
    key: EMAIL_SUBJECT_KEYS.approvalDecision,
    params: {
      invoiceNumber: (data.invoiceNumber as string) ?? '',
      decision: (data.decision as string)?.toLowerCase() ?? 'processed',
    },
  }),
  TASK_ASSIGNED: data => ({
    key: EMAIL_SUBJECT_KEYS.taskAssigned,
    params: { taskName: (data.taskName as string) ?? '' },
  }),
  TASK_OVERDUE: data => ({
    key: EMAIL_SUBJECT_KEYS.taskOverdue,
    params: { taskName: (data.taskName as string) ?? 'Task' },
  }),
  CONTRACT_EXPIRING: data => ({
    key: EMAIL_SUBJECT_KEYS.contractExpiring,
    params: { contractTitle: (data.contractTitle as string) ?? '' },
  }),
  INVOICE_RECEIVED: data => ({
    key: EMAIL_SUBJECT_KEYS.invoiceReceived,
    params: { contractorName: (data.contractorName as string) ?? 'contractor' },
  }),
};

// ---------------------------------------------------------------------------
// Template mapping
// ---------------------------------------------------------------------------

type TemplateComponent = (props: Record<string, unknown>) => ReactElement;

const TEMPLATE_MAP: Record<string, TemplateComponent> = {
  APPROVAL_REQUEST: ApprovalRequestEmail as unknown as TemplateComponent,
  APPROVAL_DECISION: ApprovalDecisionEmail as unknown as TemplateComponent,
  TASK_ASSIGNED: TaskAssignedEmail as unknown as TemplateComponent,
  TASK_OVERDUE: TaskOverdueEmail as unknown as TemplateComponent,
  CONTRACT_EXPIRING: ContractExpiringEmail as unknown as TemplateComponent,
  INVOICE_RECEIVED: InvoiceReceivedEmail as unknown as TemplateComponent,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Renders a notification email by selecting the appropriate React Email
 * template component for the given event type.
 *
 * @param type - One of the 6 notification event types
 * @param data - Template data including ctaUrl, preferencesUrl, and type-specific fields
 * @returns subject line and React element for the email
 * @throws if the notification type is unknown
 */
export function renderNotificationEmail(
  type: string,
  data: Record<string, unknown>,
): { subject: EmailSubject; react: ReactElement } {
  const Component = TEMPLATE_MAP[type];
  const getSubject = SUBJECT_LINES[type];

  if (Component === undefined || getSubject === undefined) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  return {
    subject: getSubject(data),
    react: createElement(Component, data),
  };
}
