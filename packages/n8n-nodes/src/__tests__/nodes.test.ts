/**
 * The n8n nodes GENERATE from the marketplace-manifests surface — never
 * hand-authored. This suite imports the REAL generator (`generateN8n`) and the
 * REAL webhook catalog (`WEBHOOK_EVENT_TYPES`) — no mock on either side of the
 * seam — and asserts every node operation maps to a generated write action and
 * every trigger event maps to a real catalog event, so the node cannot drift
 * from the public API.
 */

import type { OpenApiSnapshot } from '@contractor-ops/marketplace-manifests';
import { generateN8n } from '@contractor-ops/marketplace-manifests';
import { WEBHOOK_EVENT_TYPES } from '@contractor-ops/validators';
import { describe, expect, it } from 'vitest';

import { ContractorOpsApi } from '../credentials/ContractorOpsApi.credentials';
import {
  buildAuthenticate,
  buildNodeProperties,
  buildTriggerProperties,
  eventDisplayName,
} from '../descriptions';
import { CONTRACTOR_OPS_DESCRIPTOR, operationByValue } from '../generated';
import { ContractorOps } from '../nodes/ContractorOps/ContractorOps.node';
import { ContractorOpsTrigger } from '../nodes/ContractorOpsTrigger/ContractorOpsTrigger.node';

// A minimal snapshot fixture WITH write operations, so the write-action mapping
// is exercised even while the committed snapshot still hides the write routes.
const FIXTURE_SPEC: OpenApiSnapshot = {
  openapi: '3.1.0',
  info: { title: 'Contractor Ops Enterprise API', version: '1.0.0' },
  servers: [{ url: 'https://api.contractor-ops.com' }],
  paths: {
    '/v1/contractors': {
      get: { operationId: 'listContractors', summary: 'List contractors', responses: {} },
      post: { operationId: 'createContractor', summary: 'Create a contractor', responses: {} },
    },
    '/v1/invoices': {
      post: { operationId: 'createInvoice', summary: 'Create an invoice', responses: {} },
    },
    '/v1/invoices/{id}/approve': {
      post: { operationId: 'approveInvoice', summary: 'Approve an invoice', responses: {} },
    },
  },
};

const events = [...WEBHOOK_EVENT_TYPES];
const fixtureDescriptor = generateN8n(FIXTURE_SPEC, events);
const fixtureWriteIds = ['approveInvoice', 'createContractor', 'createInvoice'];

function optionValues(props: ReturnType<typeof buildNodeProperties>, name: string): string[] {
  const prop = props.find(p => p.name === name);
  const options = (prop?.options ?? []) as Array<{ value: unknown }>;
  return options.map(o => String(o.value));
}

describe('nodes + credential load without error', () => {
  it('instantiates the regular node with the generated name and main I/O', () => {
    const node = new ContractorOps();
    expect(node.description.name).toBe(CONTRACTOR_OPS_DESCRIPTOR.node.name);
    expect(node.description.displayName).toBe(CONTRACTOR_OPS_DESCRIPTOR.node.displayName);
    expect(node.description.inputs).toEqual(['main']);
    expect(node.description.outputs).toEqual(['main']);
    expect(node.description.credentials?.[0]?.name).toBe(CONTRACTOR_OPS_DESCRIPTOR.credential.name);
    expect(typeof node.execute).toBe('function');
  });

  it('instantiates the trigger node as a webhook trigger', () => {
    const trigger = new ContractorOpsTrigger();
    expect(trigger.description.name).toBe(CONTRACTOR_OPS_DESCRIPTOR.trigger.name);
    expect(trigger.description.inputs).toEqual([]);
    expect(trigger.description.outputs).toEqual(['main']);
    expect(trigger.description.webhooks?.[0]?.httpMethod).toBe('POST');
    expect(typeof trigger.webhook).toBe('function');
  });

  it('instantiates the apiKey credential', () => {
    const cred = new ContractorOpsApi();
    expect(cred.name).toBe(CONTRACTOR_OPS_DESCRIPTOR.credential.name);
    expect(cred.displayName).toBe(CONTRACTOR_OPS_DESCRIPTOR.credential.displayName);
  });
});

describe('regular node operations map to generated write actions (seam)', () => {
  it('emits one operation option per generated write op — derived, not hardcoded', () => {
    const generatedValues = fixtureDescriptor.node.operations.map(op => op.value);
    expect(generatedValues.sort()).toEqual([...fixtureWriteIds].sort());

    const nodeValues = optionValues(buildNodeProperties(fixtureDescriptor), 'operation');
    expect(nodeValues.sort()).toEqual(generatedValues.sort());
  });

  it('every operation option resolves back to a generated operation (method + path)', () => {
    for (const value of optionValues(buildNodeProperties(fixtureDescriptor), 'operation')) {
      const op = operationByValue(fixtureDescriptor, value);
      expect(op).toBeDefined();
      expect(op?.method).toMatch(/^(POST|PUT|PATCH|DELETE)$/);
      expect(op?.path.startsWith('/')).toBe(true);
    }
  });

  it('the live node has zero write actions while the snapshot hides writes (pre-flip posture)', () => {
    expect(CONTRACTOR_OPS_DESCRIPTOR.node.operations).toHaveLength(0);
    expect(() => new ContractorOps()).not.toThrow();
  });
});

describe('trigger events map to the webhook catalog', () => {
  it('emits one event option for every catalog event', () => {
    const triggerValues = optionValues(buildTriggerProperties(fixtureDescriptor), 'events');
    expect(triggerValues.sort()).toEqual([...events].sort());
  });

  it('the live trigger exposes all 16 catalog events regardless of the snapshot', () => {
    expect([...CONTRACTOR_OPS_DESCRIPTOR.trigger.events].sort()).toEqual([...events].sort());
    expect(CONTRACTOR_OPS_DESCRIPTOR.trigger.events.length).toBe(16);
  });

  it('humanizes event keys for the option labels', () => {
    expect(eventDisplayName('invoice.approved')).toBe('Invoice Approved');
    expect(eventDisplayName('workflow.task.completed')).toBe('Workflow Task Completed');
  });
});

describe('credential injects the API-key header', () => {
  it('authenticates with Authorization: Bearer <apiKey> (the public-API scheme)', () => {
    const cred = new ContractorOpsApi();
    const headers = cred.authenticate.properties.headers as Record<string, string>;
    expect(headers.Authorization).toBe('=Bearer {{$credentials.apiKey}}');
  });

  it('builds the same auth expression from the generated apiKey property name', () => {
    const auth = buildAuthenticate(fixtureDescriptor);
    const headers = auth.properties.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `=Bearer {{$credentials.${fixtureDescriptor.credential.apiKeyProperty}}}`,
    );
  });

  it('exposes a masked apiKey field and a base URL default', () => {
    const cred = new ContractorOpsApi();
    const apiKeyProp = cred.properties.find(p => p.name === 'apiKey');
    expect(apiKeyProp?.typeOptions?.password).toBe(true);
    const baseUrlProp = cred.properties.find(p => p.name === 'baseUrl');
    expect(String(baseUrlProp?.default)).toContain('/v1');
  });
});
