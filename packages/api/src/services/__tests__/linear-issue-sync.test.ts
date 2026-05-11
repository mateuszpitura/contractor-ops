/**
 * Linear issue sync — GraphQL helper, scope detection, create/sync entry paths.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveLinearStateId } = vi.hoisted(() => ({
  mockResolveLinearStateId: vi.fn(),
}));

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  getCredentials: vi.fn(async () => ({
    accessToken: 'linear-access-token',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  })),
}));

vi.mock('../linear-status-mapping', () => ({
  resolveLinearStateId: mockResolveLinearStateId,
}));

import {
  createLinearIssue,
  detectScopeExpansionNeeded,
  linearGraphQL,
  syncTaskStatusToLinear,
} from '../linear-issue-sync';

const ORG_ID = 'org-linear-sync-001';
const CONN_ID = 'conn-linear-sync-001';
const TASK_RUN_ID = 'clwtrun00000000000000001';

describe('detectScopeExpansionNeeded', () => {
  it('returns false when read and write are both present', () => {
    expect(detectScopeExpansionNeeded('read, write')).toBe(false);
    expect(detectScopeExpansionNeeded('write, read, offline')).toBe(false);
  });

  it('returns true when read or write is missing', () => {
    expect(detectScopeExpansionNeeded('read')).toBe(true);
    expect(detectScopeExpansionNeeded('write')).toBe(true);
    expect(detectScopeExpansionNeeded('')).toBe(true);
  });
});

describe('linearGraphQL', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns data on success', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ping: 'pong' } }),
    });

    const data = await linearGraphQL<{ ping: string }>('tok', 'query { ping }');

    expect(data).toEqual({ ping: 'pong' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.linear.app/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok',
        }),
      }),
    );
  });

  it('throws UNAUTHORIZED on HTTP 401', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'nope',
    });

    await expect(linearGraphQL('bad', 'q')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('throws when GraphQL errors array is present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: [{ message: 'Invalid query' }],
      }),
    });

    await expect(linearGraphQL('tok', 'bad')).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('throws when response has no data field', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await expect(linearGraphQL('tok', 'q')).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});

describe('createLinearIssue', () => {
  const baseParams = {
    organizationId: ORG_ID,
    connectionId: CONN_ID,
    taskRunId: TASK_RUN_ID,
    title: 'Task',
    description: 'Desc',
    teamId: 'team_linear',
    teamKey: 'ENG',
  };

  it('throws PRECONDITION_FAILED when connection is missing', async () => {
    const prisma = {
      integrationConnection: {
        findUnique: vi.fn(async () => null),
      },
    };

    await expect(createLinearIssue(prisma as never, baseParams)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('throws PRECONDITION_FAILED when connection is not CONNECTED', async () => {
    const prisma = {
      integrationConnection: {
        findUnique: vi.fn(async () => ({
          id: CONN_ID,
          status: 'DISCONNECTED',
          credentialsRef: 'enc',
        })),
      },
    };

    await expect(createLinearIssue(prisma as never, baseParams)).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });
});

describe('syncTaskStatusToLinear', () => {
  beforeEach(() => {
    mockResolveLinearStateId.mockReset();
  });

  it('returns immediately when no LINEAR_ISSUE link exists', async () => {
    const prisma = {
      externalLink: { findFirst: vi.fn(async () => null) },
    };

    await syncTaskStatusToLinear(prisma as never, TASK_RUN_ID, 'IN_PROGRESS');

    expect(prisma.externalLink.findFirst).toHaveBeenCalled();
  });

  it('suppresses outbound sync when last origin was LINEAR within the loop window', async () => {
    const prisma = {
      externalLink: {
        findFirst: vi.fn(async () => ({
          id: 'el-1',
          integrationConnectionId: CONN_ID,
          metadataJson: {
            lastSyncOrigin: 'LINEAR',
            lastSyncAt: new Date().toISOString(),
          },
        })),
      },
    };

    await syncTaskStatusToLinear(prisma as never, TASK_RUN_ID, 'DONE');
  });

  it('returns when connection is missing or not CONNECTED', async () => {
    const prisma = {
      externalLink: {
        findFirst: vi.fn(async () => ({
          id: 'el-1',
          integrationConnectionId: CONN_ID,
          metadataJson: {
            linearIssueId: 'iss_1',
            identifier: 'ENG-1',
            lastSyncOrigin: 'APP',
          },
        })),
      },
      integrationConnection: {
        findUnique: vi.fn(async () => null),
      },
    };

    await syncTaskStatusToLinear(prisma as never, TASK_RUN_ID, 'DONE');

    expect(mockResolveLinearStateId).not.toHaveBeenCalled();
  });

  it('returns when metadata has no linearIssueId', async () => {
    const prisma = {
      externalLink: {
        findFirst: vi.fn(async () => ({
          id: 'el-1',
          integrationConnectionId: CONN_ID,
          metadataJson: { identifier: 'ENG-1' },
        })),
      },
      integrationConnection: {
        findUnique: vi.fn(async () => ({
          id: CONN_ID,
          status: 'CONNECTED',
          organizationId: ORG_ID,
          credentialsRef: 'enc',
        })),
      },
    };

    await syncTaskStatusToLinear(prisma as never, TASK_RUN_ID, 'DONE');
  });

  it('returns when teamId cannot be resolved from template config', async () => {
    const prisma = {
      externalLink: {
        findFirst: vi.fn(async () => ({
          id: 'el-1',
          integrationConnectionId: CONN_ID,
          metadataJson: {
            linearIssueId: 'iss_1',
            identifier: 'ENG-1',
            lastSyncOrigin: 'APP',
          },
        })),
      },
      integrationConnection: {
        findUnique: vi.fn(async () => ({
          id: CONN_ID,
          status: 'CONNECTED',
          organizationId: ORG_ID,
          credentialsRef: 'enc',
        })),
      },
      workflowTaskRun: {
        findUnique: vi.fn(async () => ({
          workflowTaskTemplateId: 'tpl-1',
        })),
      },
      workflowTaskTemplate: {
        findUnique: vi.fn(async () => ({
          configJson: { jira: true },
        })),
      },
    };

    await syncTaskStatusToLinear(prisma as never, TASK_RUN_ID, 'DONE');

    expect(mockResolveLinearStateId).not.toHaveBeenCalled();
  });

  it('logs STATUS_UPDATE_UNMAPPED when no Linear state matches workflow status', async () => {
    mockResolveLinearStateId.mockResolvedValue(null);

    const integrationSyncLog = { create: vi.fn(async () => ({ id: 'log-1' })) };

    const prisma = {
      externalLink: {
        findFirst: vi.fn(async () => ({
          id: 'el-1',
          integrationConnectionId: CONN_ID,
          metadataJson: {
            linearIssueId: 'iss_1',
            identifier: 'ENG-1',
            lastSyncOrigin: 'APP',
          },
        })),
      },
      integrationConnection: {
        findUnique: vi.fn(async () => ({
          id: CONN_ID,
          status: 'CONNECTED',
          organizationId: ORG_ID,
          credentialsRef: 'enc',
        })),
      },
      workflowTaskRun: {
        findUnique: vi.fn(async () => ({
          workflowTaskTemplateId: 'tpl-1',
        })),
      },
      workflowTaskTemplate: {
        findUnique: vi.fn(async () => ({
          configJson: { linearTeamId: 'team_1' },
        })),
      },
      integrationSyncLog,
    };

    await syncTaskStatusToLinear(prisma as never, TASK_RUN_ID, 'CUSTOM_STATUS');

    expect(mockResolveLinearStateId).toHaveBeenCalled();
    expect(integrationSyncLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        syncType: 'STATUS_UPDATE_UNMAPPED',
        status: 'SUCCESS',
      }),
    });
  });
});
