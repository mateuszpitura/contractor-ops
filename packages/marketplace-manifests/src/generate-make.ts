// Make.com app blueprint, generated from the OpenAPI snapshot (modules = write
// actions) + the webhook event catalog (instant triggers). The committed
// blueprint.json is emitted by the CLI from this shape.

import type { OpenApiSnapshot, SpecOperation } from './load-spec.js';
import { listOperations, serverUrl, toSnakeKey, WRITE_METHODS } from './load-spec.js';

export interface MakeModule {
  name: string;
  label: string;
  operationId: string;
  method: string;
  url: string;
}

export interface MakeInstantTrigger {
  name: string;
  label: string;
  event: string;
}

export interface MakeConnection {
  name: string;
  type: 'apiKey';
  apiKeyHeader: string;
  apiKeyPrefix: string;
}

export interface MakeBlueprint {
  name: string;
  version: number;
  connection: MakeConnection;
  baseUrl: string;
  modules: MakeModule[];
  instantTriggers: MakeInstantTrigger[];
}

function moduleName(op: SpecOperation): string {
  return toSnakeKey(op.operationId);
}

export function generateMake(spec: OpenApiSnapshot, events: readonly string[]): MakeBlueprint {
  const base = serverUrl(spec);

  const modules: MakeModule[] = listOperations(spec)
    .filter(op => WRITE_METHODS.includes(op.method))
    .map(op => ({
      name: moduleName(op),
      label: op.operation.summary ?? op.operationId,
      operationId: op.operationId,
      method: op.method.toUpperCase(),
      url: `${base}${op.path}`,
    }));

  const instantTriggers: MakeInstantTrigger[] = [...events].map(event => ({
    name: toSnakeKey(event),
    label: `On ${event}`,
    event,
  }));

  return {
    name: 'Contractor Ops',
    version: 1,
    connection: {
      name: 'contractorOps',
      type: 'apiKey',
      apiKeyHeader: 'Authorization',
      apiKeyPrefix: 'Bearer ',
    },
    baseUrl: `${base}/v1`,
    modules,
    instantTriggers,
  };
}
