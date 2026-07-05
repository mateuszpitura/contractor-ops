// Guards the single-source-of-truth invariant for Sentry PII scrubbing.
//
// The four `sentry-scrub.ts` copies (apps/api, apps/public-api,
// apps/cron-worker, apps/web-vite) must all consume `isPiiScrubKey` /
// `PII_SCRUB_KEYWORDS` from this package rather than hand-maintaining parallel
// keyword lists — the historical drift that left the Node/browser scrubbers out
// of sync with the logger mask. These tests fail if the shared list loses
// coverage OR if any copy reintroduces a local hand-list.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { isPiiScrubKey, PII_SCRUB_KEYWORDS } from '../pii-mask.js';

// The keywords historically MISSING from the hand-copied scrub lists (present
// in the pino mask but not the Sentry scrubbers) plus a sample of the
// pre-existing coverage — the full set the shared list must carry.
const REQUIRED_KEYWORDS = [
  // formerly missing from the sentry-scrub copies
  'ssn',
  'ein',
  'pesel',
  'iqama',
  'emiratesid',
  'nationalid',
  'routingnumber',
  'accountnumber',
  'sortcode',
  'dateofbirth',
  // pre-existing coverage that must not regress
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'iban',
  'swiftbic',
  'taxid',
  'utr',
  'ninumber',
  'vatnumber',
  'steuernummer',
  'sozialversicherungsnummer',
] as const;

const SCRUB_FILES = [
  'apps/api/src/lib/sentry-scrub.ts',
  'apps/public-api/src/lib/sentry-scrub.ts',
  'apps/cron-worker/src/lib/sentry-scrub.ts',
  'apps/web-vite/src/lib/sentry-scrub.ts',
] as const;

describe('PII_SCRUB_KEYWORDS — coverage', () => {
  it('contains every required keyword (incl. the formerly-missing identifiers)', () => {
    for (const keyword of REQUIRED_KEYWORDS) {
      expect(PII_SCRUB_KEYWORDS).toContain(keyword);
    }
  });

  it('redacts a representative host key for each formerly-missing identifier', () => {
    // camelCase host keys prove case-insensitive substring matching.
    const sampleKeys = [
      'contractorSsn',
      'employerEin',
      'employeePesel',
      'iqamaNumber',
      'emiratesId',
      'nationalId',
      'routingNumber',
      'bankAccountNumber',
      'sortCode',
      'dateOfBirth',
    ];
    for (const key of sampleKeys) {
      expect(isPiiScrubKey(key), `${key} must be treated as PII`).toBe(true);
    }
  });

  it('does not redact benign keys', () => {
    for (const key of ['email', 'displayName', 'organizationId', 'status', 'amount']) {
      expect(isPiiScrubKey(key), `${key} must not be redacted`).toBe(false);
    }
  });
});

describe('sentry-scrub copies — no drift', () => {
  it('all four import the shared predicate and keep no local keyword list', () => {
    for (const rel of SCRUB_FILES) {
      const src = readFileSync(new URL(`../../../../${rel}`, import.meta.url), 'utf8');
      expect(src, `${rel} must import isPiiScrubKey from @contractor-ops/logger/pii-mask`).toMatch(
        /import\s*\{\s*isPiiScrubKey\s*\}\s*from\s*'@contractor-ops\/logger\/pii-mask'/,
      );
      expect(src, `${rel} must not define a local PII_KEYWORDS list`).not.toMatch(
        /const\s+PII_KEYWORDS\s*=/,
      );
    }
  });
});
