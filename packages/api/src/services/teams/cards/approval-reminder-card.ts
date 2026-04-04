// ---------------------------------------------------------------------------
// Adaptive Card: Approval Reminder (Overdue)
// Per D-08: Reminder card for overdue approval requests
// ---------------------------------------------------------------------------

export interface ApprovalReminderCardParams {
  overdueInDays: number;
  invoiceNumber: string;
  contractorName: string;
  amount: string;
  currency: string;
  dueDate: string;
  invoiceId: string;
  flowId: string;
}

/**
 * Builds an Adaptive Card JSON for overdue approval reminders.
 *
 * Contains:
 * - "Overdue Approval Reminder" header
 * - Attention-colored overdue days notice
 * - FactSet: Invoice, contractor, amount, due date
 * - Approve/Reject action buttons (same as approval-card)
 */
export function buildApprovalReminderCard(
  params: ApprovalReminderCardParams,
): Record<string, unknown> {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: "Overdue Approval Reminder",
        weight: "Bolder",
        size: "Medium",
        wrap: true,
      },
      {
        type: "TextBlock",
        text: `${params.overdueInDays} days overdue`,
        color: "Attention",
        weight: "Bolder",
        wrap: true,
      },
      {
        type: "FactSet",
        facts: [
          { title: "Invoice", value: params.invoiceNumber },
          { title: "Contractor", value: params.contractorName },
          {
            title: "Amount",
            value: `${params.amount} ${params.currency}`,
          },
          { title: "Due Date", value: params.dueDate },
        ],
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "Approve",
        style: "positive",
        data: {
          action: "approve_invoice",
          invoiceId: params.invoiceId,
          flowId: params.flowId,
        },
      },
      {
        type: "Action.Submit",
        title: "Reject",
        style: "destructive",
        data: {
          msteams: { type: "task/fetch" },
          action: "reject_invoice",
          invoiceId: params.invoiceId,
          flowId: params.flowId,
        },
      },
    ],
  };
}
