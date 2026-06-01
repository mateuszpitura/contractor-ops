import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  looksLikeSecret,
  looksLikeSecretInFreeText,
  looksLikeSecretInFreeTextRefinement,
  looksLikeSecretRefinement,
  SECRET_PATTERNS,
} from '../secret-shape-detector.js';

// Each row: [patternId, label, positive (matches), negative (does not match)]
const PATTERN_MATRIX: ReadonlyArray<[string, string, string, string]> = [
  ['aws-access-key', 'AWS access key', 'AKIAIOSFODNN7EXAMPLE', 'a-vault-url-only'],
  [
    'github-pat-fine-grained',
    'GitHub PAT (fine-grained)',
    'github_pat_11ABCDEFG0aBcDeFgHiJkLmNoPqRsTuVwXyZ12345abcdefghijKLMNopqrstuvwxyzAB',
    'github_repo_name',
  ],
  [
    'github-pat-classic',
    'GitHub PAT (classic)',
    'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
    'pl_invoice_2026_01',
  ],
  ['github-oauth', 'GitHub OAuth token', 'gho_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890', 'gho_short'],
  [
    'github-server-token',
    'GitHub server token',
    'ghs_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890',
    'ghs_short',
  ],
  ['stripe-key', 'Stripe key', 'sk_live_aBcDeFgHiJkLmNoPqRsTuVwX', 'sk_short'],
  [
    'google-api-key',
    'Google API key',
    'AIzaSyAbcdefghijklmnopqrstuvwxyz0123456',
    'project-name-only',
  ],
  [
    'slack-bot-token',
    'Slack bot token',
    'xoxb-123456789012-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx',
    'channel-name',
  ],
  [
    'jwt',
    'JWT 3-segment',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    'plain-string',
  ],
  [
    'private-key-block',
    'PEM private-key block',
    '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQ',
    'public-pem-info',
  ],
  [
    'aws-secret-access-key',
    'AWS secret access key (40-char base64)',
    'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    'short-label',
  ],
  ['hex-32-plus', 'Hex 32+ chars', 'd41d8cd98f00b204e9800998ecf8427e1234abcd', '0xshort'],
] as const;

describe('looksLikeSecret (Phase 75 D-11)', () => {
  describe.each(PATTERN_MATRIX)('%s — %s', (patternId, _label, positive, negative) => {
    it('flags positive sample as matched with expected patternId', () => {
      const result = looksLikeSecret(positive);
      expect(result.matched).toBe(true);
      expect(result.patternId).toBe(patternId);
      expect(result.fieldHint).toBeDefined();
    });

    it('does NOT flag negative sample', () => {
      const result = looksLikeSecret(negative);
      expect(result.matched).toBe(false);
      expect(result.patternId).toBeUndefined();
    });
  });

  it('empty string is not a secret', () => {
    expect(looksLikeSecret('').matched).toBe(false);
    expect(looksLikeSecret('   ').matched).toBe(false);
  });

  it('SECRET_PATTERNS is ordered most-specific-first (aws-access-key before hex-32-plus)', () => {
    const ids = SECRET_PATTERNS.map(p => p.id);
    expect(ids.indexOf('aws-access-key')).toBeLessThan(ids.indexOf('hex-32-plus'));
    expect(ids.indexOf('github-pat-fine-grained')).toBeLessThan(ids.indexOf('github-pat-classic'));
    expect(ids[ids.length - 1]).toBe('hex-32-plus'); // catch-all is last
  });

  it('looksLikeSecretRefinement attaches { reason, patternId, fieldHint } to Zod issue params', () => {
    const schema = z.string().superRefine(looksLikeSecretRefinement);
    const result = schema.safeParse('AKIAIOSFODNN7EXAMPLE');
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue?.code).toBe('custom');
      const params = (issue as unknown as { params?: Record<string, unknown> }).params;
      expect(params?.reason).toBe('looks_like_secret');
      expect(params?.patternId).toBe('aws-access-key');
    }
  });

  it('looksLikeSecretRefinement passes safe inputs through', () => {
    const schema = z.string().superRefine(looksLikeSecretRefinement);
    expect(schema.safeParse('https://my.1password.com/vaults/abc123').success).toBe(true);
    expect(schema.safeParse('Production AWS root').success).toBe(true);
    expect(schema.safeParse('Successor: Alice Anderson').success).toBe(true);
  });

  it('1Password vault URL containing hex chars is NOT flagged (hex-32-plus only fires on whole-string hex)', () => {
    expect(
      looksLikeSecret('https://my.1password.com/vaults/d41d8cd98f00b204e9800998ecf8427e1234abcd')
        .matched,
    ).toBe(false);
  });

  it('input with leading/trailing whitespace is trimmed before matching', () => {
    expect(looksLikeSecret('   AKIAIOSFODNN7EXAMPLE   ').matched).toBe(true);
    expect(looksLikeSecret('   AKIAIOSFODNN7EXAMPLE   ').patternId).toBe('aws-access-key');
  });
});

describe('looksLikeSecretInFreeText — embedded-secret detection for notes/label fields', () => {
  it('REJECTS an AWS access key embedded in notes prose', () => {
    const result = looksLikeSecretInFreeText(
      'Rotate the AKIAIOSFODNN7EXAMPLE key in the vault before Q3',
    );
    expect(result.matched).toBe(true);
    expect(result.patternId).toBe('aws-access-key');
  });

  it('REJECTS a GitHub classic PAT embedded in a label', () => {
    const result = looksLikeSecretInFreeText(
      'old token was ghp_1234567890abcdefghijklmnopqrstuvwxyz please rotate',
    );
    expect(result.matched).toBe(true);
    expect(result.patternId).toBe('github-pat-classic');
  });

  it('REJECTS a bare secret value (same as looksLikeSecret)', () => {
    const result = looksLikeSecretInFreeText('AKIAIOSFODNN7EXAMPLE');
    expect(result.matched).toBe(true);
    expect(result.patternId).toBe('aws-access-key');
  });

  it('does NOT flag safe prose without any embedded token', () => {
    expect(looksLikeSecretInFreeText('AWS root credentials stored in 1Password').matched).toBe(
      false,
    );
    expect(looksLikeSecretInFreeText('Production AWS root').matched).toBe(false);
  });

  it('does NOT flag a 1Password URL (hex chars within a URL path)', () => {
    expect(
      looksLikeSecretInFreeText(
        'See https://my.1password.com/vaults/d41d8cd98f00b204e9800998ecf8427e1234abcd for details',
      ).matched,
    ).toBe(false);
  });

  it('looksLikeSecretInFreeTextRefinement rejects embedded AKIA key via Zod', () => {
    const schema = z.string().superRefine(looksLikeSecretInFreeTextRefinement);
    const result = schema.safeParse('Rotate the AKIAIOSFODNN7EXAMPLE key in the vault');
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      const params = (issue as unknown as { params?: Record<string, unknown> }).params;
      expect(params?.reason).toBe('looks_like_secret');
      expect(params?.patternId).toBe('aws-access-key');
    }
  });

  it('looksLikeSecretInFreeTextRefinement passes safe prose', () => {
    const schema = z.string().superRefine(looksLikeSecretInFreeTextRefinement);
    expect(
      schema.safeParse('AWS credentials are stored in 1Password under the Vault ops team').success,
    ).toBe(true);
  });
});
