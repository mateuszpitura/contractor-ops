// ---------------------------------------------------------------------------
// Adaptive Card: Rejection Modal
// Displayed inside a Teams task module when user clicks "Reject"
// ---------------------------------------------------------------------------

/**
 * Builds an Adaptive Card JSON for the rejection modal (task module).
 *
 * Displayed when a user clicks "Reject" on an approval card (via task/fetch).
 * Contains a required multiline text input for the rejection reason
 * and a submit button.
 */
export function buildRejectModalCard(invoiceId: string, flowId: string): Record<string, unknown> {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: 'Reject Invoice',
        weight: 'Bolder',
        size: 'Medium',
        wrap: true,
      },
      {
        type: 'Input.Text',
        id: 'comment',
        label: 'Reason for rejection (required)',
        isRequired: true,
        isMultiline: true,
        placeholder: 'Explain why this invoice is being rejected...',
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Reject Invoice',
        style: 'destructive',
        data: {
          action: 'submit_rejection',
          invoiceId,
          flowId,
        },
      },
    ],
  };
}
