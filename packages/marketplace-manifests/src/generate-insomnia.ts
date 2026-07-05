// Insomnia v4 workspace export, generated from the OpenAPI snapshot. One request
// resource per path+method + a base environment carrying baseUrl / apiKey.
// Deterministic (stable ids, no timestamps) so the `--check` gate can diff it.

import type { OpenApiSnapshot } from './load-spec.js';
import { listOperations, serverUrl } from './load-spec.js';

interface InsomniaResource {
  _id: string;
  _type: string;
  parentId?: string | null;
  name?: string;
  [key: string]: unknown;
}

export interface InsomniaExport {
  _type: 'export';
  export_format: 4;
  __export_source: string;
  resources: InsomniaResource[];
}

const WORKSPACE_ID = 'wrk_contractor_ops';
const GROUP_ID = 'fld_contractor_ops';
const ENV_ID = 'env_contractor_ops';

export function generateInsomnia(spec: OpenApiSnapshot): InsomniaExport {
  const base = serverUrl(spec);

  const resources: InsomniaResource[] = [
    {
      _id: WORKSPACE_ID,
      _type: 'workspace',
      parentId: null,
      name: spec.info.title,
      scope: 'collection',
    },
    {
      _id: ENV_ID,
      _type: 'environment',
      parentId: WORKSPACE_ID,
      name: 'Base Environment',
      data: { baseUrl: base, apiKey: '' },
      dataPropertyOrder: { '&': ['baseUrl', 'apiKey'] },
    },
    { _id: GROUP_ID, _type: 'request_group', parentId: WORKSPACE_ID, name: 'API' },
  ];

  for (const op of listOperations(spec)) {
    const json = op.operation.requestBody?.content?.['application/json'];
    const hasBody = json?.example !== undefined;
    resources.push({
      _id: `req_${op.operationId}`,
      _type: 'request',
      parentId: GROUP_ID,
      name: op.operation.summary ?? op.operationId,
      method: op.method.toUpperCase(),
      url: `{{ _.baseUrl }}${op.path}`,
      description: op.operation.description ?? '',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      authentication: { type: 'bearer', token: '{{ _.apiKey }}' },
      ...(hasBody && {
        body: { mimeType: 'application/json', text: JSON.stringify(json?.example, null, 2) },
      }),
    });
  }

  return {
    _type: 'export',
    export_format: 4,
    __export_source: 'contractor-ops:marketplace-manifests',
    resources,
  };
}
