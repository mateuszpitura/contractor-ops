/**
 * Derived OpenAPI 3.1 shape.
 *
 * The spec must be DERIVED (not a hand-written literal): `openapi` starts
 * `3.1`, all read paths are present, and — after the OWASP gate passed and
 * the writes were un-hidden — the write paths now appear in the spec/SDK.
 * The per-org `module.public-api` flag gate is unchanged (an org without
 * the module still 404s).
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

  it('contains the un-hidden write operations (post-OWASP-gate flip)', () => {
    const doc = buildOpenApiDocument(app);
    const writeVerbs = ['post', 'patch', 'put', 'delete'];
    let writeOps = 0;
    for (const op of Object.values(doc.paths ?? {})) {
      for (const verb of writeVerbs) {
        if ((op as Record<string, unknown>)[verb]) writeOps += 1;
      }
    }
    // The write routes are un-hidden into the spec/SDK; the per-org
    // `module.public-api` flag gate still 404s an org without the module.
    expect(writeOps).toBeGreaterThan(0);
  });
});
