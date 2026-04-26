// ---------------------------------------------------------------------------
// Adaptive Card: Activity Alert
// Per D-07: Compact notification card for channel alerts
// ---------------------------------------------------------------------------

export interface ActivityAlertCardParams {
  title: string;
  details: Array<{ label: string; value: string }>;
  viewUrl: string;
}

/**
 * Builds a compact Adaptive Card JSON for activity alerts posted to channels.
 *
 * Contains:
 * - Title TextBlock
 * - FactSet from the provided details array
 * - "View in Contractor Ops" link
 */
export function buildActivityAlertCard(params: ActivityAlertCardParams): Record<string, unknown> {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: params.title,
        weight: 'Bolder',
        size: 'Medium',
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: params.details.map(d => ({
          title: d.label,
          value: d.value,
        })),
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: 'View in Contractor Ops',
        url: params.viewUrl,
      },
    ],
  };
}
