/**
 * Unit tests for error-handler.ts
 *
 * Covers: TRPC_TO_HTTP mapping, structured TIER_REQUIRED messages,
 * Zod validation errors, unknown TRPCError codes, plain Error fallback.
 */

import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

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
    createTrpcLogger: vi.fn(() => stub),
    createLogger: vi.fn(() => loggerStub),
    createCronLogger: vi.fn(() => stub),
    createWebhookLogger: vi.fn(() => stub),
    createIntegrationLogger: vi.fn(() => stub),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { handleError } from '../error-handler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext() {
  const jsonMock = vi.fn((body: unknown, status?: number) => ({ body, status }));
  const headerMock = vi.fn();
  return {
    json: jsonMock,
    req: { header: vi.fn() },
    header: headerMock,
  } as unknown as import('hono').Context;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleError', () => {
  describe('TRPCError → HTTP status mapping', () => {
    const cases: Array<[string, number]> = [
      ['PARSE_ERROR', 422],
      ['BAD_REQUEST', 400],
      ['UNAUTHORIZED', 401],
      ['FORBIDDEN', 403],
      ['NOT_FOUND', 404],
      ['METHOD_NOT_SUPPORTED', 405],
      ['TIMEOUT', 408],
      ['CONFLICT', 409],
      ['PAYLOAD_TOO_LARGE', 413],
      ['UNPROCESSABLE_CONTENT', 422],
      ['TOO_MANY_REQUESTS', 429],
      ['INTERNAL_SERVER_ERROR', 500],
    ];

    for (const [code, expectedStatus] of cases) {
      it(`maps ${code} → ${expectedStatus}`, () => {
        const c = makeContext();
        const err = new TRPCError({ code: code as never, message: code });
        handleError(err, c);
        expect(c.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ status: expectedStatus }),
          }),
          expectedStatus,
        );
      });
    }

    it('falls back to 500 for an unknown TRPCError code', () => {
      const c = makeContext();
      const err = new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'oops' });
      // Override code after construction to simulate unknown
      Object.defineProperty(err, 'code', { value: 'TOTALLY_UNKNOWN_CODE' });
      handleError(err, c);
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ status: 500 }) }),
        500,
      );
    });
  });

  describe('JSON body shape', () => {
    it('returns {error:{code,message,status}} for TRPCError', () => {
      const c = makeContext();
      const err = new TRPCError({ code: 'NOT_FOUND', message: 'not here' });
      handleError(err, c);
      const [body] = (c.json as ReturnType<typeof vi.fn>).mock.calls[0] as [
        { error: { code: string; message: string; status: number } },
      ];
      expect(body.error).toMatchObject({
        code: expect.any(String),
        message: expect.any(String),
        status: 404,
      });
    });
  });

  describe('TIER_REQUIRED structured message', () => {
    it('extracts code=TIER_REQUIRED and message mentions requiredTier', () => {
      const c = makeContext();
      const message = JSON.stringify({ type: 'TIER_REQUIRED', requiredTier: 'ENTERPRISE' });
      const err = new TRPCError({ code: 'FORBIDDEN', message });
      handleError(err, c);
      const [body] = (c.json as ReturnType<typeof vi.fn>).mock.calls[0] as [
        { error: { code: string; message: string } },
      ];
      expect(body.error.code).toBe('TIER_REQUIRED');
      expect(body.error.message).toContain('ENTERPRISE');
    });

    it('uses correct HTTP status (403 FORBIDDEN) for TIER_REQUIRED', () => {
      const c = makeContext();
      const message = JSON.stringify({ type: 'TIER_REQUIRED', requiredTier: 'PRO' });
      const err = new TRPCError({ code: 'FORBIDDEN', message });
      handleError(err, c);
      expect(c.json).toHaveBeenCalledWith(expect.any(Object), 403);
    });
  });

  describe('Zod validation error (BAD_REQUEST + "validation" message)', () => {
    it('returns code=VALIDATION_ERROR and canned message', () => {
      const c = makeContext();
      const err = new TRPCError({
        code: 'BAD_REQUEST',
        message: '[{"validation":"invalid type","message":"..."}]',
      });
      handleError(err, c);
      const [body] = (c.json as ReturnType<typeof vi.fn>).mock.calls[0] as [
        { error: { code: string; message: string } },
      ];
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Invalid request parameters.');
    });

    it('returns 400 status for validation error', () => {
      const c = makeContext();
      const err = new TRPCError({
        code: 'BAD_REQUEST',
        message: 'some "validation" issue',
      });
      handleError(err, c);
      expect(c.json).toHaveBeenCalledWith(expect.any(Object), 400);
    });
  });

  describe('plain Error (non-TRPCError)', () => {
    it('returns 500 with code=INTERNAL_SERVER_ERROR', () => {
      const c = makeContext();
      const err = new Error('something exploded');
      handleError(err, c);
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            status: 500,
          }),
        }),
        500,
      );
    });

    it('calls logger.error for non-TRPCError', async () => {
      const { createLogger } = await import('@contractor-ops/logger');
      const logStub = (createLogger as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      const c = makeContext();
      const err = new Error('boom');
      handleError(err, c);
      expect(logStub?.error).toHaveBeenCalled();
    });
  });
});
