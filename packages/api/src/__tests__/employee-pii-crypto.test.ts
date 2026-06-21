// Employee national-ID field-encryption contract.
//
// RED until `packages/api/src/services/employee-pii-crypto.ts` is created
// exporting `encryptPii` / `decryptPii` / `maskLast4` (AES-256-GCM,
// `iv:authTag:ciphertext`, keyed by the dedicated `EMPLOYEE_PII_ENCRYPTION_KEY`
// — a SEPARATE key from SSN_ENCRYPTION_KEY so PESEL/Iqama/Emirates-ID and the
// US SSN column have distinct blast radii). Mirrors ssn-crypto.test.ts. The
// import below resolves to a not-yet-existing module so the suite fails at
// module resolution (Cannot find module). This scaffold is P89-independent and
// turns GREEN once the crypto service lands.

import { randomBytes } from 'node:crypto';
import { resetServerEnvCacheForTesting } from '@contractor-ops/validators';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptPii, encryptPii, maskLast4 } from '../services/employee-pii-crypto.js';

const TEST_KEY = randomBytes(32).toString('hex');

describe('employee-pii-crypto', () => {
  beforeEach(() => {
    vi.stubEnv('EMPLOYEE_PII_ENCRYPTION_KEY', TEST_KEY);
    resetServerEnvCacheForTesting();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCacheForTesting();
  });

  it('round-trips a national-ID value', () => {
    const pesel = '44051401359';
    const encrypted = encryptPii(pesel);
    expect(decryptPii(encrypted)).toBe(pesel);
  });

  it('emits iv:authTag:ciphertext (three colon-separated hex parts)', () => {
    const encrypted = encryptPii('44051401359');
    expect(encrypted.split(':')).toHaveLength(3);
  });

  it('uses a fresh IV each encryption so two encrypts of the same value differ', () => {
    const value = '44051401359';
    const a = encryptPii(value);
    const b = encryptPii(value);
    expect(a).not.toBe(b);
    expect(decryptPii(a)).toBe(value);
    expect(decryptPii(b)).toBe(value);
  });

  it('throws on a malformed encrypted payload (not three parts)', () => {
    expect(() => decryptPii('not-three-parts')).toThrow();
  });

  it('derives last4 as the trailing four digits of the cleaned value', () => {
    // The write path stores `<id>Last4 = maskLast4(value)` alongside the
    // ciphertext; the derivation strips non-digit separators first.
    expect(maskLast4('784-1990-1234567-1')).toBe('5671');
    expect(maskLast4('44051401359')).toBe('1359');
  });
});
