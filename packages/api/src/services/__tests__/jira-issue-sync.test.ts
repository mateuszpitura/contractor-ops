import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createJiraIssue,
  detectScopeExpansionNeeded,
  transitionJiraIssue,
} from '../jira-issue-sync.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: vi.fn().mockReturnValue({ accessToken: 'mock-token' }),
}));

vi.mock('@contractor-ops/validators', () => ({
  jiraTaskConfigSchema: { safeParse: vi.fn() },
}));

vi.mock('../jira-status-mapping.js', () => ({
  lookupJiraTransitionId: vi.fn(),
}));

import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { jiraTaskConfigSchema } from '@contractor-ops/validators';
import { lookupJiraTransitionId } from '../jira-status-mapping.js';

const mockDecryptCredentials = vi.mocked(decryptCredentials);
const mockJiraConfigParse = vi.mocked(jiraTaskConfigSchema.safeParse);
const mockLookupTransition = vi.mocked(lookupJiraTransitionId);

vi.stubGlobal('fetch', vi.fn());
const mockFetch = vi.mocked(fetch);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const CONNECTION_ID = 'conn-1';
const TASK_RUN_ID = 'taskrun-1';
const CLOUD_ID = 'cloud-abc';
const BASE_URL = `https://api.atlassian.com/ex/jira/${CLOUD_ID}/rest/api/3`;

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

function createMockPrisma() {
  return {
    workflowTaskRun: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    workflowTaskTemplate: {
      findUnique: vi.fn(),
    },
    integrationConnection: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    externalLink: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    integrationSyncLog: {
      create: vi.fn().mockResolvedValue({ id: 'sync-1' }),
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn(),
    },
  } as unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockTaskRun(overrides = {}) {
  return {
    id: TASK_RUN_ID,
    title: 'Review deliverables',
    description: 'Check contractor deliverables for Q1',
    workflowTaskTemplateId: 'tmpl-1',
    workflowRun: { contractorId: 'contractor-1' },
    ...overrides,
  };
}

function mockConnection(overrides = {}) {
  return {
    id: CONNECTION_ID,
    status: 'CONNECTED',
    configJson: { cloudId: CLOUD_ID, siteUrl: 'https://mysite.atlassian.net' },
    credentialsRef: 'cred-ref-1',
    ...overrides,
  };
}

function mockJiraConfig() {
  return {
    jiraEnabled: true,
    jiraProjectId: '10000',
    jiraIssueTypeId: '10001',
  };
}

/** Sets up the common mocks needed for a successful createJiraIssue call */
function setupCreateMocks(
  prisma: ReturnType<typeof createMockPrisma>,
  overrides: {
    taskRun?: Record<string, unknown>;
    jiraConfig?: Record<string, unknown>;
    connection?: Record<string, unknown>;
    fetchResponse?: Response;
  } = {},
) {
  prisma.workflowTaskRun.findUnique.mockResolvedValue(overrides.taskRun ?? mockTaskRun());
  prisma.workflowTaskTemplate.findUnique.mockResolvedValue({
    configJson: { jiraEnabled: true },
  });
  mockJiraConfigParse.mockReturnValue({
    success: true,
    data: overrides.jiraConfig ?? mockJiraConfig(),
  } as unknown);
  prisma.integrationConnection.findUnique.mockResolvedValue(
    overrides.connection ?? mockConnection(),
  );
  mockFetch.mockResolvedValue(overrides.fetchResponse ?? mockCreateIssueResponse());
}

function mockCreateIssueResponse(key = 'PROJ-42', id = '12345') {
  return new Response(JSON.stringify({ id, key, self: `${BASE_URL}/issue/${id}` }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  mockFetch.mockReset();
  mockDecryptCredentials.mockReturnValue({ accessToken: 'mock-token' } as unknown);
});

describe('jira-issue-sync', () => {
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // createJiraIssue
  // =========================================================================

  describe('createJiraIssue', () => {
    it('calls fetch with POST {baseUrl}/issue and correct ADF description body', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma);

      await createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID);

      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/issue`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-token',
          }),
        }),
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.fields.description).toEqual({
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Check contractor deliverables for Q1' }],
          },
        ],
      });
    });

    it('updates workflowTaskRun with externalRefType JIRA_ISSUE and externalRefId as issue key', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma, { fetchResponse: mockCreateIssueResponse('PROJ-42') });

      await createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID);

      expect(prisma.workflowTaskRun.update).toHaveBeenCalledWith({
        where: { id: TASK_RUN_ID },
        data: {
          externalRefType: 'JIRA_ISSUE',
          externalRefId: 'PROJ-42',
        },
      });
    });

    it('creates ExternalLink with entityType WORKFLOW_TASK_RUN and metadataJson including key, summary, status, url, lastSyncOrigin', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma, { fetchResponse: mockCreateIssueResponse('PROJ-42') });

      await createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID);

      expect(prisma.externalLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          integrationConnectionId: CONNECTION_ID,
          entityType: 'WORKFLOW_TASK_RUN',
          entityId: TASK_RUN_ID,
          externalType: 'JIRA_ISSUE',
          externalId: 'PROJ-42',
          externalUrl: 'https://mysite.atlassian.net/browse/PROJ-42',
          metadataJson: expect.objectContaining({
            key: 'PROJ-42',
            summary: 'Review deliverables',
            status: 'To Do',
            url: 'https://mysite.atlassian.net/browse/PROJ-42',
            lastSyncOrigin: 'APP',
          }),
        }),
      });
    });

    it('creates IntegrationSyncLog with direction OUTBOUND and syncType issue-create', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma);

      await createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID);

      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          integrationConnectionId: CONNECTION_ID,
          direction: 'OUTBOUND',
          syncType: 'issue-create',
          entityType: 'WORKFLOW_TASK_RUN',
          entityId: TASK_RUN_ID,
          status: 'STARTED',
        }),
      });
    });

    it('throws NOT_FOUND when taskRun not found', async () => {
      const prisma = createMockPrisma();
      prisma.workflowTaskRun.findUnique.mockResolvedValue(null);

      await expect(createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID)).rejects.toThrow(
        expect.objectContaining({
          code: 'NOT_FOUND',
        }),
      );
    });

    it('throws PRECONDITION_FAILED when connection status is not CONNECTED', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma, {
        connection: mockConnection({ status: 'DISCONNECTED' }),
      });

      await expect(createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID)).rejects.toThrow(
        expect.objectContaining({
          code: 'PRECONDITION_FAILED',
        }),
      );
    });

    it('throws UNAUTHORIZED on 401 response from Jira', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma, {
        fetchResponse: new Response('Unauthorized', { status: 401 }),
      });

      await expect(createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID)).rejects.toThrow(
        expect.objectContaining({
          code: 'UNAUTHORIZED',
        }),
      );
    });

    it('uses project and issueType from WorkflowTaskTemplate configJson', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma, {
        jiraConfig: {
          jiraEnabled: true,
          jiraProjectId: '20000',
          jiraIssueTypeId: '20001',
        },
      });

      await createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.fields.project).toEqual({ id: '20000' });
      expect(body.fields.issuetype).toEqual({ id: '20001' });
    });
  });

  // =========================================================================
  // transitionJiraIssue
  // =========================================================================

  describe('transitionJiraIssue', () => {
    function setupTransitionMocks(prisma: ReturnType<typeof createMockPrisma>) {
      prisma.externalLink.findFirst.mockResolvedValue({
        id: 'link-1',
        externalId: 'PROJ-42',
        entityId: TASK_RUN_ID,
        metadataJson: { key: 'PROJ-42', status: 'To Do', lastSyncOrigin: 'JIRA' },
      });
      prisma.workflowTaskRun.findUnique.mockResolvedValue({
        id: TASK_RUN_ID,
        workflowTaskTemplateId: 'tmpl-1',
      });
      prisma.workflowTaskTemplate.findUnique.mockResolvedValue({
        configJson: { jiraProjectId: '10000' },
      });
      mockJiraConfigParse.mockReturnValue({
        success: true,
        data: { jiraProjectId: '10000' },
      } as unknown);
      mockLookupTransition.mockResolvedValue({
        transitionId: '21',
        targetStatusName: 'In Progress',
        targetStatusCategory: 'indeterminate',
      });
      prisma.integrationConnection.findUnique.mockResolvedValue(mockConnection());
      mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    }

    it('calls fetch with POST {baseUrl}/issue/{key}/transitions and transition ID', async () => {
      const prisma = createMockPrisma();
      setupTransitionMocks(prisma);

      await transitionJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID, 'IN_PROGRESS');

      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/issue/PROJ-42/transitions`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ transition: { id: '21' } }),
        }),
      );
    });

    it('sets lastSyncOrigin APP on ExternalLink BEFORE calling Jira transition API', async () => {
      const prisma = createMockPrisma();
      setupTransitionMocks(prisma);

      const callOrder: string[] = [];
      prisma.externalLink.update.mockImplementation(() => {
        callOrder.push('externalLink.update');
        return Promise.resolve({});
      });
      mockFetch.mockImplementation(() => {
        callOrder.push('fetch');
        return Promise.resolve(new Response(null, { status: 204 }));
      });

      await transitionJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID, 'IN_PROGRESS');

      // The first externalLink.update (loop prevention) must happen before fetch
      const firstUpdate = callOrder.indexOf('externalLink.update');
      const firstFetch = callOrder.indexOf('fetch');
      expect(firstUpdate).toBeLessThan(firstFetch);

      // Verify the first update sets lastSyncOrigin=APP
      const firstUpdateCall = prisma.externalLink.update.mock.calls[0][0];
      expect(firstUpdateCall.data.metadataJson).toMatchObject({
        lastSyncOrigin: 'APP',
      });
    });

    it('silently returns when no ExternalLink found', async () => {
      const prisma = createMockPrisma();
      prisma.externalLink.findFirst.mockResolvedValue(null);

      await transitionJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID, 'IN_PROGRESS');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(prisma.integrationSyncLog.create).not.toHaveBeenCalled();
    });

    it('silently returns and logs sync when no mapping found', async () => {
      const prisma = createMockPrisma();
      prisma.externalLink.findFirst.mockResolvedValue({
        id: 'link-1',
        externalId: 'PROJ-42',
        entityId: TASK_RUN_ID,
        metadataJson: {},
      });
      prisma.workflowTaskRun.findUnique.mockResolvedValue({
        id: TASK_RUN_ID,
        workflowTaskTemplateId: 'tmpl-1',
      });
      prisma.workflowTaskTemplate.findUnique.mockResolvedValue({
        configJson: { jiraProjectId: '10000' },
      });
      mockJiraConfigParse.mockReturnValue({
        success: true,
        data: { jiraProjectId: '10000' },
      } as unknown);
      mockLookupTransition.mockResolvedValue(null);

      await transitionJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID, 'UNKNOWN_STATUS');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: 'OUTBOUND',
          syncType: 'issue-transition-unmapped',
          status: 'SUCCESS',
        }),
      });
    });

    it('creates sync log with direction OUTBOUND and syncType issue-transition', async () => {
      const prisma = createMockPrisma();
      setupTransitionMocks(prisma);

      await transitionJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID, 'IN_PROGRESS');

      // The second integrationSyncLog.create is for the actual transition
      const syncLogCalls = prisma.integrationSyncLog.create.mock.calls;
      const transitionLog = syncLogCalls.find(
        (call: unknown) => call[0].data.syncType === 'issue-transition',
      );
      expect(transitionLog).toBeDefined();
      expect(transitionLog?.[0].data).toMatchObject({
        direction: 'OUTBOUND',
        syncType: 'issue-transition',
        entityType: 'WORKFLOW_TASK_RUN',
        entityId: TASK_RUN_ID,
        status: 'STARTED',
      });
    });

    it('updates ExternalLink metadata with new status after successful transition', async () => {
      const prisma = createMockPrisma();
      setupTransitionMocks(prisma);

      await transitionJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID, 'IN_PROGRESS');

      // The second externalLink.update (after fetch) should have the new status
      const lastUpdateCall = prisma.externalLink.update.mock.calls.at(-1)?.[0];
      expect(lastUpdateCall.data.metadataJson).toMatchObject({
        status: 'In Progress',
        statusCategory: 'indeterminate',
        lastSyncOrigin: 'APP',
      });
    });
  });

  // =========================================================================
  // createJiraIssue - additional error/edge cases
  // =========================================================================

  describe('createJiraIssue - error handling', () => {
    it('throws BAD_REQUEST when jira is not enabled in task template config', async () => {
      const prisma = createMockPrisma();
      prisma.workflowTaskRun.findUnique.mockResolvedValue(mockTaskRun());
      prisma.workflowTaskTemplate.findUnique.mockResolvedValue({
        configJson: { jiraEnabled: false },
      });
      mockJiraConfigParse.mockReturnValue({
        success: true,
        data: { jiraEnabled: false, jiraProjectId: null, jiraIssueTypeId: null },
      } as unknown);

      await expect(createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID)).rejects.toThrow(
        expect.objectContaining({
          code: 'BAD_REQUEST',
        }),
      );
    });

    it('throws BAD_REQUEST when jiraTaskConfigSchema parse fails', async () => {
      const prisma = createMockPrisma();
      prisma.workflowTaskRun.findUnique.mockResolvedValue(mockTaskRun());
      prisma.workflowTaskTemplate.findUnique.mockResolvedValue({
        configJson: { invalid: true },
      });
      mockJiraConfigParse.mockReturnValue({ success: false } as unknown);

      await expect(createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID)).rejects.toThrow(
        expect.objectContaining({
          code: 'BAD_REQUEST',
        }),
      );
    });

    it('throws BAD_REQUEST when taskRun has no workflowTaskTemplateId', async () => {
      const prisma = createMockPrisma();
      prisma.workflowTaskRun.findUnique.mockResolvedValue(
        mockTaskRun({ workflowTaskTemplateId: null }),
      );

      await expect(createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID)).rejects.toThrow(
        expect.objectContaining({
          code: 'BAD_REQUEST',
        }),
      );
    });

    it('wraps non-200 Jira response as INTERNAL_SERVER_ERROR and updates sync log to FAILED', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma, {
        fetchResponse: new Response('Bad Request body', { status: 400 }),
      });

      await expect(createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID)).rejects.toThrow(
        expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
        }),
      );

      expect(prisma.integrationSyncLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: expect.stringContaining('400'),
          }),
        }),
      );
    });

    it('updates sync log to FAILED on UNAUTHORIZED error', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma, {
        fetchResponse: new Response('Unauthorized', { status: 401 }),
      });

      await expect(createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID)).rejects.toThrow(
        expect.objectContaining({ code: 'UNAUTHORIZED' }),
      );

      expect(prisma.integrationSyncLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
          }),
        }),
      );
    });

    it('uses task title as description when description is null', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma, {
        taskRun: mockTaskRun({ description: null }),
      });

      await createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.fields.description.content[0].content[0].text).toBe('Review deliverables');
    });

    it('falls back to siteName-based URL when siteUrl is absent', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma, {
        connection: mockConnection({
          configJson: { cloudId: CLOUD_ID, siteName: 'mycompany' },
        }),
      });

      await createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID);

      expect(prisma.externalLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          externalUrl: 'https://mycompany.atlassian.net/browse/PROJ-42',
        }),
      });
    });

    it('uses empty issueUrl when neither siteUrl nor siteName available', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma, {
        connection: mockConnection({
          configJson: { cloudId: CLOUD_ID },
        }),
      });

      await createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID);

      expect(prisma.externalLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          externalUrl: '',
        }),
      });
    });

    it('updates sync log to SUCCESS with issue details on success', async () => {
      const prisma = createMockPrisma();
      setupCreateMocks(prisma, {
        fetchResponse: mockCreateIssueResponse('PROJ-99', '55555'),
      });

      const result = await createJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID);

      expect(result).toEqual({ issueKey: 'PROJ-99', issueId: '55555' });
      expect(prisma.integrationSyncLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUCCESS',
            responsePayloadJson: expect.objectContaining({
              issueKey: 'PROJ-99',
              issueId: '55555',
            }),
          }),
        }),
      );
    });
  });

  // =========================================================================
  // transitionJiraIssue - additional error/edge cases
  // =========================================================================

  describe('transitionJiraIssue - error handling', () => {
    function setupTransitionMocks(prisma: ReturnType<typeof createMockPrisma>) {
      prisma.externalLink.findFirst.mockResolvedValue({
        id: 'link-1',
        externalId: 'PROJ-42',
        entityId: TASK_RUN_ID,
        metadataJson: { key: 'PROJ-42', status: 'To Do', lastSyncOrigin: 'JIRA' },
      });
      prisma.workflowTaskRun.findUnique.mockResolvedValue({
        id: TASK_RUN_ID,
        workflowTaskTemplateId: 'tmpl-1',
      });
      prisma.workflowTaskTemplate.findUnique.mockResolvedValue({
        configJson: { jiraProjectId: '10000' },
      });
      mockJiraConfigParse.mockReturnValue({
        success: true,
        data: { jiraProjectId: '10000' },
      } as unknown);
      mockLookupTransition.mockResolvedValue({
        transitionId: '21',
        targetStatusName: 'In Progress',
        targetStatusCategory: 'indeterminate',
      });
      prisma.integrationConnection.findUnique.mockResolvedValue(mockConnection());
      mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
    }

    it('throws UNAUTHORIZED on 401 response and updates sync log + connection error', async () => {
      const prisma = createMockPrisma();
      setupTransitionMocks(prisma);
      mockFetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }));

      await expect(
        transitionJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID, 'IN_PROGRESS'),
      ).rejects.toThrow(expect.objectContaining({ code: 'UNAUTHORIZED' }));

      expect(prisma.integrationSyncLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
      expect(prisma.integrationConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastErrorAt: expect.any(Date),
          }),
        }),
      );
    });

    it('wraps non-OK Jira response as INTERNAL_SERVER_ERROR', async () => {
      const prisma = createMockPrisma();
      setupTransitionMocks(prisma);
      mockFetch.mockResolvedValue(new Response('Server Error', { status: 500 }));

      await expect(
        transitionJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID, 'IN_PROGRESS'),
      ).rejects.toThrow(expect.objectContaining({ code: 'INTERNAL_SERVER_ERROR' }));
    });

    it('logs FAILED sync when projectId cannot be determined', async () => {
      const prisma = createMockPrisma();
      prisma.externalLink.findFirst.mockResolvedValue({
        id: 'link-1',
        externalId: 'PROJ-42',
        entityId: TASK_RUN_ID,
        metadataJson: {},
      });
      prisma.workflowTaskRun.findUnique.mockResolvedValue({
        id: TASK_RUN_ID,
        workflowTaskTemplateId: 'tmpl-1',
      });
      prisma.workflowTaskTemplate.findUnique.mockResolvedValue({
        configJson: {},
      });
      mockJiraConfigParse.mockReturnValue({
        success: false,
      } as unknown);

      await transitionJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID, 'IN_PROGRESS');

      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          syncType: 'issue-transition-unmapped',
          status: 'FAILED',
          errorMessage: expect.stringContaining('Cannot determine Jira project ID'),
        }),
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('silently returns when connection is not CONNECTED', async () => {
      const prisma = createMockPrisma();
      prisma.externalLink.findFirst.mockResolvedValue({
        id: 'link-1',
        externalId: 'PROJ-42',
        entityId: TASK_RUN_ID,
        metadataJson: {},
      });
      prisma.workflowTaskRun.findUnique.mockResolvedValue({
        id: TASK_RUN_ID,
        workflowTaskTemplateId: 'tmpl-1',
      });
      prisma.workflowTaskTemplate.findUnique.mockResolvedValue({
        configJson: { jiraProjectId: '10000' },
      });
      mockJiraConfigParse.mockReturnValue({
        success: true,
        data: { jiraProjectId: '10000' },
      } as unknown);
      mockLookupTransition.mockResolvedValue({
        transitionId: '21',
        targetStatusName: 'Done',
        targetStatusCategory: 'done',
      });
      prisma.integrationConnection.findUnique.mockResolvedValue(
        mockConnection({ status: 'DISCONNECTED' }),
      );

      await transitionJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID, 'DONE');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('silently returns when connection is null', async () => {
      const prisma = createMockPrisma();
      prisma.externalLink.findFirst.mockResolvedValue({
        id: 'link-1',
        externalId: 'PROJ-42',
        entityId: TASK_RUN_ID,
        metadataJson: {},
      });
      prisma.workflowTaskRun.findUnique.mockResolvedValue({
        id: TASK_RUN_ID,
        workflowTaskTemplateId: 'tmpl-1',
      });
      prisma.workflowTaskTemplate.findUnique.mockResolvedValue({
        configJson: { jiraProjectId: '10000' },
      });
      mockJiraConfigParse.mockReturnValue({
        success: true,
        data: { jiraProjectId: '10000' },
      } as unknown);
      mockLookupTransition.mockResolvedValue({
        transitionId: '21',
        targetStatusName: 'Done',
        targetStatusCategory: 'done',
      });
      prisma.integrationConnection.findUnique.mockResolvedValue(null);

      await transitionJiraIssue(prisma, ORG_ID, CONNECTION_ID, TASK_RUN_ID, 'DONE');

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // detectScopeExpansionNeeded
  // =========================================================================

  describe('detectScopeExpansionNeeded', () => {
    it('returns true when stored scope lacks write:jira-work', () => {
      const scope = 'read:jira-work manage:jira-webhook offline_access';
      expect(detectScopeExpansionNeeded(scope)).toBe(true);
    });

    it('returns true when stored scope lacks manage:jira-webhook', () => {
      const scope = 'read:jira-work write:jira-work offline_access';
      expect(detectScopeExpansionNeeded(scope)).toBe(true);
    });

    it('returns false when all required scopes present', () => {
      const scope = 'read:jira-work write:jira-work manage:jira-webhook offline_access';
      expect(detectScopeExpansionNeeded(scope)).toBe(false);
    });

    it('returns true when both required scopes are missing', () => {
      const scope = 'read:jira-work offline_access';
      expect(detectScopeExpansionNeeded(scope)).toBe(true);
    });

    it('returns true when scope string is empty', () => {
      expect(detectScopeExpansionNeeded('')).toBe(true);
    });
  });
});
