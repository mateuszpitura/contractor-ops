/** @vitest-environment node */

/**
 * Pins for the `signup_completed` PostHog capture on successful Better
 * Auth `/sign-up/email` responses. The auth plugin wraps
 * `auth.handler(Request)` and fires `captureEvent` once the user id is
 * resolvable from the success body — a regression here would silently
 * break the anonymous-landing → signup conversion funnel.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { authHandlerSpy, captureEventSpy } = vi.hoisted(() => ({
  authHandlerSpy: vi.fn<(req: Request) => Promise<Response>>(),
  captureEventSpy: vi.fn(async () => undefined),
}));

vi.mock('@contractor-ops/auth', () => ({
  auth: { handler: authHandlerSpy },
}));

vi.mock('@contractor-ops/api/services/posthog', () => ({
  captureEvent: captureEventSpy,
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
  authHandlerSpy.mockReset();
  captureEventSpy.mockReset();
  captureEventSpy.mockResolvedValue(undefined);
});

describe('auth plugin — signup_completed PostHog capture', () => {
  it('fires `signup_completed` with the user id on a 200 sign-up/email response', async () => {
    authHandlerSpy.mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'usr_abc123', email: 'a@b.test' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'a@b.test', password: 'p4ssw0rd!', name: 'Test' }),
    });

    expect(res.statusCode).toBe(200);
    // Auth plugin awaits the response before sending — capture has fired
    // by the time the test reads `res`.
    expect(captureEventSpy).toHaveBeenCalledTimes(1);
    expect(captureEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: 'usr_abc123',
        event: 'signup_completed',
        properties: expect.objectContaining({ source: 'auth.sign-up.email' }),
      }),
    );
  });

  it('does NOT fire on a 4xx sign-up response (duplicate email, invalid password, etc.)', async () => {
    authHandlerSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: 'EMAIL_TAKEN' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(captureEventSpy).not.toHaveBeenCalled();
  });

  it('does NOT fire on a 200 response missing the `user.id` field', async () => {
    authHandlerSpy.mockResolvedValue(
      new Response(JSON.stringify({ message: 'pending verification' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(captureEventSpy).not.toHaveBeenCalled();
  });

  it('does NOT fire on other auth paths (sign-in, sign-out, get-session)', async () => {
    authHandlerSpy.mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'usr_returning' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    for (const path of ['/api/auth/sign-in/email', '/api/auth/sign-out', '/api/auth/get-session']) {
      await app.inject({
        method: 'POST',
        url: path,
        headers: { 'content-type': 'application/json' },
        payload: '{}',
      });
    }
    expect(captureEventSpy).not.toHaveBeenCalled();
  });

  it('a thrown captureEvent does NOT propagate — the signup response is still 200', async () => {
    authHandlerSpy.mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'usr_xyz' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    captureEventSpy.mockRejectedValueOnce(new Error('posthog network down'));

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { 'content-type': 'application/json' },
      payload: '{}',
    });
    expect(res.statusCode).toBe(200);
  });
});
