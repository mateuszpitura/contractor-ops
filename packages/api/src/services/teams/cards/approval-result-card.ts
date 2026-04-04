// ---------------------------------------------------------------------------
// Adaptive Card: Approval Result
// Per D-05, D-06: Shows the outcome of an approval decision
// ---------------------------------------------------------------------------

export interface ApprovalResultCardParams {
  result: "approved" | "rejected";
  invoiceNumber: string;
  amount: string;
  currency: string;
  approverName: string;
  comment?: string;
  viewUrl: string;
}

/**
 * Builds an Adaptive Card JSON showing an approval/rejection result.
 *
 * Contains:
 * - Result icon (checkmark or X) with status text
 * - FactSet: Invoice number, amount, approver name
 * - Optional rejection comment
 * - "View in Contractor Ops" link
 */
export function buildApprovalResultCard(
  params: ApprovalResultCardParams,
): Record<string, unknown> {
  const isApproved = params.result === "approved";
  const icon = isApproved ? "\u2705" : "\u274C";
  const label = isApproved ? "Approved" : "Rejected";
  const color = isApproved ? "Good" : "Attention";

  const body: Record<string, unknown>[] = [
    {
      type: "TextBlock",
      text: `${icon} Invoice ${label}`,
      weight: "Bolder",
      size: "Medium",
      color,
      wrap: true,
    },
    {
      type: "FactSet",
      facts: [
        { title: "Invoice", value: params.invoiceNumber },
        {
          title: "Amount",
          value: `${params.amount} ${params.currency}`,
        },
        {
          title: isApproved ? "Approved by" : "Rejected by",
          value: params.approverName,
        },
      ],
    },
  ];

  if (params.comment) {
    body.push({
      type: "TextBlock",
      text: `**Reason:** ${params.comment}`,
      wrap: true,
      spacing: "Small",
    });
  }

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body,
    actions: [
      {
        type: "Action.OpenUrl",
        title: "View in Contractor Ops",
        url: params.viewUrl,
      },
    ],
  };
}
