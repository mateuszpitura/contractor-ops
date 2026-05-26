/** @vitest-environment node */

/**
 * Smoke tests for the `POST /teams/messages` Fastify port.
 *
 * Coverage:
 *   1. `authorizeJWT` rejects → forwarded 401 from shim.
 *   2. `adapter.process()` throws → 500 + error JSON.
 *   3. Happy path → shim status + body flushed onto Fastify reply.
 *
 * `@microsoft/agents-hosting` Cloud adapter + JWT middleware are mocked
 * so this test exercises only our Express ↔ Fastify bridge.
 * `TeamsBotHandler` is replaced with a noop class so the Activity
 * pipeline never runs against real Bot Framework code.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAuthorizeJWT, mockProcess } = vi.hoisted(() => ({
  mockAuthorizeJWT: vi.fn(),
  mockProcess: vi.fn(),
}));

vi.mock('@microsoft/agents-hosting', () => ({
  authorizeJWT: (..._a: unknown[]) => mockAuthorizeJWT,
  CloudAdapter: class {
    process(...a: unknown[]) {
      return mockProcess(...a);
    }
  },
}));

vi.mock('@contractor-ops/api/services/teams/teams-bot-handler', () => ({
  TeamsBotHandler: class {
    async run(_ctx: unknown) {
      /* no-op stub */
    }
  },
}));

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

beforeEach(() => {
  vi.clearAllMocks();
  // Default authorizeJWT: succeed by calling next(). The shim treats
  // anything that doesn't write a response and calls next() as
  // "authorized".
  mockAuthorizeJWT.mockImplementation(
    async (
      _req: unknown,
      _res: { status: (n: number) => unknown; send: (body: unknown) => unknown },
      next: () => void,
    ) => {
      next();
    },
  );
  // Default process(): set 200 + empty body on the shim res.
  mockProcess.mockImplementation(
    async (
      _req: unknown,
      res: {
        statusCode: number;
        status: (code: number) => unknown;
        send: (body: unknown) => unknown;
      },
      _logic: unknown,
    ) => {
      res.status(200);
      res.send({ ok: true });
    },
  );
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/teams/messages',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer fake.jwt.token',
      ...headers,
    },
    payload: JSON.stringify(body),
  });
}

describe('POST /teams/messages', () => {
  it('forwards 401 when authorizeJWT rejects (no next() call)', async () => {
    mockAuthorizeJWT.mockImplementationOnce(
      async (
        _req: unknown,
        res: { status: (n: number) => { send: (b: unknown) => unknown } },
        _next: () => void,
      ) => {
        res.status(401).send({ 'jwt-auth-error': 'authorization header not found' });
      },
    );
    const res = await post({ type: 'message' });
    expect(res.statusCode).toBe(401);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('returns 500 + error JSON when adapter.process() throws', async () => {
    mockProcess.mockRejectedValueOnce(new Error('botbuilder JWT validation blew up'));
    const res = await post({ type: 'message' });
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error?: string };
    expect(body.error).toBe('Internal server error');
  });

  it('flushes shim status + body onto Fastify reply on happy path', async () => {
    const res = await post({ type: 'message', text: 'hello' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { ok?: boolean };
    expect(body.ok).toBe(true);
    expect(mockProcess).toHaveBeenCalledTimes(1);
  });
});
