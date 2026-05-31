import { describe, expect, it } from 'vitest';
import { looksLikeSecret } from '../secret-shape-detector.js';

// Each row: [patternId, label, positive (matches), negative (does not match)]
const PATTERN_MATRIX = [
  ['aws-access-key', 'AWS access key', 'AKIAIOSFODNN7EXAMPLE', 'a-vault-url-only'],
  [
    'aws-secret-access-key',
    'AWS secret access key (40-char base64-shaped)',
    'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    'short-label',
  ],
  [
    'github-pat-classic',
    'GitHub PAT (classic)',
    'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
    'pl_invoice_2026_01',
  ],
  [
    'github-pat-fine-grained',
    'GitHub PAT (fine-grained)',
    'github_pat_11ABCDEFG0aBcDeFgHiJkLmNoPqRsTuVwXyZ12345abcdefghijKLMNopqrstuvwxyzAB',
    'github_repo_name',
  ],
  ['github-oauth', 'GitHub OAuth token', 'gho_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890', 'gho_short'],
  [
    'github-server-token',
    'GitHub server token',
    'ghs_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890',
    'ghs_short',
  ],
  [
    'jwt',
    'JWT 3-segment',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    'plain-string',
  ],
  ['hex-32-plus', 'Hex 32+ chars', 'd41d8cd98f00b204e9800998ecf8427e1234abcd', '0xshort'],
  [
    'slack-bot-token',
    'Slack bot token',
    'xoxb-123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx',
    'channel-name',
  ],
  ['stripe-key', 'Stripe key', 'sk_live_aBcDeFgHiJkLmNoPqRsTuVwX', 'sk_short'],
  [
    'google-api-key',
    'Google API key',
    'AIzaSyAbcdefghijklmnopqrstuvwxyz0123456',
    'project-name-only',
  ],
  [
    'private-key-block',
    'PEM private-key block',
    '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQ',
    'public-pem-info',
  ],
] as const;

describe('looksLikeSecret (Phase 75 D-11)', () => {
  describe.each(PATTERN_MATRIX)('%s — %s', (patternId, _label, positive, negative) => {
    it('flags positive sample as matched', () => {
      const result = looksLikeSecret(positive);
      expect(result.matched).toBe(true);
      expect(result.patternId).toBe(patternId);
    });

    it('does NOT flag negative sample', () => {
      const result = looksLikeSecret(negative);
      expect(result.matched).toBe(false);
    });
  });

  it('empty string is not a secret', () => {
    expect(looksLikeSecret('').matched).toBe(false);
  });

  it('returns the FIRST matching pattern when input matches multiple shapes', () => {
    // An AWS access key also satisfies broader shapes — assertion locks the
    // priority order. Implementer in Plan 75-05 must order patterns
    // most-specific-first.
    const result = looksLikeSecret('AKIAIOSFODNN7EXAMPLE');
    expect(result.matched).toBe(true);
    expect(['aws-access-key']).toContain(result.patternId);
  });
});
