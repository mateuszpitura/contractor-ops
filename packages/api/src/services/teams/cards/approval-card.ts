// ---------------------------------------------------------------------------
// Adaptive Card: Invoice Approval Request
// Per D-05, D-06: Approval card with approve/reject buttons
// Reject button uses msteams task/fetch for modal dialog
// ---------------------------------------------------------------------------

export interface ApprovalCardParams {
  invoiceNumber: string;
  contractorName: string;
  amount: string;
  currency: string;
  dueDate: string;
  invoiceId: string;
  flowId: string;
}

/**
 * Builds an Adaptive Card JSON for invoice approval requests.
 *
 * Contains:
 * - Header: "Invoice Approval Required"
 * - FactSet: Invoice number, contractor, amount, due date
 * - Approve button (Action.Submit, style: positive)
 * - Reject button (Action.Submit, style: destructive, with msteams task/fetch)
 */
export function buildApprovalCard(params: ApprovalCardParams): Record<string, unknown> {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: 'Invoice Approval Required',
        weight: 'Bolder',
        size: 'Medium',
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Invoice', value: params.invoiceNumber },
          { title: 'Contractor', value: params.contractorName },
          {
            title: 'Amount',
            value: `${params.amount} ${params.currency}`,
          },
          { title: 'Due Date', value: params.dueDate },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Approve',
        style: 'positive',
        data: {
          action: 'approve_invoice',
          invoiceId: params.invoiceId,
          flowId: params.flowId,
        },
      },
      {
        type: 'Action.Submit',
        title: 'Reject',
        style: 'destructive',
        data: {
          msteams: { type: 'task/fetch' },
          action: 'reject_invoice',
          invoiceId: params.invoiceId,
          flowId: params.flowId,
        },
      },
    ],
  };
}
