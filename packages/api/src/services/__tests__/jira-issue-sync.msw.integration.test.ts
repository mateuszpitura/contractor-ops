/**
 * Integration: real fetch calls to Jira REST API intercepted by MSW mock handlers.
 * Verifies createJiraIssue() POSTs to Jira issue endpoint, updates task run,
 * creates external link, and logs sync.
 */
import { createMockServer, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const ORG_ID = 'org-jira-issue';
const CONNECTION_ID = 'conn-jira-002';
const TASK_RUN_ID = 'task-run-001';
const TEMPLATE_ID = 'tmpl-001';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    integrationConnection: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    workflowTaskRun: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    workflowTaskTemplate: {
      findUnique: vi.fn(),
    },
    externalLink: {
      create: vi.fn().mockResolvedValue({}),
    },
    integrationSyncLog: {
      create: vi.fn().mockResolvedValue({ id: 'sync-log-002' }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  return { mockPrisma };
});

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  prisma: mockPrisma,
}));

vi.mock('@contractor-ops/integrations/services/credential-service', () => ({
  decryptCredentials: vi.fn().mockReturnValue({
    accessToken: 'jira-test-token',
    cloudId: 'cloud-id-mock-001',
  }),
}));

// Import after mocks are defined
const { createJiraIssue } = await import('../jira-issue-sync.js');

// ---------------------------------------------------------------------------
// MSW Server
// ---------------------------------------------------------------------------

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['jira']),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('jira-issue-sync + MSW', () => {
  it('createJiraIssue creates issue and returns { issueKey, issueId }', async () => {
    // Task run with template reference
    mockPrisma.workflowTaskRun.findUnique.mockResolvedValue({
      id: TASK_RUN_ID,
      title: 'Onboard contractor',
      description: 'Set up access and equipment',
      workflowTaskTemplateId: TEMPLATE_ID,
      workflowRun: { contractorId: 'contractor-001' },
    });

    // Template with Jira config enabled
    mockPrisma.workflowTaskTemplate.findUnique.mockResolvedValue({
      id: TEMPLATE_ID,
      configJson: {
        jiraEnabled: true,
        jiraProjectId: '10000',
        jiraIssueTypeId: '10001',
        jiraProjectKey: 'TEST',
      },
    });

    // Connection — CONNECTED with cloudId
    mockPrisma.integrationConnection.findUnique.mockResolvedValue({
      id: CONNECTION_ID,
      credentialsRef: 'encrypted-ref',
      status: 'CONNECTED',
      configJson: {
        cloudId: 'cloud-id-mock-001',
        siteName: 'test-workspace',
        siteUrl: 'https://test-workspace.atlassian.net',
      },
    });

    const result = await createJiraIssue(mockPrisma as never, ORG_ID, CONNECTION_ID, TASK_RUN_ID);

    // MSW handler returns { id: mockId(), key: 'TEST-XXXX', self: '...' }
    expect(result.issueKey).toMatch(/^TEST-\d+$/);
    expect(result.issueId).toBeDefined();

    // Verify task run was updated with external reference
    expect(mockPrisma.workflowTaskRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TASK_RUN_ID },
        data: expect.objectContaining({
          externalRefType: 'JIRA_ISSUE',
          externalRefId: result.issueKey,
        }),
      }),
    );

    // Verify external link was created
    expect(mockPrisma.externalLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          entityType: 'WORKFLOW_TASK_RUN',
          entityId: TASK_RUN_ID,
          externalType: 'JIRA_ISSUE',
          externalId: result.issueKey,
        }),
      }),
    );

    // Verify sync log was updated to SUCCESS
    expect(mockPrisma.integrationSyncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SUCCESS',
          responsePayloadJson: expect.objectContaining({
            issueKey: result.issueKey,
            issueId: result.issueId,
          }),
        }),
      }),
    );
  });

  it('throws when task run not found', async () => {
    mockPrisma.workflowTaskRun.findUnique.mockResolvedValue(null);

    await expect(
      createJiraIssue(mockPrisma as never, ORG_ID, CONNECTION_ID, 'nonexistent'),
    ).rejects.toThrow('Workflow task run not found');
  });

  it('throws when Jira config is not enabled on template', async () => {
    mockPrisma.workflowTaskRun.findUnique.mockResolvedValue({
      id: TASK_RUN_ID,
      title: 'Task',
      description: null,
      workflowTaskTemplateId: TEMPLATE_ID,
      workflowRun: { contractorId: 'contractor-001' },
    });

    // Template without Jira config
    mockPrisma.workflowTaskTemplate.findUnique.mockResolvedValue({
      id: TEMPLATE_ID,
      configJson: { jiraEnabled: false },
    });

    await expect(
      createJiraIssue(mockPrisma as never, ORG_ID, CONNECTION_ID, TASK_RUN_ID),
    ).rejects.toThrow('Jira is not configured for this task template');
  });
});
