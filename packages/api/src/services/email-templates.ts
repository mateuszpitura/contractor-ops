import type { ReactElement } from 'react';
import { createElement } from 'react';
import { ApprovalDecisionEmail } from '../emails/approval-decision';
import { ApprovalRequestEmail } from '../emails/approval-request';
import { ContractExpiringEmail } from '../emails/contract-expiring';
import { GenericNotificationEmail } from '../emails/generic-notification';
import { InvoiceReceivedEmail } from '../emails/invoice-received';
import { TaskAssignedEmail } from '../emails/task-assigned';
import { TaskOverdueEmail } from '../emails/task-overdue';
import type { EmailLocale } from '../i18n/email-i18n';
import { resolveMessage, resolveMessages } from '../i18n/email-i18n';

// ---------------------------------------------------------------------------
// i18n subject keys (full Api.email.* paths into apps/web-vite/messages/*.json)
// ---------------------------------------------------------------------------

export const EMAIL_SUBJECT_KEYS = {
  approvalRequest: 'Api.email.subject.approvalRequest',
  approvalDecision: 'Api.email.subject.approvalDecision',
  taskAssigned: 'Api.email.subject.taskAssigned',
  taskOverdue: 'Api.email.subject.taskOverdue',
  contractExpiring: 'Api.email.subject.contractExpiring',
  invoiceReceived: 'Api.email.subject.invoiceReceived',
} as const;

// ---------------------------------------------------------------------------
// Subject lines — return i18n key + interpolation params
// ---------------------------------------------------------------------------

interface SubjectSpec {
  key: string;
  params: Record<string, string>;
}

const SUBJECT_LINES: Record<string, (data: Record<string, unknown>) => SubjectSpec> = {
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
// Per-template label maps + shared base-layout labels
// ---------------------------------------------------------------------------

const BASE_LABEL_KEYS = {
  ctaLabel: 'Api.email.labels.viewInApp',
  managePrefsLabel: 'Api.email.labels.managePrefs',
  unsubscribeLabel: 'Api.email.labels.unsubscribe',
  footerText: 'Api.email.labels.footerText',
} as const;

const APPROVAL_REQUEST_LABEL_KEYS = {
  invoice: 'Api.email.labels.invoice',
  contractor: 'Api.email.labels.contractor',
  amount: 'Api.email.labels.amount',
  ctaButton: 'Api.email.labels.reviewAndApprove',
} as const;

const APPROVAL_DECISION_LABEL_KEYS = {
  decision: 'Api.email.labels.decision',
  by: 'Api.email.labels.by',
  comment: 'Api.email.labels.comment',
} as const;

const TASK_ASSIGNED_LABEL_KEYS = {
  task: 'Api.email.labels.task',
  workflow: 'Api.email.labels.workflow',
  due: 'Api.email.labels.due',
} as const;

const TASK_OVERDUE_LABEL_KEYS = {
  task: 'Api.email.labels.task',
  workflow: 'Api.email.labels.workflow',
  wasDue: 'Api.email.labels.wasDue',
} as const;

const CONTRACT_EXPIRING_LABEL_KEYS = {
  contract: 'Api.email.labels.contract',
  contractor: 'Api.email.labels.contractor',
  expires: 'Api.email.labels.expires',
} as const;

const INVOICE_RECEIVED_LABEL_KEYS = {
  invoice: 'Api.email.labels.invoice',
  from: 'Api.email.labels.from',
  amount: 'Api.email.labels.amount',
} as const;

const TEMPLATE_LABEL_KEYS: Record<string, Record<string, string>> = {
  APPROVAL_REQUEST: APPROVAL_REQUEST_LABEL_KEYS,
  APPROVAL_DECISION: APPROVAL_DECISION_LABEL_KEYS,
  TASK_ASSIGNED: TASK_ASSIGNED_LABEL_KEYS,
  TASK_OVERDUE: TASK_OVERDUE_LABEL_KEYS,
  CONTRACT_EXPIRING: CONTRACT_EXPIRING_LABEL_KEYS,
  INVOICE_RECEIVED: INVOICE_RECEIVED_LABEL_KEYS,
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

export interface RenderedNotificationEmail {
  subject: string;
  react: ReactElement;
  /** True when no dedicated template exists and the generic layout was used. */
  usedGenericFallback: boolean;
}

/**
 * Render a notification email in the recipient's locale.
 *
 * Resolves the subject string + per-template + base-layout labels via the
 * server-side email-i18n bundle reader, then constructs the React Email
 * element with the pre-resolved props. The returned `subject` is the
 * final string ready to ship to Resend — no further interpolation needed.
 *
 * Types without a dedicated React Email template fall back to
 * {@link GenericNotificationEmail} using the event's `title`/`body` — in-app
 * delivery is unaffected; `usedGenericFallback` signals the email path.
 *
 * `locale` should be the recipient's preferred language, normalised to
 * one of {en, pl, de, ar}. Anything else falls back to en.
 */
export function renderNotificationEmail(
  type: string,
  data: Record<string, unknown>,
  locale: EmailLocale,
): RenderedNotificationEmail {
  const Component = TEMPLATE_MAP[type];
  const getSubject = SUBJECT_LINES[type];
  const labelKeys = TEMPLATE_LABEL_KEYS[type];
  const baseLabels = resolveMessages(BASE_LABEL_KEYS, locale);

  if (Component === undefined || getSubject === undefined || labelKeys === undefined) {
    const title = (data.title as string) ?? type;
    const body = (data.body as string) ?? '';
    const subject = title.length > 0 ? title : `Notification: ${type}`;

    return {
      subject,
      usedGenericFallback: true,
      react: createElement(GenericNotificationEmail, {
        ...data,
        title,
        body,
        baseLabels,
      }),
    };
  }

  const subjectSpec = getSubject(data);
  const subject = resolveMessage(subjectSpec.key, locale, subjectSpec.params);
  const labels = resolveMessages(labelKeys, locale);

  return {
    subject,
    usedGenericFallback: false,
    react: createElement(Component, {
      ...data,
      labels,
      baseLabels,
    }),
  };
}
