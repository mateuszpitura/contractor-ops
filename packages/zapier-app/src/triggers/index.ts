// REST-hook triggers, one per outbound webhook event in the catalog.
//
// The trigger set (keys, nouns, labels, source events) comes from the generated
// Zapier definition, so the app's triggers can never claim an event the API does
// not emit. Each trigger subscribes a Zapier-managed target URL to the event and
// tears it down on unsubscribe; the delivered payload is passed straight through.

import type { ZapierTrigger } from '@contractor-ops/marketplace-manifests';
import type { Bundle, Trigger, ZObject } from 'zapier-platform-core';

/** Where the public API accepts webhook subscription create/delete calls. */
function subscriptionUrl(baseUrl: string): string {
  return `${baseUrl}/v1/webhooks/subscriptions`;
}

function buildTrigger(generated: ZapierTrigger, baseUrl: string): Trigger {
  const { event } = generated;

  return {
    key: generated.key,
    noun: generated.noun,
    display: {
      label: generated.display.label,
      description: generated.display.description,
      hidden: generated.display.hidden,
    },
    operation: {
      type: 'hook',
      performSubscribe: async (z: ZObject, bundle: Bundle) => {
        const response = await z.request({
          url: subscriptionUrl(baseUrl),
          method: 'POST',
          body: { target_url: bundle.targetUrl, events: [event] },
        });
        return { id: response.data.id };
      },
      performUnsubscribe: async (z: ZObject, bundle: Bundle) => {
        const subscriptionId = bundle.subscribeData?.id;
        await z.request({
          url: `${subscriptionUrl(baseUrl)}/${subscriptionId}`,
          method: 'DELETE',
        });
        return { id: subscriptionId };
      },
      perform: (_z: ZObject, bundle: Bundle) => [bundle.cleanedRequest],
      performList: (_z: ZObject, _bundle: Bundle) => [sampleEnvelope(event)],
      sample: sampleEnvelope(event),
    },
  };
}

/** A representative delivery envelope so Zapier can render a sample without a live hook. */
function sampleEnvelope(event: string): Record<string, unknown> {
  return {
    id: 'evt_sample',
    type: event,
    created_at: '2026-01-01T00:00:00.000Z',
    organization_id: 'org_sample',
    include_pii: false,
    data: {},
  };
}

/** Build the keyed trigger map from the generated trigger list. */
export function buildTriggers(
  generated: readonly ZapierTrigger[],
  baseUrl: string,
): Record<string, Trigger> {
  const triggers: Record<string, Trigger> = {};
  for (const trigger of generated) {
    triggers[trigger.key] = buildTrigger(trigger, baseUrl);
  }
  return triggers;
}
