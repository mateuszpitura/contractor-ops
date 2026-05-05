import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  withRlsReads: <T,>(c: T) => c,
  prisma: {
    organizationApiKey: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Ensure HMAC secret is available before importing the service
vi.stubEnv('API_KEY_HMAC_SECRET', 'test-hmac-secret-that-is-at-least-32-chars-long');

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@contractor-ops/db';
import { generateApiKey, PREFIX_LENGTH, resolveApiKey, touchLastUsed } from '../api-key-service.js';

// ---------------------------------------------------------------------------
// Typed mock handles
// ---------------------------------------------------------------------------

const mockPrisma = prisma as unknown as {
  organizationApiKey: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// generateApiKey
// ---------------------------------------------------------------------------

describe('generateApiKey', () => {
  it('returns plaintext, prefix, and hash', () => {
    const result = generateApiKey();

    expect(result).toHaveProperty('plaintext');
    expect(result).toHaveProperty('prefix');
    expect(result).toHaveProperty('hash');
  });

  it('plaintext starts with "co_live_"', () => {
    const { plaintext } = generateApiKey();
    expect(plaintext.startsWith('co_live_')).toBe(true);
  });

  it('prefix is 12 characters long', () => {
    const { prefix } = generateApiKey();
    expect(prefix).toHaveLength(PREFIX_LENGTH);
  });

  it('hash is a hex string', () => {
    const { hash } = generateApiKey();
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('generates unique keys on successive calls', () => {
    const a = generateApiKey();
    const b = generateApiKey();

    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hash).not.toBe(b.hash);
  });
});

// ---------------------------------------------------------------------------
// resolveApiKey
// ---------------------------------------------------------------------------

describe('resolveApiKey', () => {
  it('returns null for keys with invalid prefix', async () => {
    const result = await resolveApiKey('invalid_prefix_key');
    expect(result).toBeNull();
    expect(mockPrisma.organizationApiKey.findMany).not.toHaveBeenCalled();
  });

  it('resolves a valid key to its DB record', async () => {
    const { plaintext, prefix, hash } = generateApiKey();
    const dbRecord = {
      id: 'key-1',
      prefix,
      hash,
      organization: { id: 'org-1', dataRegion: 'EU', status: 'ACTIVE' },
    };

    mockPrisma.organizationApiKey.findMany.mockResolvedValue([dbRecord]);

    const result = await resolveApiKey(plaintext);
    expect(result).toEqual(dbRecord);
  });

  it('returns null when no DB match found', async () => {
    const { plaintext } = generateApiKey();
    mockPrisma.organizationApiKey.findMany.mockResolvedValue([]);

    const result = await resolveApiKey(plaintext);
    expect(result).toBeNull();
  });

  it('returns null when candidates exist but hash does not match', async () => {
    const { plaintext } = generateApiKey();
    const wrongRecord = {
      id: 'key-wrong',
      prefix: plaintext.slice('co_live_'.length, 'co_live_'.length + PREFIX_LENGTH),
      hash: 'deadbeef'.repeat(8),
      organization: { id: 'org-1', dataRegion: 'EU', status: 'ACTIVE' },
    };

    mockPrisma.organizationApiKey.findMany.mockResolvedValue([wrongRecord]);

    const result = await resolveApiKey(plaintext);
    expect(result).toBeNull();
  });

  it('filters expired and revoked keys in the DB query', async () => {
    const { plaintext } = generateApiKey();
    mockPrisma.organizationApiKey.findMany.mockResolvedValue([]);

    await resolveApiKey(plaintext);

    const queryArgs = mockPrisma.organizationApiKey.findMany.mock.calls[0]?.[0];
    expect(queryArgs.where.revokedAt).toBeNull();
    expect(queryArgs.where.OR).toEqual(
      expect.arrayContaining([{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }]),
    );
  });
});

// ---------------------------------------------------------------------------
// touchLastUsed
// ---------------------------------------------------------------------------

describe('touchLastUsed', () => {
  it('calls prisma update on first invocation', () => {
    mockPrisma.organizationApiKey.update.mockResolvedValue({});

    touchLastUsed('key-touch-1');

    expect(mockPrisma.organizationApiKey.update).toHaveBeenCalledWith({
      where: { id: 'key-touch-1' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it('debounces — second call within 5 min does not re-query', () => {
    mockPrisma.organizationApiKey.update.mockResolvedValue({});

    touchLastUsed('key-touch-2');
    touchLastUsed('key-touch-2');

    expect(mockPrisma.organizationApiKey.update).toHaveBeenCalledTimes(1);
  });

  it('allows update for a different key ID', () => {
    mockPrisma.organizationApiKey.update.mockResolvedValue({});

    touchLastUsed('key-touch-3a');
    touchLastUsed('key-touch-3b');

    expect(mockPrisma.organizationApiKey.update).toHaveBeenCalledTimes(2);
  });
});
