/**
 * Wave-0 RED contract (INTEG-API-02) — derived OpenAPI 3.1 shape.
 *
 * The spec must be DERIVED (not the hand-written literal): `openapi` starts
 * `3.1`, all read paths are present, and ZERO write paths appear (writes are
 * `hide:true` — the spec/SDK darkness layer). 98-06 introduces the OpenAPIHono
 * host + `buildOpenApiDocument`; 98-07/98-08 add the 9 read paths; 98-10
 * finalizes the writes-absent assertion.
 *
 * RED until 98-06 adds `../lib/build-openapi-doc`. Terminal Cannot-find-module
 * on the missing builder is the accepted Wave-0 state.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/create-caller.js', () => ({
  createPublicCaller: vi.fn(() => ({})),
}));

vi.mock('@contractor-ops/logger', () => {
  const stub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const loggerStub = { ...stub, child: vi.fn(() => stub) };
  return {
    logger: loggerStub,
    createLogger: vi.fn(() => loggerStub),
    createTrpcLogger: vi.fn(() => stub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
  };
});

// RED: the app is not yet an OpenAPIHono and this builder does not exist (98-06).
import app from '../app.js';
import { buildOpenApiDocument } from '../lib/build-openapi-doc.js';

const READ_PATHS = [
  '/contractors',
  '/invoices',
  '/contracts',
  '/documents',
  '/payments',
  '/payment-runs',
  '/workflows',
  '/workflow-tasks',
  '/classifications',
  '/compliance-documents',
  '/audit-log',
];

describe('derived OpenAPI 3.1 document', () => {
  it('emits openapi 3.1.x', () => {
    const doc = buildOpenApiDocument(app);
    expect(String(doc.openapi)).toMatch(/^3\.1/);
  });

  it('contains the read paths', () => {
    const doc = buildOpenApiDocument(app);
    const paths = Object.keys(doc.paths ?? {});
    for (const p of READ_PATHS) {
      expect(paths.some(k => k.includes(p))).toBe(true);
    }
  });

  it('contains ZERO write operations (writes are hide:true)', () => {
    const doc = buildOpenApiDocument(app);
    const writeVerbs = ['post', 'patch', 'put', 'delete'];
    for (const op of Object.values(doc.paths ?? {})) {
      for (const verb of writeVerbs) {
        expect((op as Record<string, unknown>)[verb]).toBeUndefined();
      }
    }
  });
});
