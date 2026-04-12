import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationConnection: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: vi.fn(() => ({
    accessToken: 'mock-access-token',
  })),
}));

vi.mock('../../services/teams/teams-graph-client.js', () => ({
  getTeamsChannels: vi.fn(() =>
    Promise.resolve([
      { id: 'ch-1', displayName: 'General' },
      { id: 'ch-2', displayName: 'Approvals' },
    ]),
  ),
  getJoinedTeams: vi.fn(() =>
    Promise.resolve([
      { id: 'team-1', displayName: 'Engineering' },
      { id: 'team-2', displayName: 'Finance' },
    ]),
  ),
}));

// Mock tRPC init to avoid full server setup
vi.mock('../../init.js', () => {
  return {
    router: vi.fn(routes => routes),
    publicProcedure: {
      use: vi.fn().mockReturnThis(),
      input: vi.fn().mockReturnThis(),
      query: vi.fn(fn => fn),
      mutation: vi.fn(fn => fn),
    },
  };
});

vi.mock('../../middleware/tenant.js', () => ({
  tenantProcedure: {
    use: vi.fn().mockReturnThis(),
    input: vi.fn().mockReturnThis(),
    query: vi.fn(fn => fn),
    mutation: vi.fn(fn => fn),
  },
}));

vi.mock('../../middleware/rbac.js', () => ({
  requirePermission: vi.fn(() => vi.fn()),
}));

vi.mock('../../middleware/tier.js', () => ({
  requireTier: vi.fn(() => vi.fn()),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('teamsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveChannelMapping', () => {
    it('stores channel mapping in configJson', async () => {
      const connectionId = 'conn-1';
      const existingConfig = {
        conversationReferences: { 'aad-1': {} },
      };

      mockFindFirst.mockResolvedValue({
        id: connectionId,
        credentialsRef: 'encrypted-ref',
        configJson: existingConfig,
      });
      mockUpdate.mockResolvedValue({});

      // Import the router — with our mocks the procedures are just functions
      const { teamsRouter } = await import('../../routers/teams.js');

      // The saveChannelMapping procedure is a mutation function
      const handler = teamsRouter.saveChannelMapping as unknown as (params: {
        ctx: { organizationId: string };
        input: { mapping: Record<string, string> };
      }) => Promise<{ success: boolean }>;

      const result = await handler({
        ctx: { organizationId: 'org-1' },
        input: {
          mapping: {
            approvals: 'ch-approvals',
            invoices: 'ch-invoices',
            contracts: 'ch-contracts',
          },
        },
      });

      expect(result).toEqual({ success: true });
      expect(mockUpdate).toHaveBeenCalledOnce();

      const updateArgs = mockUpdate.mock.calls[0]?.[0];
      expect(updateArgs.where.id).toBe(connectionId);
      expect(updateArgs.data.configJson.channelMapping).toEqual({
        approvals: 'ch-approvals',
        invoices: 'ch-invoices',
        contracts: 'ch-contracts',
      });
      // Preserves existing config
      expect(updateArgs.data.configJson.conversationReferences).toEqual({ 'aad-1': {} });
    });
  });

  describe('getChannelMapping', () => {
    it('returns stored channel mapping', async () => {
      const storedMapping = {
        approvals: 'ch-1',
        invoices: 'ch-2',
      };

      mockFindFirst.mockResolvedValue({
        id: 'conn-1',
        credentialsRef: 'encrypted-ref',
        configJson: {
          channelMapping: storedMapping,
        },
      });

      const { teamsRouter } = await import('../../routers/teams.js');

      const handler = teamsRouter.getChannelMapping as unknown as (params: {
        ctx: { organizationId: string };
      }) => Promise<Record<string, string>>;

      const result = await handler({
        ctx: { organizationId: 'org-1' },
      });

      expect(result).toEqual(storedMapping);
    });

    it('returns empty object when no mapping exists', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'conn-1',
        credentialsRef: 'encrypted-ref',
        configJson: {},
      });

      const { teamsRouter } = await import('../../routers/teams.js');

      const handler = teamsRouter.getChannelMapping as unknown as (params: {
        ctx: { organizationId: string };
      }) => Promise<Record<string, string>>;

      const result = await handler({
        ctx: { organizationId: 'org-1' },
      });

      expect(result).toEqual({});
    });
  });

  describe('connectionStatus', () => {
    it('returns null when no connection exists', async () => {
      mockFindFirst.mockResolvedValue(null);

      const { teamsRouter } = await import('../../routers/teams.js');

      const handler = teamsRouter.connectionStatus as unknown as (params: {
        ctx: { organizationId: string };
      }) => Promise<null>;

      const result = await handler({
        ctx: { organizationId: 'org-1' },
      });

      expect(result).toBeNull();
    });

    it('returns connection info when connected', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'conn-1',
        status: 'CONNECTED',
        configJson: { channelMapping: {} },
      });

      const { teamsRouter } = await import('../../routers/teams.js');

      const handler = teamsRouter.connectionStatus as unknown as (params: {
        ctx: { organizationId: string };
      }) => Promise<{
        id: string;
        status: string;
        configJson: Record<string, unknown>;
      }>;

      const result = await handler({
        ctx: { organizationId: 'org-1' },
      });

      expect(result).toEqual({
        id: 'conn-1',
        status: 'CONNECTED',
        configJson: { channelMapping: {} },
      });
    });
  });

  describe('getTeams', () => {
    it('throws NOT_FOUND when no CONNECTED Teams integration', async () => {
      mockFindFirst.mockResolvedValue(null);
      const { teamsRouter } = await import('../../routers/teams.js');
      const handler = teamsRouter.getTeams as unknown as (params: {
        ctx: { organizationId: string };
      }) => Promise<unknown>;

      await expect(handler({ ctx: { organizationId: 'org-1' } })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('returns joined teams when connection exists', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'conn-1',
        credentialsRef: 'encrypted-ref',
        configJson: {},
      });

      const { teamsRouter } = await import('../../routers/teams.js');
      const handler = teamsRouter.getTeams as unknown as (params: {
        ctx: { organizationId: string };
      }) => Promise<Array<{ id: string; displayName: string }>>;

      const result = await handler({
        ctx: { organizationId: 'org-1' },
      });

      expect(result).toEqual([
        { id: 'team-1', displayName: 'Engineering' },
        { id: 'team-2', displayName: 'Finance' },
      ]);
    });
  });

  describe('getChannels', () => {
    it('throws NOT_FOUND when no CONNECTED Teams integration', async () => {
      mockFindFirst.mockResolvedValue(null);
      const { teamsRouter } = await import('../../routers/teams.js');
      const handler = teamsRouter.getChannels as unknown as (params: {
        ctx: { organizationId: string };
        input: { teamId: string };
      }) => Promise<unknown>;

      await expect(
        handler({ ctx: { organizationId: 'org-1' }, input: { teamId: 'team-1' } }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('returns channels for a given team', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'conn-1',
        credentialsRef: 'encrypted-ref',
        configJson: {},
      });

      const { teamsRouter } = await import('../../routers/teams.js');
      const handler = teamsRouter.getChannels as unknown as (params: {
        ctx: { organizationId: string };
        input: { teamId: string };
      }) => Promise<Array<{ id: string; displayName: string }>>;

      const result = await handler({
        ctx: { organizationId: 'org-1' },
        input: { teamId: 'team-1' },
      });

      expect(result).toEqual([
        { id: 'ch-1', displayName: 'General' },
        { id: 'ch-2', displayName: 'Approvals' },
      ]);
    });
  });

  describe('tier gating', () => {
    it('saveChannelMapping procedure includes requireTier(PRO) in middleware chain', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const sourceDir = path.resolve(import.meta.dirname, '../../routers');
      const source = fs.readFileSync(path.join(sourceDir, 'teams.ts'), 'utf-8');

      // Verify import exists
      expect(source).toContain('import { requireTier } from "../middleware/tier.js"');

      // Verify saveChannelMapping has requireTier
      expect(source).toContain('requireTier("PRO")');

      // Count occurrences -- should be exactly 1 (only saveChannelMapping, not read-only procedures)
      const matches = source.match(/\.use\(requireTier\("PRO"\)\)/g);
      expect(matches).toHaveLength(1);
    });

    it('read-only procedures (connectionStatus, getTeams, getChannels, getChannelMapping) do NOT include requireTier', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const sourceDir = path.resolve(import.meta.dirname, '../../routers');
      const source = fs.readFileSync(path.join(sourceDir, 'teams.ts'), 'utf-8');

      // Extract each read-only procedure block and verify no requireTier
      for (const proc of ['connectionStatus', 'getTeams', 'getChannels', 'getChannelMapping']) {
        const procRegex = new RegExp(
          `${proc}:\\s*tenantProcedure[\\s\\S]*?(?=\\w+:\\s*tenantProcedure|\\}\\);$)`,
          'm',
        );
        const match = source.match(procRegex);
        if (match) {
          expect(match[0]).not.toContain('requireTier');
        }
      }
    });
  });
});
