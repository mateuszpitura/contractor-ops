/**
 * Contract tests for the tRPC mount.
 *
 * The router itself (every staff + portal procedure) is exhaustively
 * tested in `packages/api`. Here we only assert the Fastify bridge:
 *
 *   - GET /api/trpc/<unknown> returns a tRPC-shaped JSON error, NOT a
 *     Fastify 404 — proves fetchRequestHandler ran and tRPC decided.
 *   - GET /api/trpc/portal/<unknown> hits the portal router (separate
 *     mount) and returns a tRPC-shaped JSON error.
 *   - POST /api/trpc/foo with Content-Length above TRPC_MAX_BODY_MB
 *     short-circuits to 413 BEFORE the body is read.
 *   - Origin guard exempts batched POSTs from the allowlisted SPA origin
 *     and rejects them from foreign origins (defense-in-depth alongside
 *     Better Auth's CSRF token).
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __resetEnvForTests } from '../env.js';
import { buildServer } from '../server.js';

let app: FastifyInstance;

beforeAll(async () => {
  __resetEnvForTests();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  __resetEnvForTests();
});

describe('tRPC staff mount', () => {
  it('routes unknown staff procedure to tRPC (not a Fastify 404)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/trpc/__definitely_not_a_real_procedure__',
    });
    // tRPC answers unknown procedures with 404 + a structured JSON-RPC
    // error body. Fastify's own 404 envelope is `{statusCode:404,error:..}`;
    // tRPC's is `{error:{json:{message,code,..}}}`. We assert the tRPC
    // shape, which proves the bridge handed the request off.
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.body).toMatch(/"error"\s*:/);
    expect(res.body).not.toContain('"statusCode":404');
  });
});

describe('tRPC portal mount', () => {
  it('routes unknown portal procedure to the portal router', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/trpc/portal/__definitely_not_a_real_procedure__',
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.body).toMatch(/"error"\s*:/);
    expect(res.body).not.toContain('"statusCode":404');
  });
});

describe('tRPC body cap (F-SCALE-17)', () => {
  it('rejects oversize POST with 413 before the body is read', async () => {
    const oversize = 'x'.repeat(2 * 1024 * 1024); // 2 MB payload, default cap 1 MB.
    const res = await app.inject({
      method: 'POST',
      url: '/api/trpc/anything',
      headers: {
        'content-type': 'application/json',
        // Allowlisted origin so the CSRF guard doesn't fire first.
        origin: process.env.APP_URL ?? 'https://app.example.test',
        'content-length': String(Buffer.byteLength(oversize)),
      },
      payload: oversize,
    });
    expect(res.statusCode).toBe(413);
    expect(JSON.parse(res.body)).toMatchObject({
      error: { code: -32600, data: { httpStatus: 413 } },
    });
  });
});

describe('tRPC origin guard interaction', () => {
  it('passes a POST from the allowlisted SPA origin to tRPC (not 403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/trpc/__some_proc__?batch=1',
      headers: {
        'content-type': 'application/json',
        origin: process.env.APP_URL ?? 'https://app.example.test',
      },
      payload: JSON.stringify({ '0': { json: null } }),
    });
    expect(res.statusCode).not.toBe(403);
  });

  it('rejects a POST from a foreign origin with 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/trpc/__some_proc__',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      payload: JSON.stringify({ '0': { json: null } }),
    });
    expect(res.statusCode).toBe(403);
  });
});
