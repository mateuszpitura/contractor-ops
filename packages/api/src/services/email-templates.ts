import type { ReactElement } from "react";
import { createElement } from "react";
import { ApprovalDecisionEmail } from "../emails/approval-decision.js";
import { ApprovalRequestEmail } from "../emails/approval-request.js";
import { ContractExpiringEmail } from "../emails/contract-expiring.js";
import { InvoiceReceivedEmail } from "../emails/invoice-received.js";
import { TaskAssignedEmail } from "../emails/task-assigned.js";
import { TaskOverdueEmail } from "../emails/task-overdue.js";

// ---------------------------------------------------------------------------
// Subject lines (from UI-SPEC copywriting contract)
// ---------------------------------------------------------------------------

const SUBJECT_LINES: Record<string, (data: Record<string, unknown>) => string> = {
  APPROVAL_REQUEST: (data) =>
    `Action required: Approve invoice ${(data.invoiceNumber as string) ?? ""}`.trim(),
  APPROVAL_DECISION: (data) =>
    `Invoice ${(data.invoiceNumber as string) ?? ""} ${(data.decision as string)?.toLowerCase() ?? "processed"}`.trim(),
  TASK_ASSIGNED: (data) => `New task assigned: ${(data.taskName as string) ?? ""}`.trim(),
  TASK_OVERDUE: (data) => `Overdue: ${(data.taskName as string) ?? "Task"} is past due`.trim(),
  CONTRACT_EXPIRING: (data) =>
    `Contract expiring soon: ${(data.contractTitle as string) ?? ""}`.trim(),
  INVOICE_RECEIVED: (data) =>
    `New invoice received from ${(data.contractorName as string) ?? "contractor"}`.trim(),
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
): { subject: string; react: ReactElement } {
  const Component = TEMPLATE_MAP[type];
  const getSubject = SUBJECT_LINES[type];

  if (!Component || !getSubject) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  return {
    subject: getSubject(data),
    react: createElement(Component, data),
  };
}
