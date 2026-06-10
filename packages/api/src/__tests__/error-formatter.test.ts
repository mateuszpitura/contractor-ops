/**
 * Unit coverage for the pure `formatTrpcError` exported from init.ts.
 *
 * Scope: shape contract — errorKey / errorParams surfacing,
 * INTERNAL_SERVER_ERROR stripping, and the dev-mode pass-through that
 * still attaches the new fields.
 *
 * The function is pure (no logger / HTTP), so each branch is asserted by
 * constructing a minimal `shape` + `TRPCError` and reading the result.
 */

import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';
import * as ApiErrors from '../errors.js';
import { formatTrpcError } from '../init.js';

function makeShape(code: number, codeName: string, message: string) {
  return {
    code,
    message,
    data: { code: codeName },
  };
}

describe('formatTrpcError — errorKey / errorParams contract', () => {
  it('surfaces a known errors.ts value as shape.data.errorKey (dev)', () => {
    const error = new TRPCError({
      code: 'NOT_FOUND',
      message: ApiErrors.CONTRACTOR_NOT_FOUND,
    });
    const result = formatTrpcError({
      shape: makeShape(404, 'NOT_FOUND', ApiErrors.CONTRACTOR_NOT_FOUND),
      error,
      path: 'contractor.byId',
      type: 'query',
      isProduction: false,
    });
    expect(result.data.errorKey).toBe('contractorNotFound');
  });

  it('falls back to unknownError when message is not a registered key', () => {
    const error = new TRPCError({
      code: 'BAD_REQUEST',
      // biome-ignore lint/plugin/no-untranslated-trpc-error: deliberate non-key string for fallback assertion
      message: 'something raw and english',
    });
    const result = formatTrpcError({
      shape: makeShape(400, 'BAD_REQUEST', 'something raw and english'),
      error,
      path: 'foo.bar',
      type: 'mutation',
      isProduction: false,
    });
    expect(result.data.errorKey).toBe(ApiErrors.UNKNOWN_ERROR);
  });

  it('copies cause.params to shape.data.errorParams', () => {
    const error = new TRPCError({
      code: 'NOT_FOUND',
      message: ApiErrors.CONTRACTOR_NOT_FOUND,
      cause: { params: { id: 'c1' } },
    });
    const result = formatTrpcError({
      shape: makeShape(404, 'NOT_FOUND', ApiErrors.CONTRACTOR_NOT_FOUND),
      error,
      path: 'contractor.byId',
      type: 'query',
      isProduction: false,
    });
    expect(result.data.errorParams).toEqual({ id: 'c1' });
  });

  it('omits errorParams entirely when cause has no params', () => {
    const error = new TRPCError({ code: 'FORBIDDEN', message: ApiErrors.FORBIDDEN });
    const result = formatTrpcError({
      shape: makeShape(403, 'FORBIDDEN', ApiErrors.FORBIDDEN),
      error,
      path: 'p',
      type: 'query',
      isProduction: false,
    });
    expect('errorParams' in result.data).toBe(false);
  });

  it('passes through numeric and string params unchanged', () => {
    const error = new TRPCError({
      code: 'BAD_REQUEST',
      message: ApiErrors.INVOICE_AMOUNT_MISMATCH,
      cause: { params: { expected: 100, actualCurrency: 'EUR' } },
    });
    const result = formatTrpcError({
      shape: makeShape(400, 'BAD_REQUEST', ApiErrors.INVOICE_AMOUNT_MISMATCH),
      error,
      path: 'invoice.confirm',
      type: 'mutation',
      isProduction: true,
    });
    expect(result.data.errorParams).toEqual({ expected: 100, actualCurrency: 'EUR' });
  });
});

describe('formatTrpcError — F-SEC-20 production hardening', () => {
  it('strips INTERNAL_SERVER_ERROR message and forces errorKey unknownError', () => {
    const error = new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      // biome-ignore lint/plugin/no-untranslated-trpc-error: deliberate raw message for INTERNAL_SERVER_ERROR stripping assertion
      message: 'Prisma constraint violation foo_bar_idx',
    });
    const result = formatTrpcError({
      shape: makeShape(500, 'INTERNAL_SERVER_ERROR', 'Prisma constraint violation foo_bar_idx'),
      error,
      path: 'foo',
      type: 'mutation',
      isProduction: true,
    });
    expect(result.message).toBe('Internal server error');
    expect(result.data.errorKey).toBe(ApiErrors.UNKNOWN_ERROR);
    expect(result.data.stack).toBeUndefined();
    expect(result.data.zodError).toBeNull();
  });

  it('attaches errorKey + errorParams to BAD_REQUEST without a ZodError cause', () => {
    // Note: zod v4 ZodError does NOT extend Error, so tRPC v11 wraps it via
    // getCauseFromUnknown into an UnknownCauseError. The legacy
    // `error.cause instanceof ZodError` branch in init.ts is therefore
    // unreachable for v4 schemas — pre-existing production-hardening hole, out of
    // scope for the i18n contract. The relevant guarantee here is that errorKey +
    // errorParams reach `shape.data` regardless of which branch handles the
    // BAD_REQUEST.
    const error = new TRPCError({
      code: 'BAD_REQUEST',
      message: ApiErrors.VALIDATION_LEGAL_NAME_REQUIRED,
      cause: { params: { field: 'legalName' } },
    });
    const result = formatTrpcError({
      shape: makeShape(400, 'BAD_REQUEST', ApiErrors.VALIDATION_LEGAL_NAME_REQUIRED),
      error,
      path: 'contractor.create',
      type: 'mutation',
      isProduction: true,
    });
    expect(result.data.errorKey).toBe('validationLegalNameRequired');
    expect(result.data.errorParams).toEqual({ field: 'legalName' });
  });

  it('caps non-INTERNAL coded message at 200 chars and keeps errorKey', () => {
    const longMessage = 'x'.repeat(500);
    const error = new TRPCError({ code: 'NOT_FOUND', message: longMessage });
    const result = formatTrpcError({
      shape: makeShape(404, 'NOT_FOUND', longMessage),
      error,
      path: 'p',
      type: 'query',
      isProduction: true,
    });
    expect((result.message as string).length).toBeLessThanOrEqual(200);
    expect(result.data.errorKey).toBe(ApiErrors.UNKNOWN_ERROR);
    expect(result.data.stack).toBeUndefined();
  });
});
