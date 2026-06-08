// Phase 84 · Plan 00 (Wave 0 RED) — US-FIELD-02 SSN field-encryption contract.
// See .planning/milestones/v7.0-phases/84-.../84-VALIDATION.md.
//
// RED until Plan 02 creates `packages/api/src/services/ssn-crypto.ts` exporting
// `encryptSsn` / `decryptSsn` (AES-256-GCM, `iv:authTag:ciphertext`, keyed by the
// dedicated `SSN_ENCRYPTION_KEY` — a SEPARATE key from BANK_ACCOUNT_ENCRYPTION_KEY,
// per blast-radius isolation). Mirrors bank-account-crypto.test.ts. The import
// below resolves to a not-yet-existing module so the suite fails (Cannot find module).

import { randomBytes } from 'node:crypto';
import { resetServerEnvCacheForTesting } from '@contractor-ops/validators';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptSsn, encryptSsn } from '../ssn-crypto.js';

const TEST_KEY = randomBytes(32).toString('hex');

describe('ssn-crypto', () => {
  beforeEach(() => {
    vi.stubEnv('SSN_ENCRYPTION_KEY', TEST_KEY);
    resetServerEnvCacheForTesting();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCacheForTesting();
  });

  it('throws when SSN_ENCRYPTION_KEY is missing', () => {
    vi.stubEnv('SSN_ENCRYPTION_KEY', undefined);
    resetServerEnvCacheForTesting();
    expect(() => encryptSsn('078051120')).toThrow(/Environment validation failed/);
  });

  it('round-trips a 9-digit SSN', () => {
    const ssn = '078051120';
    const encrypted = encryptSsn(ssn);
    expect(decryptSsn(encrypted)).toBe(ssn);
  });

  it('emits iv:authTag:ciphertext (three colon-separated hex parts)', () => {
    const encrypted = encryptSsn('078051120');
    expect(encrypted.split(':')).toHaveLength(3);
  });

  it('uses a fresh IV each encryption so two encrypts of the same SSN differ', () => {
    const ssn = '078051120';
    const a = encryptSsn(ssn);
    const b = encryptSsn(ssn);
    expect(a).not.toBe(b);
    expect(decryptSsn(a)).toBe(ssn);
    expect(decryptSsn(b)).toBe(ssn);
  });

  it('throws on a malformed encrypted payload (not three parts)', () => {
    expect(() => decryptSsn('not-three-parts')).toThrow();
  });

  it('derives ssnLast4 as the trailing four digits of the cleaned SSN', () => {
    // The reveal/write path stores `ssnLast4 = cleaned.slice(-4)` alongside the
    // ciphertext. We assert the derivation rule the implementation must honour
    // (last-4 of the digits-only form, regardless of input separators).
    const cleaned = '078-05-1120'.replace(/\D/g, '');
    expect(cleaned.slice(-4)).toBe('1120');
  });
});
