/**
 * Double-dark contract for the public WRITE surface.
 *
 * Two independent darkness layers, both asserted here:
 *   1. Runtime flag gate — a write route 404s while `module.public-api` is OFF.
 *      The tRPC `publicApiFlagGate` throws NOT_FOUND (dark) before any body runs;
 *      here the caller is stubbed to throw that same NOT_FOUND so the assertion
 *      is on the Hono route wiring + error mapping (the REAL flag gate 404 is
 *      proven at the tRPC layer in `packages/api` public-api-flag.security.test).
 *   2. Spec/SDK visibility — after the OWASP gate passed, the write routes are
 *      un-hidden, so the derived OpenAPI 3.1 document now carries the write
 *      operations (they enter the spec / Scalar / SDK). The per-org flag gate
 *      is UNCHANGED, so layer 1 (404 when the module is off) still holds —
 *      un-hiding a route ≠ enabling it for an org.
 */

import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';

const { throwDark } = vi.hoisted(() => ({
  throwDark: vi.fn(() => {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'publicApiDisabled' });
  }),
}));

vi.mock('../lib/create-caller.js', () => ({
  createPublicCaller: vi.fn(() => ({
    contractor: { create: throwDark, update: throwDark },
    invoice: { create: throwDark, void: throwDark },
    payment: { update: throwDark },
    paymentRun: { create: throwDark, transition: throwDark, export: throwDark },
    workflow: { create: throwDark, execute: throwDark },
    workflowTask: { transition: throwDark },
  })),
}));

vi.mock('@contractor-ops/logger', () => {
  const stub = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };
  const loggerStub = { ...stub, child: vi.fn(() => ({ ...stub, child: vi.fn(() => stub) })) };
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

/** Each write route + a body that passes DTO validation (so it reaches the caller). */
const WRITE_ROUTES: Array<{ method: string; path: string; body: unknown }> = [
  {
    method: 'POST',
    path: '/v1/contractors',
    body: { legalName: 'Acme GmbH', type: 'COMPANY', countryCode: 'DE', currency: 'EUR' },
  },
  { method: 'PATCH', path: '/v1/contractors', body: { id: 'c-1', status: 'ACTIVE' } },
  {
    method: 'POST',
    path: '/v1/invoices',
    body: {
      contractorId: 'c-1',
      invoiceNumber: 'INV-1',
      issueDate: '2026-01-01',
      dueDate: '2026-02-01',
      currency: 'EUR',
      subtotalMinor: 100,
      totalMinor: 100,
    },
  },
  { method: 'PATCH', path: '/v1/invoices/void', body: { id: 'inv-1' } },
  { method: 'PATCH', path: '/v1/payments', body: { itemId: 'pay-1', status: 'PAID' } },
  { method: 'POST', path: '/v1/payment-runs', body: { invoiceIds: ['inv-1'] } },
  {
    method: 'PATCH',
    path: '/v1/payment-runs/transition',
    body: { id: 'run-1', status: 'CANCELLED' },
  },
  { method: 'POST', path: '/v1/payment-runs/export', body: { id: 'run-1', format: 'CSV' } },
  { method: 'POST', path: '/v1/workflows', body: { templateId: 'wt-1', contractorId: 'c-1' } },
  {
    method: 'POST',
    path: '/v1/workflows/execute',
    body: { templateId: 'wt-1', contractorId: 'c-1' },
  },
  {
    method: 'PATCH',
    path: '/v1/workflow-tasks/transition',
    body: { taskRunId: 'task-1', status: 'DONE' },
  },
];

function bearer() {
  return { Authorization: 'Bearer co_live_dark-routes-key', 'content-type': 'application/json' };
}

describe('write routes are dark — 404 when module.public-api is OFF', () => {
  for (const { method, path, body } of WRITE_ROUTES) {
    it(`${method} ${path} → 404 (flag off)`, async () => {
      const res = await app.request(path, {
        method,
        headers: bearer(),
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(404);
    });
  }
});

describe('write routes are present in the derived OpenAPI 3.1 document (un-hidden)', () => {
  it('the doc now contains the un-hidden write operations', () => {
    const doc = buildOpenApiDocument(app);
    const writeVerbs = ['post', 'patch', 'put', 'delete'];
    let writeOps = 0;
    for (const ops of Object.values(doc.paths ?? {})) {
      for (const verb of writeVerbs) {
        if ((ops as Record<string, unknown>)[verb]) writeOps += 1;
      }
    }
    // The 11 un-hidden write routes across the 6 delivered entities are now in
    // the spec. `_initiatePayoutForRun` stays deferred (never exposed).
    expect(writeOps).toBe(WRITE_ROUTES.length);
  });
});
