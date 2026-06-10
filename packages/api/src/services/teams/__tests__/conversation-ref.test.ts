import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConversationReference, storeConversationReference } from '../teams-bot-handler';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockFindFirst, mockUpdate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => {
  const MockDbPrisma = {
    integrationConnection: {
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
  };
  return {
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
    prisma: MockDbPrisma,
    prismaRaw: MockDbPrisma,
  };
});

// Mock card imports to prevent missing module errors
vi.mock('../cards/approval-result-card', () => ({
  buildApprovalResultCard: vi.fn(),
}));

vi.mock('../cards/reject-modal-card', () => ({
  buildRejectModalCard: vi.fn(),
}));

vi.mock('../../approval-engine', () => ({
  advanceFlow: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConversationReference storage (TEAM-06)', () => {
  const orgId = 'org-001';
  const connectionId = 'conn-001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storeConversationReference', () => {
    it('stores a reference keyed by aadObjectId', async () => {
      mockFindFirst.mockResolvedValue({
        id: connectionId,
        configJson: {},
      });
      mockUpdate.mockResolvedValue({});

      const ref = {
        user: {
          aadObjectId: 'aad-user-1',
          id: 'user-1',
          name: 'Alice',
        },
        conversation: {
          id: 'conv-1',
          conversationType: 'personal',
        },
        serviceUrl: 'https://smba.trafficmanager.net/emea/',
      };

      await storeConversationReference(orgId, ref as never);

      expect(mockUpdate).toHaveBeenCalledOnce();
      const updateCall = mockUpdate.mock.calls[0]?.[0];
      expect(updateCall.where.id).toBe(connectionId);

      const configJson = updateCall.data.configJson;
      expect(configJson.conversationReferences['aad-user-1']).toEqual(ref);
    });

    it('overwrites existing reference for same user', async () => {
      const existingRef = {
        user: { aadObjectId: 'aad-user-1', id: 'user-1', name: 'Alice' },
        serviceUrl: 'https://old-service.example.com/',
      };

      mockFindFirst.mockResolvedValue({
        id: connectionId,
        configJson: {
          conversationReferences: {
            'aad-user-1': existingRef,
          },
        },
      });
      mockUpdate.mockResolvedValue({});

      const newRef = {
        user: { aadObjectId: 'aad-user-1', id: 'user-1', name: 'Alice' },
        conversation: { id: 'conv-2', conversationType: 'personal' },
        serviceUrl: 'https://new-service.example.com/',
      };

      await storeConversationReference(orgId, newRef as never);

      expect(mockUpdate).toHaveBeenCalledOnce();
      const configJson = mockUpdate.mock.calls[0]?.[0].data.configJson;
      expect(configJson.conversationReferences['aad-user-1']).toEqual(newRef);
      expect(configJson.conversationReferences['aad-user-1'].serviceUrl).toBe(
        'https://new-service.example.com/',
      );
    });

    it('stores team-scoped references under teamConversationReferences', async () => {
      mockFindFirst.mockResolvedValue({
        id: connectionId,
        configJson: {},
      });
      mockUpdate.mockResolvedValue({});

      const ref = {
        user: { aadObjectId: 'aad-user-2', id: 'user-2', name: 'Bob' },
        conversation: {
          id: 'channel-1',
          conversationType: 'channel',
          tenantId: 'team-abc',
        },
        serviceUrl: 'https://smba.trafficmanager.net/emea/',
      };

      await storeConversationReference(orgId, ref as never);

      expect(mockUpdate).toHaveBeenCalledOnce();
      const configJson = mockUpdate.mock.calls[0]?.[0].data.configJson;
      // Personal ref stored by aadObjectId
      expect(configJson.conversationReferences['aad-user-2']).toEqual(ref);
      // Team ref stored by channelId (conversation.id) for sendChannelAlert lookup
      expect(configJson.teamConversationReferences['channel-1']).toEqual(ref);
    });

    it('does nothing when ref has no aadObjectId', async () => {
      const ref = {
        user: { id: 'user-1', name: 'No AAD' },
        conversation: { id: 'conv-1' },
      };

      await storeConversationReference(orgId, ref as never);

      expect(mockFindFirst).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('does nothing when no MICROSOFT_TEAMS connection exists', async () => {
      mockFindFirst.mockResolvedValue(null);

      const ref = {
        user: { aadObjectId: 'aad-user-1', id: 'user-1', name: 'Alice' },
        conversation: { id: 'conv-1' },
      };

      await storeConversationReference(orgId, ref as never);

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('preserves existing conversation references when adding new ones', async () => {
      const existingRef = {
        user: { aadObjectId: 'aad-user-1', id: 'user-1', name: 'Alice' },
        serviceUrl: 'https://smba.trafficmanager.net/emea/',
      };

      mockFindFirst.mockResolvedValue({
        id: connectionId,
        configJson: {
          conversationReferences: {
            'aad-user-1': existingRef,
          },
          channelMapping: { approvals: 'ch-1' },
        },
      });
      mockUpdate.mockResolvedValue({});

      const newRef = {
        user: { aadObjectId: 'aad-user-2', id: 'user-2', name: 'Bob' },
        conversation: { id: 'conv-2', conversationType: 'personal' },
        serviceUrl: 'https://smba.trafficmanager.net/emea/',
      };

      await storeConversationReference(orgId, newRef as never);

      const configJson = mockUpdate.mock.calls[0]?.[0].data.configJson;
      // Existing ref preserved
      expect(configJson.conversationReferences['aad-user-1']).toEqual(existingRef);
      // New ref added
      expect(configJson.conversationReferences['aad-user-2']).toEqual(newRef);
      // Other config preserved
      expect(configJson.channelMapping).toEqual({ approvals: 'ch-1' });
    });
  });

  describe('getConversationReference', () => {
    it('returns stored reference for known aadObjectId', async () => {
      const storedRef = {
        user: { aadObjectId: 'aad-user-1', id: 'user-1', name: 'Alice' },
        conversation: { id: 'conv-1' },
        serviceUrl: 'https://smba.trafficmanager.net/emea/',
      };

      mockFindFirst.mockResolvedValue({
        configJson: {
          conversationReferences: {
            'aad-user-1': storedRef,
          },
        },
      });

      const result = await getConversationReference(orgId, 'aad-user-1');
      expect(result).toEqual(storedRef);
    });

    it('returns null for unknown aadObjectId', async () => {
      mockFindFirst.mockResolvedValue({
        configJson: {
          conversationReferences: {},
        },
      });

      const result = await getConversationReference(orgId, 'aad-unknown');
      expect(result).toBeNull();
    });

    it('returns null when no connection exists', async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await getConversationReference(orgId, 'aad-user-1');
      expect(result).toBeNull();
    });

    it('returns null when configJson has no conversationReferences', async () => {
      mockFindFirst.mockResolvedValue({
        configJson: {},
      });

      const result = await getConversationReference(orgId, 'aad-user-1');
      expect(result).toBeNull();
    });
  });
});
