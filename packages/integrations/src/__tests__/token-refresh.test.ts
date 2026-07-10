import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdapter } from '../registry.js';
import type { CredentialBlob } from '../types/credentials.js';
import type { IntegrationProviderAdapter } from '../types/provider.js';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const { mockFindMany, mockFindUnique, mockUpdateMany, mockUpdate } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      updateMany: mockUpdateMany,
      update: mockUpdate,
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock adapter registry
// ---------------------------------------------------------------------------

const mockRefreshToken = vi.fn();
const mockAdapter: IntegrationProviderAdapter = {
  slug: 'slack',
  displayName: 'Slack',
  supportsOAuth: true,
  supportsWebhooks: true,
  refreshToken: mockRefreshToken,
};

vi.mock('../registry.js', () => ({
  getAdapter: vi.fn(() => mockAdapter),
}));

// ---------------------------------------------------------------------------
// Mock credential service
// ---------------------------------------------------------------------------

const TEST_KEY = randomBytes(32).toString('hex');

vi.mock('../services/credential-service.js', () => ({
  decryptCredentials: vi.fn(
    (): CredentialBlob => ({
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      expiresAt: '2026-03-23T12:00:00Z',
    }),
  ),
  encryptCredentials: vi.fn((): string => 'encrypted-new-credentials'),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { refreshExpiring, lazyRefresh } = await import('../services/token-refresh.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    organizationId: 'org-1',
    provider: 'SLACK',
    status: 'CONNECTED',
    credentialsRef: 'encrypted-ref',
    tokenExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
    refreshLockedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('token-refresh', () => {
  beforeEach(() => {
    vi.stubEnv('SLACK_ENCRYPTION_KEY', TEST_KEY);
    vi.clearAllMocks();
    // Default mock behaviors
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('refreshExpiring', () => {
    it('should refresh a connection expiring within 30 minutes', async () => {
      const conn = makeConnection();
      mockFindMany.mockResolvedValue([conn]);

      const newCreds: CredentialBlob = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: '2026-03-23T14:00:00Z',
      };
      mockRefreshToken.mockResolvedValue(newCreds);

      const result = await refreshExpiring();

      expect(result.total).toBe(1);
      expect(result.refreshed).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockRefreshToken).toHaveBeenCalledOnce();
      // Should update connection with new credentials
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conn-1' },
          data: expect.objectContaining({
            credentialsRef: 'encrypted-new-credentials',
          }),
        }),
      );

      // The credential-persisting write must NOT stamp lastSyncAt/lastSuccessAt:
      // the HRIS pull orchestrator reuses lastSyncAt as its hourly throttle, so
      // a refresh here would masquerade as a completed sync and suppress pulls.
      const persistCall = mockUpdate.mock.calls.find(
        ([arg]) => (arg as { data?: Record<string, unknown> }).data?.credentialsRef != null,
      );
      expect(persistCall?.[0].data).not.toHaveProperty('lastSyncAt');
      expect(persistCall?.[0].data).not.toHaveProperty('lastSuccessAt');
    });

    it('should skip connections with an active lock', async () => {
      // If updateMany returns count 0, it means lock was already taken
      mockFindMany.mockResolvedValue([makeConnection()]);
      mockUpdateMany.mockResolvedValue({ count: 0 });

      const result = await refreshExpiring();

      expect(result.total).toBe(1);
      expect(result.refreshed).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockRefreshToken).not.toHaveBeenCalled();
      // Losing the claim must not release the lock — the process that WON the
      // claim owns it, so no update (release) call may run this iteration.
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should mark connection as REAUTH_REQUIRED on refresh failure', async () => {
      const conn = makeConnection();
      mockFindMany.mockResolvedValue([conn]);
      mockRefreshToken.mockRejectedValue(new Error('Invalid grant'));

      const result = await refreshExpiring();

      expect(result.total).toBe(1);
      expect(result.refreshed).toBe(0);
      expect(result.failed).toBe(1);
      // markRefreshFailed should set REAUTH_REQUIRED
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conn-1' },
          data: expect.objectContaining({
            status: 'REAUTH_REQUIRED',
            lastErrorMessage: 'Invalid grant',
          }),
        }),
      );
    });

    it('should handle empty connection list gracefully', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await refreshExpiring();

      expect(result.total).toBe(0);
      expect(result.refreshed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('skips a provider with no refreshToken handler without failing it', async () => {
      // Personio self-mints its bearer from client-credentials and exposes no
      // refreshToken handler — proactive refresh must skip it, never lock it,
      // and never move it to REAUTH_REQUIRED.
      vi.mocked(getAdapter).mockReturnValueOnce({
        slug: 'personio',
        displayName: 'Personio',
        supportsOAuth: false,
        supportsWebhooks: false,
      } as IntegrationProviderAdapter);
      mockFindMany.mockResolvedValue([makeConnection({ provider: 'PERSONIO' })]);

      const result = await refreshExpiring();

      expect(result.total).toBe(1);
      expect(result.refreshed).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(mockUpdateMany).not.toHaveBeenCalled(); // never attempted the lock
      expect(mockUpdate).not.toHaveBeenCalled(); // no markRefreshFailed / release
    });
  });

  describe('lazyRefresh', () => {
    it('should return false for non-expired token', async () => {
      mockFindUnique.mockResolvedValue(
        makeConnection({
          tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour out
        }),
      );

      const result = await lazyRefresh('conn-1');

      expect(result).toBe(false);
      expect(mockRefreshToken).not.toHaveBeenCalled();
    });

    it('should refresh an expired token', async () => {
      mockFindUnique.mockResolvedValue(
        makeConnection({
          tokenExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
        }),
      );

      const newCreds: CredentialBlob = {
        accessToken: 'lazy-new-token',
        expiresAt: '2026-03-23T16:00:00Z',
      };
      mockRefreshToken.mockResolvedValue(newCreds);

      const result = await lazyRefresh('conn-1');

      expect(result).toBe(true);
      expect(mockRefreshToken).toHaveBeenCalledOnce();
    });

    it('should return false when connection has no tokenExpiresAt', async () => {
      mockFindUnique.mockResolvedValue(makeConnection({ tokenExpiresAt: null }));

      const result = await lazyRefresh('conn-1');

      expect(result).toBe(false);
    });

    it('should return false when connection does not exist', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await lazyRefresh('conn-nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when lock is held by another process', async () => {
      mockFindUnique.mockResolvedValue(
        makeConnection({
          tokenExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // expired
          refreshLockedAt: new Date(), // recently locked
        }),
      );
      // Atomic claim: updateMany returns count 0 because the where-clause
      // OR(refreshLockedAt IS NULL, refreshLockedAt <= staleCutoff) does not
      // match a recently-locked row.
      mockUpdateMany.mockResolvedValueOnce({ count: 0 });

      const result = await lazyRefresh('conn-1');

      expect(result).toBe(false);
      expect(mockRefreshToken).not.toHaveBeenCalled();
    });
  });
});
