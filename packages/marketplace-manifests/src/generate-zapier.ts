// Zapier app definition, generated from the OpenAPI snapshot (write actions) +
// the webhook event catalog (triggers). Never hand-authored — a hand-edited
// trigger/action would drift from the API the day an endpoint changes.

import type { OpenApiSnapshot, SpecOperation } from './load-spec.js';
import { listOperations, serverUrl, toSnakeKey, WRITE_METHODS } from './load-spec.js';

export interface ZapierAuthentication {
  type: 'custom';
  fields: Array<{ key: string; label: string; required: boolean; type: string; helpText?: string }>;
  test: { url: string; method: string };
  connectionLabel: string;
}

export interface ZapierTrigger {
  key: string;
  noun: string;
  display: { label: string; description: string; hidden: boolean };
  event: string;
  operation: {
    type: 'hook';
    performSubscribe: string;
    performUnsubscribe: string;
    perform: string;
  };
}

export interface ZapierCreate {
  key: string;
  noun: string;
  operationId: string;
  display: { label: string; description: string; hidden: boolean };
  operation: { method: string; url: string };
}

export interface ZapierApp {
  authentication: ZapierAuthentication;
  triggers: ZapierTrigger[];
  creates: ZapierCreate[];
}

function nounFromEvent(event: string): string {
  const [resource] = event.split('.');
  return resource
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function labelFromEvent(event: string): string {
  return `${nounFromEvent(event)} — ${event.split('.').slice(1).join(' ').replace(/_/g, ' ')}`.trim();
}

function nounFromOperation(op: SpecOperation): string {
  const tag = op.operation.tags?.[0];
  if (tag) return tag.replace(/s$/, '');
  return op.operationId.replace(/^(create|update|approve|mark|void|lookup)/i, '') || 'Record';
}

export function generateZapier(spec: OpenApiSnapshot, events: readonly string[]): ZapierApp {
  const base = serverUrl(spec);

  const authentication: ZapierAuthentication = {
    type: 'custom',
    fields: [
      {
        key: 'apiKey',
        label: 'API key',
        required: true,
        type: 'password',
        helpText:
          'Your Contractor Ops API key (co_live_… for production, co_test_… for the free sandbox). Create one under Settings → Developer.',
      },
    ],
    test: { url: `${base}/v1/health`, method: 'GET' },
    connectionLabel: 'Contractor Ops',
  };

  const triggers: ZapierTrigger[] = [...events].map(event => ({
    key: toSnakeKey(event),
    noun: nounFromEvent(event),
    display: {
      label: labelFromEvent(event),
      description: `Triggers when a ${event} webhook event is delivered.`,
      hidden: false,
    },
    event,
    operation: {
      type: 'hook',
      performSubscribe: 'subscribeWebhook',
      performUnsubscribe: 'unsubscribeWebhook',
      perform: 'parseWebhookPayload',
    },
  }));

  const creates: ZapierCreate[] = listOperations(spec)
    .filter(op => WRITE_METHODS.includes(op.method))
    .map(op => ({
      key: toSnakeKey(op.operationId),
      noun: nounFromOperation(op),
      operationId: op.operationId,
      display: {
        label: op.operation.summary ?? op.operationId,
        description: op.operation.description ?? op.operation.summary ?? op.operationId,
        hidden: false,
      },
      operation: { method: op.method.toUpperCase(), url: `${base}${op.path}` },
    }));

  return { authentication, triggers, creates };
}
