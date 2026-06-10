import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { processJiraWebhook } from '../jira-webhook-handler';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: vi.fn().mockReturnValue({ accessToken: 'mock-token' }),
}));

vi.mock('@contractor-ops/validators', () => ({
  getServerEnv: vi.fn(() => process.env),
  jiraWebhookPayloadSchema: { safeParse: vi.fn() },
}));

vi.mock('../jira-status-mapping', () => ({
  lookupWorkflowStatus: vi.fn(),
}));

vi.mock('../../routers/workflow/workflow-shared', () => ({
  validateTransition: vi.fn(() => true),
  unblockDependentsAndRecomputeRun: vi.fn(async () => undefined),
}));

import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { jiraWebhookPayloadSchema } from '@contractor-ops/validators';
import { lookupWorkflowStatus } from '../jira-status-mapping';

const mockDecryptCredentials = vi.mocked(decryptCredentials);
const mockPayloadParse = vi.mocked(jiraWebhookPayloadSchema.safeParse);
const mockLookupWorkflowStatus = vi.mocked(lookupWorkflowStatus);

vi.stubGlobal('fetch', vi.fn());
const mockFetch = vi.mocked(fetch);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const CONNECTION_ID = 'conn-1';
const TASK_RUN_ID = 'taskrun-1';
const ISSUE_KEY = 'PROJ-42';
const PROJECT_ID = '10000';

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

function createMockPrisma() {
  const client = {
    workflowTaskRun: {
      findFirst: vi.fn().mockResolvedValue({
        id: TASK_RUN_ID,
        status: 'IN_PROGRESS',
        workflowRunId: 'run-1',
      }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([{ status: 'DONE', resultJson: null }]),
    },
    workflowRun: {
      update: vi.fn().mockResolvedValue({}),
    },
    integrationConnection: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    externalLink: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    integrationSyncLog: {
      create: vi.fn().mockResolvedValue({ id: 'sync-1' }),
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof client) => Promise<void>) => fn(client)),
  };
  return client as unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWebhookPayload(
  overrides: {
    issueKey?: string;
    statusFrom?: string;
    statusTo?: string;
    statusCategoryKey?: string;
    summary?: string;
    projectId?: string;
    changelogItems?: Array<{ field: string; fromString: string | null; toString: string | null }>;
  } = {},
) {
  const {
    issueKey = ISSUE_KEY,
    statusFrom = 'To Do',
    statusTo = 'In Progress',
    statusCategoryKey = 'indeterminate',
    summary = 'Review deliverables',
    projectId = PROJECT_ID,
    changelogItems,
  } = overrides;

  return {
    webhookEvent: 'jira:issue_updated',
    issue: {
      key: issueKey,
      fields: {
        summary,
        status: {
          name: statusTo,
          statusCategory: { key: statusCategoryKey },
        },
        project: { id: projectId },
      },
    },
    changelog: {
      items: changelogItems ?? [
        {
          field: 'status',
          fromString: statusFrom,
          toString: statusTo,
        },
      ],
    },
  };
}

function makeExternalLink(metadataOverrides: Record<string, unknown> = {}) {
  return {
    id: 'link-1',
    externalId: ISSUE_KEY,
    entityId: TASK_RUN_ID,
    externalUrl: 'https://mysite.atlassian.net/browse/PROJ-42',
    metadataJson: {
      key: ISSUE_KEY,
      status: 'To Do',
      url: 'https://mysite.atlassian.net/browse/PROJ-42',
      ...metadataOverrides,
    },
  };
}

function setupValidPayload(payload = makeWebhookPayload()) {
  mockPayloadParse.mockReturnValue({ success: true, data: payload } as unknown);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  mockFetch.mockReset();
  mockDecryptCredentials.mockReturnValue({ accessToken: 'mock-token' } as unknown);
});

describe('jira-webhook-handler', () => {
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // processJiraWebhook
  // =========================================================================

  describe('processJiraWebhook', () => {
    it('extracts status change from changelog.items where field is status', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload({ statusTo: 'Done', statusCategoryKey: 'done' });
      setupValidPayload(payload);
      prisma.externalLink.findFirst.mockResolvedValue(makeExternalLink());
      prisma.integrationSyncLog.findFirst.mockResolvedValue(null);
      mockLookupWorkflowStatus.mockResolvedValue('DONE');

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      // The mapped status lookup received the extracted status name
      expect(mockLookupWorkflowStatus).toHaveBeenCalledWith(
        prisma,
        ORG_ID,
        CONNECTION_ID,
        PROJECT_ID,
        'Done',
      );
    });

    it('finds ExternalLink by issueKey and skips when not found', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload();
      setupValidPayload(payload);
      prisma.externalLink.findFirst.mockResolvedValue(null);

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      expect(prisma.externalLink.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          externalType: 'JIRA_ISSUE',
          externalId: ISSUE_KEY,
        }),
      });
      // Should not attempt to update task run
      expect(prisma.workflowTaskRun.update).not.toHaveBeenCalled();
    });

    it('maps Jira status to workflow status via lookupWorkflowStatus', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload({ statusTo: 'In Review' });
      setupValidPayload(payload);
      prisma.externalLink.findFirst.mockResolvedValue(makeExternalLink());
      prisma.integrationSyncLog.findFirst.mockResolvedValue(null);
      mockLookupWorkflowStatus.mockResolvedValue('IN_REVIEW');

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      expect(mockLookupWorkflowStatus).toHaveBeenCalledWith(
        prisma,
        ORG_ID,
        CONNECTION_ID,
        PROJECT_ID,
        'In Review',
      );
    });

    it('updates workflowTaskRun status with the mapped value', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload({ statusTo: 'In Progress' });
      setupValidPayload(payload);
      prisma.externalLink.findFirst.mockResolvedValue(makeExternalLink());
      prisma.integrationSyncLog.findFirst.mockResolvedValue(null);
      mockLookupWorkflowStatus.mockResolvedValue('IN_PROGRESS');

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      expect(prisma.workflowTaskRun.update).toHaveBeenCalledWith({
        where: { id: TASK_RUN_ID, organizationId: ORG_ID },
        data: { status: 'IN_PROGRESS' },
      });
    });

    it('updates ExternalLink metadataJson with new status, statusCategory, and lastSyncOrigin JIRA', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload({
        statusTo: 'Done',
        statusCategoryKey: 'done',
      });
      setupValidPayload(payload);
      prisma.externalLink.findFirst.mockResolvedValue(makeExternalLink());
      prisma.integrationSyncLog.findFirst.mockResolvedValue(null);
      mockLookupWorkflowStatus.mockResolvedValue('DONE');

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      expect(prisma.externalLink.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: {
          metadataJson: expect.objectContaining({
            key: ISSUE_KEY,
            status: 'Done',
            statusCategory: 'done',
            lastSyncOrigin: 'JIRA',
          }),
        },
      });
    });

    it('creates sync log with direction INBOUND and syncType issue-status-change', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload();
      setupValidPayload(payload);
      prisma.externalLink.findFirst.mockResolvedValue(makeExternalLink());
      prisma.integrationSyncLog.findFirst.mockResolvedValue(null);
      mockLookupWorkflowStatus.mockResolvedValue('IN_PROGRESS');

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      const syncCreateCalls = prisma.integrationSyncLog.create.mock.calls;
      const statusChangeLog = syncCreateCalls.find(
        (call: unknown) => call[0].data.syncType === 'issue-status-change',
      );
      expect(statusChangeLog).toBeDefined();
      expect(statusChangeLog?.[0].data).toMatchObject({
        direction: 'INBOUND',
        syncType: 'issue-status-change',
        entityType: 'WORKFLOW_TASK_RUN',
        entityId: TASK_RUN_ID,
        status: 'STARTED',
      });
    });

    it('skips when changelog has no status field change', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload({
        changelogItems: [{ field: 'assignee', fromString: 'Alice', toString: 'Bob' }],
      });
      setupValidPayload(payload);

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      expect(prisma.externalLink.findFirst).not.toHaveBeenCalled();
      expect(prisma.workflowTaskRun.update).not.toHaveBeenCalled();
    });

    it('skips when Jira status has no workflow mapping', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload({ statusTo: 'Unknown Jira Status' });
      setupValidPayload(payload);
      prisma.externalLink.findFirst.mockResolvedValue(makeExternalLink());
      prisma.integrationSyncLog.findFirst.mockResolvedValue(null);
      mockLookupWorkflowStatus.mockResolvedValue(null);

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      expect(prisma.workflowTaskRun.update).not.toHaveBeenCalled();
      // Should log unmapped status
      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          syncType: 'webhook-status-unmapped',
        }),
      });
    });
  });

  // =========================================================================
  // Loop prevention
  // =========================================================================

  describe('loop prevention', () => {
    it('skips webhook when lastSyncOrigin is APP and lastSyncAt within 30 seconds', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload();
      setupValidPayload(payload);
      // lastSyncAt is 5 seconds ago (well within 30s window)
      const recentSync = new Date(Date.now() - 5_000).toISOString();
      prisma.externalLink.findFirst.mockResolvedValue(
        makeExternalLink({ lastSyncOrigin: 'APP', lastSyncAt: recentSync }),
      );

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      expect(prisma.workflowTaskRun.update).not.toHaveBeenCalled();
      // Should create a loop-suppressed sync log
      expect(prisma.integrationSyncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          syncType: 'webhook-loop-suppressed',
        }),
      });
    });

    it('processes webhook when lastSyncOrigin is APP but lastSyncAt older than 30 seconds', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload();
      setupValidPayload(payload);
      // lastSyncAt is 60 seconds ago (outside 30s window)
      const oldSync = new Date(Date.now() - 60_000).toISOString();
      prisma.externalLink.findFirst.mockResolvedValue(
        makeExternalLink({ lastSyncOrigin: 'APP', lastSyncAt: oldSync }),
      );
      prisma.integrationSyncLog.findFirst.mockResolvedValue(null);
      mockLookupWorkflowStatus.mockResolvedValue('IN_PROGRESS');

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      expect(prisma.workflowTaskRun.update).toHaveBeenCalled();
    });

    it('processes webhook when lastSyncOrigin is JIRA', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload();
      setupValidPayload(payload);
      const recentSync = new Date(Date.now() - 5_000).toISOString();
      prisma.externalLink.findFirst.mockResolvedValue(
        makeExternalLink({ lastSyncOrigin: 'JIRA', lastSyncAt: recentSync }),
      );
      prisma.integrationSyncLog.findFirst.mockResolvedValue(null);
      mockLookupWorkflowStatus.mockResolvedValue('IN_PROGRESS');

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      expect(prisma.workflowTaskRun.update).toHaveBeenCalled();
    });

    it('processes webhook when no lastSyncOrigin is present', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload();
      setupValidPayload(payload);
      prisma.externalLink.findFirst.mockResolvedValue(
        makeExternalLink({}), // no lastSyncOrigin
      );
      prisma.integrationSyncLog.findFirst.mockResolvedValue(null);
      mockLookupWorkflowStatus.mockResolvedValue('IN_PROGRESS');

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      expect(prisma.workflowTaskRun.update).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Deduplication
  // =========================================================================

  describe('deduplication', () => {
    it('skips when same issue and status processed within 5 seconds', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload({ statusTo: 'In Progress' });
      setupValidPayload(payload);
      prisma.externalLink.findFirst.mockResolvedValue(makeExternalLink());
      // Simulate a recent sync log for the same issue+status
      prisma.integrationSyncLog.findFirst.mockResolvedValue({
        id: 'dup-sync-1',
        responsePayloadJson: { issueKey: ISSUE_KEY, newStatus: 'In Progress' },
      });

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      // Should not update task run due to dedup
      expect(prisma.workflowTaskRun.update).not.toHaveBeenCalled();
    });

    it('processes when same issue but different status', async () => {
      const prisma = createMockPrisma();
      const payload = makeWebhookPayload({ statusTo: 'Done', statusCategoryKey: 'done' });
      setupValidPayload(payload);
      prisma.externalLink.findFirst.mockResolvedValue(makeExternalLink());
      // Recent sync log has different status
      prisma.integrationSyncLog.findFirst.mockResolvedValue({
        id: 'dup-sync-1',
        responsePayloadJson: { issueKey: ISSUE_KEY, newStatus: 'In Progress' },
      });
      mockLookupWorkflowStatus.mockResolvedValue('DONE');

      await processJiraWebhook(prisma, ORG_ID, CONNECTION_ID, payload);

      expect(prisma.workflowTaskRun.update).toHaveBeenCalledWith({
        where: { id: TASK_RUN_ID, organizationId: ORG_ID },
        data: { status: 'DONE' },
      });
    });
  });
});
