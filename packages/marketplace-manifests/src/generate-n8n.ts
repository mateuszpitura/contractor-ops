// n8n node descriptions, generated from the OpenAPI snapshot (write actions) +
// the webhook event catalog (trigger events). The @contractor-ops/n8n-nodes
// package imports these so its regular node + trigger node mirror the API.

import type { OpenApiSnapshot, SpecOperation } from './load-spec.js';
import { listOperations, serverUrl, WRITE_METHODS } from './load-spec.js';

export interface N8nOperation {
  operationId: string;
  name: string;
  value: string;
  action: string;
  description: string;
  method: string;
  path: string;
}

export interface N8nCredential {
  name: string;
  displayName: string;
  apiKeyProperty: string;
  baseUrl: string;
}

export interface N8nDescriptor {
  node: { name: string; displayName: string; baseUrl: string; operations: N8nOperation[] };
  trigger: { name: string; displayName: string; events: string[] };
  credential: N8nCredential;
}

function operationValue(op: SpecOperation): string {
  return op.operationId;
}

export function generateN8n(spec: OpenApiSnapshot, events: readonly string[]): N8nDescriptor {
  const baseUrl = `${serverUrl(spec)}/v1`;

  const operations: N8nOperation[] = listOperations(spec)
    .filter(op => WRITE_METHODS.includes(op.method))
    .map(op => ({
      operationId: op.operationId,
      name: op.operation.summary ?? op.operationId,
      value: operationValue(op),
      action: op.operation.summary ?? op.operationId,
      description: op.operation.description ?? op.operation.summary ?? op.operationId,
      method: op.method.toUpperCase(),
      path: op.path.replace(/^\/v1/, ''),
    }));

  return {
    node: {
      name: 'contractorOps',
      displayName: 'Contractor Ops',
      baseUrl,
      operations,
    },
    trigger: {
      name: 'contractorOpsTrigger',
      displayName: 'Contractor Ops Trigger',
      events: [...events],
    },
    credential: {
      name: 'contractorOpsApi',
      displayName: 'Contractor Ops API',
      apiKeyProperty: 'apiKey',
      baseUrl,
    },
  };
}
