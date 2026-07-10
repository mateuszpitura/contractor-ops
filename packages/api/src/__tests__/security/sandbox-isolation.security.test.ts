/**
 * The load-bearing sandbox-isolation control.
 *
 * A `co_test_` key resolves ONLY to a sandbox org and fails CLOSED on any
 * prefix<->`isSandbox` mismatch in BOTH directions; a sandbox org inherits the
 * demo read-only isolation (mutations blocked, no real side-effects); a sandbox
 * key is capped at 100 requests/day (the 101st is 429). A sandbox key must NEVER
 * touch production data.
 */

import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const HMAC_SECRET = 'sandbox_isolation_test_secret_32_chars_min';
process.env.API_KEY_HMAC_SECRET = HMAC_SECRET;

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));

vi.mock('@contractor-ops/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@contractor-ops/db')>();
  return {
    ...actual,
    prisma: { organizationApiKey: { findMany: mockFindMany } },
    tryGetRegionalClient: vi.fn(() => ({ organizationApiKey: { findMany: mockFindMany } })),
  };
});

vi.mock('@contractor-ops/logger', () => {
  const stub = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { createLogger: vi.fn(() => ({ ...stub, child: vi.fn(() => stub) })) };
});

import { SANDBOX_DAILY_REQUEST_QUOTA } from '../../lib/api-tier-limits';
import { isDemoContext } from '../../lib/demo';
import { generateApiKey, resolveApiKey } from '../../services/api-key-service';

function hash(plaintext: string): string {
  return createHmac('sha256', HMAC_SECRET).update(plaintext).digest('hex');
}

/** Build a resolvable key record for the prefix lookup mock. */
function keyRecord(opts: {
  plaintext: string;
  environment: 'LIVE' | 'SANDBOX';
  isSandbox: boolean;
}) {
  const random = opts.plaintext.slice('co_test_'.length);
  return {
    id: 'key_1',
    organizationId: 'org_1',
    prefix: random.slice(0, 12),
    hash: hash(opts.plaintext),
    scopes: ['contractor:read'],
    environment: opts.environment,
    revokedAt: null,
    expiresAt: null,
    supersededAt: null,
    graceExpiresAt: null,
    actingUserId: 'user_1',
    organization: { id: 'org_1', dataRegion: 'EU', status: 'ACTIVE', isSandbox: opts.isSandbox },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('environment axis on the API key', () => {
  it('mints a co_test_ key for SANDBOX and a co_live_ key for LIVE', () => {
    expect(generateApiKey({ environment: 'SANDBOX' }).plaintext.startsWith('co_test_')).toBe(true);
    expect(generateApiKey({ environment: 'LIVE' }).plaintext.startsWith('co_live_')).toBe(true);
  });
});

describe('resolveApiKey fails closed on any prefix<->isSandbox mismatch', () => {
  it('resolves a co_test_ key against a sandbox org', async () => {
    const plaintext = `co_test_${'S'.repeat(43)}`;
    mockFindMany.mockResolvedValue([
      keyRecord({ plaintext, environment: 'SANDBOX', isSandbox: true }),
    ]);
    await expect(resolveApiKey(plaintext)).resolves.not.toBeNull();
  });

  it('REJECTS a co_test_ key whose org is not a sandbox (fail closed)', async () => {
    const plaintext = `co_test_${'N'.repeat(43)}`;
    mockFindMany.mockResolvedValue([
      keyRecord({ plaintext, environment: 'SANDBOX', isSandbox: false }),
    ]);
    await expect(resolveApiKey(plaintext)).resolves.toBeNull();
  });

  it('REJECTS a co_live_ key against a sandbox org (fail closed)', async () => {
    const plaintext = `co_live_${'L'.repeat(43)}`;
    mockFindMany.mockResolvedValue([
      keyRecord({ plaintext, environment: 'LIVE', isSandbox: true }),
    ]);
    await expect(resolveApiKey(plaintext)).resolves.toBeNull();
  });

  it('resolves a co_live_ key against a production org', async () => {
    const plaintext = `co_live_${'P'.repeat(43)}`;
    mockFindMany.mockResolvedValue([
      keyRecord({ plaintext, environment: 'LIVE', isSandbox: false }),
    ]);
    await expect(resolveApiKey(plaintext)).resolves.not.toBeNull();
  });
});

describe('a sandbox org inherits the demo read-only isolation', () => {
  it('isDemoContext is true for a sandbox context (mutations get blocked, no real side-effects)', () => {
    expect(isDemoContext({ organizationId: 'org_1', isSandbox: true })).toBe(true);
  });

  it('isDemoContext is false for an ordinary production context', () => {
    expect(isDemoContext({ organizationId: 'org_prod' })).toBe(false);
  });
});

describe('sandbox daily quota', () => {
  it('caps sandbox keys at 100 requests/day', () => {
    expect(SANDBOX_DAILY_REQUEST_QUOTA).toBe(100);
  });
});
