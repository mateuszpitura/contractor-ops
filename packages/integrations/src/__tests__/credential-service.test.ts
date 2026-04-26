import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decryptCredentials,
  encryptCredentials,
  getProviderEncryptionKey,
} from '../services/credential-service.js';
import type { CredentialBlob } from '../types/credentials.js';

// Generate deterministic test keys (32 bytes = 64 hex chars)
const TEST_KEY_SLACK = randomBytes(32).toString('hex');
const TEST_KEY_JIRA = randomBytes(32).toString('hex');

describe('credential-service', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_ENCRYPTION_KEY', TEST_KEY_SLACK);
    vi.stubEnv('JIRA_ENCRYPTION_KEY', TEST_KEY_JIRA);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('encrypt/decrypt round-trip', () => {
    it('should encrypt and decrypt a credential blob correctly', () => {
      const blob: CredentialBlob = {
        accessToken: 'xoxb-test-token-12345',
        refreshToken: 'xoxr-refresh-token-67890',
        tokenType: 'bearer',
        scope: 'chat:write,users:read',
        expiresAt: '2026-04-01T00:00:00Z',
        extra: { teamId: 'T12345', teamName: 'Test Workspace' },
      };

      const encrypted = encryptCredentials(blob, 'slack');
      expect(encrypted).toContain(':');
      expect(encrypted.split(':')).toHaveLength(3);

      const decrypted = decryptCredentials(encrypted, 'slack');
      expect(decrypted).toEqual(blob);
    });

    it('should handle minimal credential blob (access token only)', () => {
      const blob: CredentialBlob = {
        accessToken: 'simple-api-key',
      };

      const encrypted = encryptCredentials(blob, 'slack');
      const decrypted = decryptCredentials(encrypted, 'slack');
      expect(decrypted).toEqual(blob);
    });

    it('should produce different ciphertexts for the same input (random IV)', () => {
      const blob: CredentialBlob = { accessToken: 'same-token' };

      const encrypted1 = encryptCredentials(blob, 'slack');
      const encrypted2 = encryptCredentials(blob, 'slack');

      expect(encrypted1).not.toEqual(encrypted2);

      // Both should decrypt to the same value
      expect(decryptCredentials(encrypted1, 'slack')).toEqual(blob);
      expect(decryptCredentials(encrypted2, 'slack')).toEqual(blob);
    });
  });

  describe('per-provider key isolation', () => {
    it('should fail to decrypt with a different provider key', () => {
      const blob: CredentialBlob = {
        accessToken: 'secret-token',
        refreshToken: 'refresh-token',
      };

      const encrypted = encryptCredentials(blob, 'slack');

      expect(() => decryptCredentials(encrypted, 'jira')).toThrow();
    });
  });

  describe('invalid format handling', () => {
    it('should throw on malformed encrypted string (missing parts)', () => {
      expect(() => decryptCredentials('not-valid', 'slack')).toThrow(
        'Invalid encrypted credentials format',
      );
    });

    it('should throw on empty string', () => {
      expect(() => decryptCredentials('', 'slack')).toThrow('Invalid encrypted credentials format');
    });

    it('should throw on corrupted ciphertext', () => {
      const blob: CredentialBlob = { accessToken: 'test' };
      const encrypted = encryptCredentials(blob, 'slack');
      const parts = encrypted.split(':');
      // Corrupt the ciphertext portion
      parts[2] = 'deadbeef';
      const corrupted = parts.join(':');

      expect(() => decryptCredentials(corrupted, 'slack')).toThrow();
    });
  });

  describe('getProviderEncryptionKey', () => {
    it('should throw descriptive error for missing env var', () => {
      expect(() => getProviderEncryptionKey('nonexistent')).toThrow(
        'NONEXISTENT_ENCRYPTION_KEY environment variable is not set',
      );
    });

    it('should return a Buffer for valid env var', () => {
      const key = getProviderEncryptionKey('slack');
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });
  });
});
