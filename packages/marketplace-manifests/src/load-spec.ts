// Typed reader over the committed OpenAPI 3.1 snapshot. The marketplace + the
// collection generators derive every artifact from THIS shape, so a spec change
// re-emits them and the `--check` gate catches any hand-edit that drifts.

export type HttpMethod = 'get' | 'put' | 'post' | 'patch' | 'delete';

/** The write methods — everything that mutates maps to a marketplace ACTION. */
export const WRITE_METHODS: readonly HttpMethod[] = ['post', 'put', 'patch', 'delete'];

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<{ name: string; in: string; required?: boolean }>;
  requestBody?: {
    content?: Record<string, { schema?: unknown; example?: unknown }>;
  };
  responses?: Record<string, unknown>;
}

export type OpenApiPathItem = Partial<Record<HttpMethod, OpenApiOperation>>;

export interface OpenApiSnapshot {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  components?: { securitySchemes?: Record<string, unknown> };
  security?: Array<Record<string, unknown>>;
  paths: Record<string, OpenApiPathItem>;
}

export interface SpecOperation {
  path: string;
  method: HttpMethod;
  operationId: string;
  operation: OpenApiOperation;
}

const METHOD_ORDER: readonly HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * All operations in a stable order (path insertion order, then a fixed method
 * order) so every generated artifact is deterministic — the drift-check relies
 * on byte-identical re-generation.
 */
export function listOperations(spec: OpenApiSnapshot): SpecOperation[] {
  const ops: SpecOperation[] = [];
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of METHOD_ORDER) {
      const operation = item[method];
      if (!operation?.operationId) continue;
      ops.push({ path, method, operationId: operation.operationId, operation });
    }
  }
  return ops;
}

/** Write operationIds (POST/PUT/PATCH/DELETE) — zero while the write routes are hidden. */
export function writeOperationIds(spec: OpenApiSnapshot): string[] {
  return listOperations(spec)
    .filter(op => WRITE_METHODS.includes(op.method))
    .map(op => op.operationId);
}

/** Read operationIds (GET). */
export function readOperationIds(spec: OpenApiSnapshot): string[] {
  return listOperations(spec)
    .filter(op => op.method === 'get')
    .map(op => op.operationId);
}

/** Total number of request items a collection must cover (one per path+method). */
export function requestCount(spec: OpenApiSnapshot): number {
  return listOperations(spec).length;
}

/** The base server URL (the `/v1` origin) collections + apps point at. */
export function serverUrl(spec: OpenApiSnapshot): string {
  return spec.servers?.[0]?.url ?? 'https://api.contractor-ops.com';
}

/** camelCase operationId -> snake_case marketplace key (`createContractor` -> `create_contractor`). */
export function toSnakeKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[.\s-]+/g, '_')
    .toLowerCase();
}
