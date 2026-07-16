// Pure builders that turn the generated descriptor into n8n property lists.
// Kept free of any n8n runtime so the seam test can feed a fixture-derived
// descriptor and assert every operation/event maps 1:1 to the generated surface.

import type { IAuthenticateGeneric, ICredentialTestRequest, INodeProperties } from 'n8n-workflow';

import type { N8nDescriptor } from './generated.js';

/** `invoice.approved` -> `Invoice Approved`; `workflow.task.completed` -> `Workflow Task Completed`. */
export function eventDisplayName(event: string): string {
  return event
    .split(/[._]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** The regular node's properties — one option per generated write operation. */
export function buildNodeProperties(descriptor: N8nDescriptor): INodeProperties[] {
  return [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      description: 'The Contractor Ops write action to perform.',
      options: descriptor.node.operations.map(op => ({
        name: op.name,
        value: op.value,
        action: op.action,
        description: op.description,
      })),
      default: descriptor.node.operations[0]?.value ?? '',
    },
    {
      displayName: 'Path Parameters',
      name: 'pathParameters',
      type: 'json',
      default: '{}',
      description:
        'A JSON object filling any {placeholder} segments in the operation path (e.g. { "id": "ctr_123" }).',
    },
    {
      displayName: 'Body',
      name: 'body',
      type: 'json',
      default: '{}',
      description: 'The JSON request body sent with the write operation.',
    },
  ];
}

/** The trigger node's properties — one option per generated webhook event. */
export function buildTriggerProperties(descriptor: N8nDescriptor): INodeProperties[] {
  return [
    {
      displayName: 'Events',
      name: 'events',
      type: 'multiOptions',
      required: true,
      default: [],
      description:
        'The Contractor Ops webhook events this trigger reacts to. Register the n8n webhook URL for these events in Contractor Ops → Settings → Developers → Webhooks.',
      options: descriptor.trigger.events.map(event => ({
        name: eventDisplayName(event),
        value: event,
      })),
    },
    {
      displayName:
        'After activating this workflow, copy the Production URL above and register it as a webhook endpoint in Contractor Ops (Settings → Developers → Webhooks), subscribing to the events selected here.',
      name: 'setupNotice',
      type: 'notice',
      default: '',
    },
  ];
}

/** The apiKey credential's properties — the user-supplied key + the API base URL. */
export function buildCredentialProperties(descriptor: N8nDescriptor): INodeProperties[] {
  return [
    {
      displayName: 'API Key',
      name: descriptor.credential.apiKeyProperty,
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description:
        'A Contractor Ops API key. Use a co_live_… key for production or a co_test_… key for the free sandbox.',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: descriptor.credential.baseUrl,
      required: true,
      description: 'The Contractor Ops public API base URL, including the /v1 prefix.',
    },
  ];
}

/** The credential auth — inject the API key as `Authorization: Bearer <key>` (the public-API scheme). */
export function buildAuthenticate(descriptor: N8nDescriptor): IAuthenticateGeneric {
  return {
    type: 'generic',
    properties: {
      headers: {
        Authorization: `=Bearer {{$credentials.${descriptor.credential.apiKeyProperty}}}`,
      },
    },
  };
}

/** The credential test — a cheap authenticated GET against the read surface. */
export const CREDENTIAL_TEST: ICredentialTestRequest = {
  request: {
    baseURL: '={{$credentials.baseUrl}}',
    url: '/contractors',
    method: 'GET',
  },
};
