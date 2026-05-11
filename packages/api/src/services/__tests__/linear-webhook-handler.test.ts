/**
 * Linear webhook handler — early exits, loop suppression, dedup, register/deregister.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-linear-wh-001';
const CONN_ID = 'conn-linear-001';

const validIssuePayload = {
  action: 'update' as const,
  type: 'Issue' as const,
  organizationId: 'lin_org',
  webhookTimestamp: 1_711_929_600_000,
  webhookId: 'wh_123',
  url: 'https://linear.app/team/issue/TEAM-1',
  actor: { id: 'usr_1', type: 'user' },
  data: {
    id: 'iss_1',
    number: 42,
    identifier: 'TEAM-42',
    title: 'Fix the bug',
    stateId: 'state_new',
    teamId: 'team_1',
    url: 'https://linear.app/team/issue/TEAM-42',
  },
  updatedFrom: { stateId: 'state_old' },
};

const { mockPrisma, mockResolveInternalStatus, mockLinearGraphQL } = vi.hoisted(() => {
  const integrationSyncLog = {
    create: vi.fn(async () => ({ id: 'log-1' })),
    findFirst: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
  };
  const externalLink = {
    findFirst: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
  };
  const integrationConnection = {
    findUnique: vi.fn(async () => null),
    update: vi.fn(async () => ({})),
  };
  const workflowTaskRun = {
    update: vi.fn(async () => ({})),
  };

  return {
    mockPrisma: {
      integrationSyncLog,
      externalLink,
      integrationConnection,
      workflowTaskRun,
    },
    mockResolveInternalStatus: vi.fn(async () => null),
    mockLinearGraphQL: vi.fn(),
  };
});

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  getCredentials: vi.fn(async () => ({ accessToken: 'linear-token' })),
  decryptCredentials: vi.fn(async () => ({ accessToken: 'linear-token' })),
  encryptCredentials: vi.fn(async (v: unknown) => ({
    ciphertext: 'enc',
    iv: 'iv',
    keyVersion: 1,
    data: v,
  })),
}));

vi.mock('../linear-status-mapping', () => ({
  resolveInternalStatus: mockResolveInternalStatus,
}));

vi.mock('../linear-issue-sync', () => ({
  linearGraphQL: mockLinearGraphQL,
}));

import {
  deregisterLinearWebhook,
  processLinearWebhook,
  registerLinearWebhook,
} from '../linear-webhook-handler';

describe('processLinearWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveInternalStatus.mockResolvedValue(null);
  });

  it('logs FAILED sync when payload fails Zod validation', async () => {
    await processLinearWebhook(mockPrisma as never, ORG_ID, CONN_ID, { not: 'valid' });

    expect(mockPrisma.integrationSyncLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        integrationConnectionId: CONN_ID,
        syncType: 'webhook-invalid',
        status: 'FAILED',
        direction: 'INBOUND',
      }),
    });
  });

  it('logs ignored sync when action is not update', async () => {
    await processLinearWebhook(mockPrisma as never, ORG_ID, CONN_ID, {
      ...validIssuePayload,
      action: 'create',
    });

    expect(mockPrisma.integrationSyncLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        syncType: 'webhook-ignored',
        status: 'SUCCESS',
        responsePayloadJson: expect.objectContaining({
          reason: expect.stringContaining('create'),
        }),
      }),
    });
  });

  it('logs ignored sync when updatedFrom.stateId is missing on update', async () => {
    const { updatedFrom: _u, ...rest } = validIssuePayload;
    await processLinearWebhook(mockPrisma as never, ORG_ID, CONN_ID, {
      ...rest,
      action: 'update',
    });

    expect(mockPrisma.integrationSyncLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        syncType: 'webhook-ignored',
        responsePayloadJson: expect.objectContaining({
          reason: expect.stringContaining('state'),
        }),
      }),
    });
  });

  it('logs unlinked when no ExternalLink exists for the issue', async () => {
    mockPrisma.externalLink.findFirst.mockResolvedValueOnce(null);

    await processLinearWebhook(mockPrisma as never, ORG_ID, CONN_ID, validIssuePayload);

    expect(mockPrisma.integrationSyncLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        syncType: 'webhook-unlinked',
        status: 'SUCCESS',
      }),
    });
    expect(mockResolveInternalStatus).not.toHaveBeenCalled();
  });

  it('suppresses bounce-back when last sync was APP within the loop window', async () => {
    mockPrisma.externalLink.findFirst.mockResolvedValueOnce({
      id: 'el-1',
      entityId: 'wtr-1',
      externalUrl: 'https://linear.app/x',
      metadataJson: {
        lastSyncOrigin: 'APP',
        lastSyncAt: new Date().toISOString(),
      },
    });

    await processLinearWebhook(mockPrisma as never, ORG_ID, CONN_ID, validIssuePayload);

    expect(mockPrisma.integrationSyncLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        syncType: 'webhook-loop-suppressed',
      }),
    });
    expect(mockResolveInternalStatus).not.toHaveBeenCalled();
  });

  it('skips processing when a duplicate webhook with the same newStateId arrived recently', async () => {
    mockPrisma.externalLink.findFirst.mockResolvedValueOnce({
      id: 'el-1',
      entityId: 'wtr-1',
      metadataJson: {},
    });
    mockPrisma.integrationSyncLog.findFirst.mockResolvedValueOnce({
      responsePayloadJson: {
        identifier: 'TEAM-42',
        newStateId: 'state_new',
      },
    });

    await processLinearWebhook(mockPrisma as never, ORG_ID, CONN_ID, validIssuePayload);

    expect(mockResolveInternalStatus).not.toHaveBeenCalled();
    expect(mockPrisma.integrationSyncLog.create).not.toHaveBeenCalled();
  });
});

describe('registerLinearWebhook / deregisterLinearWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.test';
  });

  it('registerLinearWebhook throws when connection is missing or inactive', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValueOnce(null);

    await expect(
      registerLinearWebhook(mockPrisma as never, CONN_ID, 'team_1'),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

    mockPrisma.integrationConnection.findUnique.mockResolvedValueOnce({
      id: CONN_ID,
      status: 'DISCONNECTED',
      credentialsRef: 'enc',
    });

    await expect(
      registerLinearWebhook(mockPrisma as never, CONN_ID, 'team_1'),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });

  it('registerLinearWebhook creates webhook and stores id in config', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: CONN_ID,
      status: 'CONNECTED',
      credentialsRef: 'enc',
      configJson: {},
    });
    mockLinearGraphQL.mockResolvedValueOnce({
      webhookCreate: {
        success: true,
        webhook: { id: 'wh_linear_1', enabled: true },
      },
    });

    const id = await registerLinearWebhook(mockPrisma as never, CONN_ID, 'team_1');

    expect(id).toBe('wh_linear_1');
    expect(mockLinearGraphQL).toHaveBeenCalled();
    expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith({
      where: { id: CONN_ID },
      data: expect.objectContaining({
        configJson: expect.objectContaining({
          webhooks: expect.objectContaining({ team_1: 'wh_linear_1' }),
        }),
      }),
    });
  });

  it('deregisterLinearWebhook returns early when connection is missing', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValueOnce(null);

    await deregisterLinearWebhook(mockPrisma as never, CONN_ID, 'team_1');

    expect(mockLinearGraphQL).not.toHaveBeenCalled();
    expect(mockPrisma.integrationConnection.update).not.toHaveBeenCalled();
  });

  it('deregisterLinearWebhook removes team from config after Graph delete', async () => {
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: CONN_ID,
      credentialsRef: 'enc',
      configJson: { webhooks: { team_1: 'wh_to_delete' } },
    });
    mockLinearGraphQL.mockResolvedValue({ webhookDelete: { success: true } });

    await deregisterLinearWebhook(mockPrisma as never, CONN_ID, 'team_1');

    expect(mockLinearGraphQL).toHaveBeenCalled();
    expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith({
      where: { id: CONN_ID },
      data: expect.objectContaining({
        configJson: expect.objectContaining({
          webhooks: {},
        }),
      }),
    });
  });
});
