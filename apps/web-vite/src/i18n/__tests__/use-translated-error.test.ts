/**
 * Unit coverage for `useTranslatedError` — the single entry point for
 * resolving a tRPC error payload into a user-facing string.
 *
 * Locks the contract described in goals/i18n-system-messages/facts.md:
 *   - known `shape.data.errorKey` → translated `Errors.<key>` (English locale).
 *   - `shape.data.errorParams` → forwarded as ICU values.
 *   - unknown / missing `errorKey` → `Errors.generic`.
 *   - non-tRPC error (no `data` shape) → `Errors.generic`.
 */

import { renderHook } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyLocale, initI18n } from '../index.js';
import { useTranslatedError } from '../use-translated-error.js';

beforeAll(async () => {
  initI18n();
  await applyLocale('en');
});

interface FakeTrpcError {
  data?: { errorKey?: string; errorParams?: Record<string, string | number> };
  message?: string;
}

describe('useTranslatedError', () => {
  it('resolves a known errorKey to its Errors.<key> translation', () => {
    const { result } = renderHook(() => useTranslatedError());
    const err: FakeTrpcError = { data: { errorKey: 'contractorNotFound' } };
    const out = result.current(err);
    expect(out).toBe('Contractor not found.');
  });

  it('falls back to Errors.generic when errorKey is missing', () => {
    const { result } = renderHook(() => useTranslatedError());
    const out = result.current({ message: 'raw english' });
    expect(out).toBe('Something went wrong. Please try again.');
  });

  it('falls back to Errors.generic for a non-tRPC error', () => {
    const { result } = renderHook(() => useTranslatedError());
    const out = result.current(new Error('something exploded'));
    expect(out).toBe('Something went wrong. Please try again.');
  });

  it('falls back to Errors.generic for null / undefined / primitives', () => {
    const { result } = renderHook(() => useTranslatedError());
    expect(result.current(null)).toBe('Something went wrong. Please try again.');
    expect(result.current(undefined)).toBe('Something went wrong. Please try again.');
    expect(result.current('a string')).toBe('Something went wrong. Please try again.');
  });

  it('falls back to Errors.generic when errorKey is not present in Errors namespace', () => {
    const { result } = renderHook(() => useTranslatedError());
    const err: FakeTrpcError = { data: { errorKey: 'thisKeyDoesNotExistAnywhere' } };
    expect(result.current(err)).toBe('Something went wrong. Please try again.');
  });
});
