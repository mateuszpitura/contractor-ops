import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted to avoid TDZ issues with vi.mock hoisting
// ---------------------------------------------------------------------------

const { mockSessionCreate, mockSessionFindUnique, mockSessionDeleteMany } = vi.hoisted(() => ({
  mockSessionCreate: vi.fn(),
  mockSessionFindUnique: vi.fn(),
  mockSessionDeleteMany: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => {
  const __mockDbPrisma = {
    portalSession: {
      create: mockSessionCreate,
      findUnique: mockSessionFindUnique,
      deleteMany: mockSessionDeleteMany,
    },
  };
  return {
  withRlsTransactions: <T>(c: T) => c,
  withRlsReads: <T>(c: T) => c,
  prisma: __mockDbPrisma,
  prismaRaw: __mockDbPrisma,

  };
});

import {
  cleanExpiredSessions,
  createPortalSession,
  deletePortalSession,
  generateSessionToken,
  hashToken,
  validatePortalSession,
} from '../portal-session';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Token utilities (pure functions)
// ---------------------------------------------------------------------------

describe('generateSessionToken', () => {
  it('returns a base64url string', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates unique tokens on each call', () => {
    const tokens = new Set(Array.from({ length: 10 }, generateSessionToken));
    expect(tokens.size).toBe(10);
  });

  it('produces a token of expected length (32 bytes = ~43 base64url chars)', () => {
    const token = generateSessionToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token.length).toBeLessThanOrEqual(44);
  });
});

describe('hashToken', () => {
  it('returns a hex string (SHA-256 = 64 hex chars)', () => {
    const hash = hashToken('test-token');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic (same input = same output)', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('different inputs produce different hashes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});

// ---------------------------------------------------------------------------
// createPortalSession
// ---------------------------------------------------------------------------

describe('createPortalSession', () => {
  it('creates a session with hashed token and correct scoping', async () => {
    mockSessionCreate.mockResolvedValueOnce({ id: 'session_1' });

    const result = await createPortalSession({
      contractorId: 'contractor_1',
      organizationId: 'org_1',
      email: 'contractor@example.com',
      ipAddress: '1.2.3.4',
      userAgent: 'TestBrowser/1.0',
    });

    expect(result.rawToken).toBeDefined();
    expect(result.expiresAt).toBeInstanceOf(Date);
    // Expiry should be ~7 days from now
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const diff = result.expiresAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan(sevenDaysMs - 5000);
    expect(diff).toBeLessThanOrEqual(sevenDaysMs);

    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contractorId: 'contractor_1',
        organizationId: 'org_1',
        email: 'contractor@example.com',
        ipAddress: '1.2.3.4',
        userAgent: 'TestBrowser/1.0',
      }),
    });

    // Stored token should be the hash, not the raw token
    const storedToken = mockSessionCreate.mock.calls[0][0].data.token;
    expect(storedToken).not.toBe(result.rawToken);
    expect(storedToken).toBe(hashToken(result.rawToken));
  });

  it('stores null for optional ipAddress and userAgent when omitted', async () => {
    mockSessionCreate.mockResolvedValueOnce({ id: 'session_2' });

    await createPortalSession({
      contractorId: 'contractor_1',
      organizationId: 'org_1',
      email: 'test@example.com',
    });

    expect(mockSessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipAddress: null,
        userAgent: null,
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// validatePortalSession
// ---------------------------------------------------------------------------

describe('validatePortalSession', () => {
  it('returns session when token is valid and not expired', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const session = {
      id: 'session_1',
      expiresAt: futureDate,
      contractor: { status: 'ACTIVE' },
    };
    mockSessionFindUnique.mockResolvedValueOnce(session);

    const result = await validatePortalSession('raw-token');

    expect(result).toBe(session);
    expect(mockSessionFindUnique).toHaveBeenCalledWith({
      where: { token: hashToken('raw-token') },
      include: { contractor: true },
    });
  });

  it('returns null when session is not found', async () => {
    mockSessionFindUnique.mockResolvedValueOnce(null);

    const result = await validatePortalSession('nonexistent-token');
    expect(result).toBeNull();
  });

  it('returns null when session is expired', async () => {
    const pastDate = new Date(Date.now() - 86400000);
    mockSessionFindUnique.mockResolvedValueOnce({
      id: 'session_expired',
      expiresAt: pastDate,
      contractor: { status: 'ACTIVE' },
    });

    const result = await validatePortalSession('expired-token');
    expect(result).toBeNull();
  });

  it('returns null when contractor is ARCHIVED', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    mockSessionFindUnique.mockResolvedValueOnce({
      id: 'session_archived',
      expiresAt: futureDate,
      contractor: { status: 'ARCHIVED' },
    });

    const result = await validatePortalSession('archived-token');
    expect(result).toBeNull();
  });

  it('returns null when contractor is INACTIVE', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    mockSessionFindUnique.mockResolvedValueOnce({
      id: 'session_inactive',
      expiresAt: futureDate,
      contractor: { status: 'INACTIVE' },
    });

    const result = await validatePortalSession('inactive-token');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deletePortalSession
// ---------------------------------------------------------------------------

describe('deletePortalSession', () => {
  it('deletes session by hashed token using deleteMany', async () => {
    mockSessionDeleteMany.mockResolvedValueOnce({ count: 1 });

    await deletePortalSession('raw-token');

    expect(mockSessionDeleteMany).toHaveBeenCalledWith({
      where: { token: hashToken('raw-token') },
    });
  });

  it('does not throw when session does not exist', async () => {
    mockSessionDeleteMany.mockResolvedValueOnce({ count: 0 });

    await expect(deletePortalSession('nonexistent-token')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// cleanExpiredSessions
// ---------------------------------------------------------------------------

describe('cleanExpiredSessions', () => {
  it('deletes expired sessions and returns count', async () => {
    mockSessionDeleteMany.mockResolvedValueOnce({ count: 5 });

    const count = await cleanExpiredSessions();

    expect(count).toBe(5);
    expect(mockSessionDeleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });

  it('returns 0 when no expired sessions exist', async () => {
    mockSessionDeleteMany.mockResolvedValueOnce({ count: 0 });

    const count = await cleanExpiredSessions();
    expect(count).toBe(0);
  });
});
