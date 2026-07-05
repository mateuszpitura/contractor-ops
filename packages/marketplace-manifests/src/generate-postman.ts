// Postman Collection v2.1, generated from the OpenAPI snapshot. One request per
// path+method; auth + base URL as {{apiKey}} / {{baseUrl}} variables so a
// developer sets two variables and calls the whole API. Deterministic — the
// `--check` gate diffs a fresh generation against the committed file.

import type { OpenApiSnapshot } from './load-spec.js';
import { listOperations, serverUrl } from './load-spec.js';

interface PostmanUrl {
  raw: string;
  host: string[];
  path: string[];
}

interface PostmanRequestItem {
  name: string;
  request: {
    method: string;
    header: Array<{ key: string; value: string; type: string }>;
    url: PostmanUrl;
    description?: string;
    body?: { mode: 'raw'; raw: string; options: { raw: { language: 'json' } } };
  };
}

interface PostmanFolder {
  name: string;
  item: PostmanRequestItem[];
}

export interface PostmanCollection {
  info: { name: string; schema: string; description?: string };
  auth: { type: 'apikey'; apikey: Array<{ key: string; value: string; type: string }> };
  variable: Array<{ key: string; value: string; type: string }>;
  item: PostmanFolder[];
}

function buildUrl(path: string): PostmanUrl {
  const segments = path.replace(/^\//, '').split('/');
  return {
    raw: `{{baseUrl}}${path}`,
    host: ['{{baseUrl}}'],
    path: segments,
  };
}

function exampleBody(op: ReturnType<typeof listOperations>[number]): string | undefined {
  const json = op.operation.requestBody?.content?.['application/json'];
  if (json?.example === undefined) return;
  return JSON.stringify(json.example, null, 2);
}

export function generatePostman(spec: OpenApiSnapshot): PostmanCollection {
  const base = serverUrl(spec);
  const foldersByTag = new Map<string, PostmanRequestItem[]>();

  for (const op of listOperations(spec)) {
    const tag = op.operation.tags?.[0] ?? 'API';
    const body = exampleBody(op);
    const item: PostmanRequestItem = {
      name: op.operation.summary ?? op.operationId,
      request: {
        method: op.method.toUpperCase(),
        header: [{ key: 'Content-Type', value: 'application/json', type: 'text' }],
        url: buildUrl(op.path),
        ...(op.operation.description && { description: op.operation.description }),
        ...(body && {
          body: { mode: 'raw', raw: body, options: { raw: { language: 'json' } } },
        }),
      },
    };
    const bucket = foldersByTag.get(tag);
    if (bucket) bucket.push(item);
    else foldersByTag.set(tag, [item]);
  }

  const item: PostmanFolder[] = [...foldersByTag.entries()].map(([name, items]) => ({
    name,
    item: items,
  }));

  return {
    info: {
      name: spec.info.title,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: spec.info.description,
    },
    auth: {
      type: 'apikey',
      apikey: [
        { key: 'key', value: 'Authorization', type: 'string' },
        { key: 'value', value: 'Bearer {{apiKey}}', type: 'string' },
        { key: 'in', value: 'header', type: 'string' },
      ],
    },
    variable: [
      { key: 'baseUrl', value: base, type: 'string' },
      { key: 'apiKey', value: '', type: 'string' },
    ],
    item,
  };
}
