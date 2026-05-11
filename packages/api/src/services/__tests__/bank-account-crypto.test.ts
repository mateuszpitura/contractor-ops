import { randomBytes } from 'node:crypto';
import { resetServerEnvCacheForTesting } from '@contractor-ops/validators';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decryptBankAccount, encryptBankAccount } from '../bank-account-crypto';

const TEST_KEY = randomBytes(32).toString('hex');

describe('bank-account-crypto', () => {
  beforeEach(() => {
    vi.stubEnv('BANK_ACCOUNT_ENCRYPTION_KEY', TEST_KEY);
    resetServerEnvCacheForTesting();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCacheForTesting();
  });

  it('throws when BANK_ACCOUNT_ENCRYPTION_KEY is missing', () => {
    vi.stubEnv('BANK_ACCOUNT_ENCRYPTION_KEY', undefined);
    resetServerEnvCacheForTesting();
    expect(() => encryptBankAccount('PL61109010140000071219812874')).toThrow(
      /Environment validation failed/,
    );
  });

  it('round-trips a Polish IBAN', () => {
    const iban = 'PL61109010140000071219812874';
    const encrypted = encryptBankAccount(iban);
    expect(encrypted.split(':')).toHaveLength(3);
    expect(decryptBankAccount(encrypted)).toBe(iban);
  });

  it('uses a fresh IV each encryption so ciphertext differs', () => {
    const iban = 'PL61109010140000071219812874';
    const a = encryptBankAccount(iban);
    const b = encryptBankAccount(iban);
    expect(a).not.toBe(b);
    expect(decryptBankAccount(a)).toBe(iban);
    expect(decryptBankAccount(b)).toBe(iban);
  });

  it('throws on invalid encrypted payload format', () => {
    expect(() => decryptBankAccount('not-three-parts')).toThrow(
      'Invalid encrypted bank account format',
    );
  });
});
