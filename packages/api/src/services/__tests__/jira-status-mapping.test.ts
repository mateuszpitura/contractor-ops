import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStatusMapping,
  lookupJiraTransitionId,
  lookupWorkflowStatus,
  saveStatusMapping,
} from '../jira-status-mapping';

const mockPrisma = {
  integrationConnection: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
} as unknown;

const CONNECTION_ID = 'conn-1';
const PROJECT_ID = '10000';

const sampleMappings = [
  {
    workflowStatus: 'IN_PROGRESS',
    jiraTransitionId: '21',
    jiraTransitionName: 'Start Progress',
    jiraTargetStatusName: 'In Progress',
    jiraTargetStatusCategory: 'indeterminate' as const,
  },
  {
    workflowStatus: 'DONE',
    jiraTransitionId: '31',
    jiraTransitionName: 'Complete',
    jiraTargetStatusName: 'Done',
    jiraTargetStatusCategory: 'done' as const,
  },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe('jira-status-mapping', () => {
  describe('saveStatusMapping', () => {
    it('stores mapping in IntegrationConnection.configJson.statusMappings keyed by project ID', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        configJson: {},
      });
      mockPrisma.integrationConnection.update.mockResolvedValue({});

      await saveStatusMapping(mockPrisma, CONNECTION_ID, PROJECT_ID, sampleMappings);

      expect(mockPrisma.integrationConnection.update).toHaveBeenCalledWith({
        where: { id: CONNECTION_ID },
        data: {
          configJson: {
            statusMappings: {
              [PROJECT_ID]: sampleMappings,
            },
          },
        },
      });
    });

    it('overwrites existing mapping for the same project', async () => {
      const oldMappings = [
        {
          workflowStatus: 'TODO',
          jiraTransitionId: '11',
          jiraTransitionName: 'To Do',
          jiraTargetStatusName: 'To Do',
          jiraTargetStatusCategory: 'new' as const,
        },
      ];
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        configJson: { statusMappings: { [PROJECT_ID]: oldMappings } },
      });
      mockPrisma.integrationConnection.update.mockResolvedValue({});

      await saveStatusMapping(mockPrisma, CONNECTION_ID, PROJECT_ID, sampleMappings);

      const updateCall = mockPrisma.integrationConnection.update.mock.calls[0][0];
      expect(updateCall.data.configJson.statusMappings[PROJECT_ID]).toEqual(sampleMappings);
    });

    it('preserves other configJson fields when updating', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        configJson: { cloudId: 'cloud-123', otherField: 'keep-me' },
      });
      mockPrisma.integrationConnection.update.mockResolvedValue({});

      await saveStatusMapping(mockPrisma, CONNECTION_ID, PROJECT_ID, sampleMappings);

      const updateCall = mockPrisma.integrationConnection.update.mock.calls[0][0];
      expect(updateCall.data.configJson.cloudId).toBe('cloud-123');
      expect(updateCall.data.configJson.otherField).toBe('keep-me');
      expect(updateCall.data.configJson.statusMappings[PROJECT_ID]).toEqual(sampleMappings);
    });
  });

  describe('getStatusMapping', () => {
    it('returns mapping for a given project ID', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        configJson: { statusMappings: { [PROJECT_ID]: sampleMappings } },
      });

      const result = await getStatusMapping(mockPrisma, CONNECTION_ID, PROJECT_ID);

      expect(result).toEqual(sampleMappings);
    });

    it('returns null when no mapping exists for project', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        configJson: { statusMappings: {} },
      });

      const result = await getStatusMapping(mockPrisma, CONNECTION_ID, 'nonexistent-project');

      expect(result).toBeNull();
    });
  });

  describe('lookupJiraTransitionId', () => {
    it('returns Jira transition ID for a given WorkflowTaskStatus and project', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        configJson: { statusMappings: { [PROJECT_ID]: sampleMappings } },
      });

      const result = await lookupJiraTransitionId(
        mockPrisma,
        CONNECTION_ID,
        PROJECT_ID,
        'IN_PROGRESS',
      );

      expect(result).toEqual({
        transitionId: '21',
        targetStatusName: 'In Progress',
        targetStatusCategory: 'indeterminate',
      });
    });

    it('returns null for unmapped status', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        configJson: { statusMappings: { [PROJECT_ID]: sampleMappings } },
      });

      const result = await lookupJiraTransitionId(mockPrisma, CONNECTION_ID, PROJECT_ID, 'BLOCKED');

      expect(result).toBeNull();
    });
  });

  describe('lookupWorkflowStatus', () => {
    it('returns WorkflowTaskStatus for a given Jira status name and project', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        configJson: { statusMappings: { [PROJECT_ID]: sampleMappings } },
      });

      const result = await lookupWorkflowStatus(
        mockPrisma,
        CONNECTION_ID,
        PROJECT_ID,
        'In Progress',
      );

      expect(result).toBe('IN_PROGRESS');
    });

    it('returns null for unmapped Jira status', async () => {
      mockPrisma.integrationConnection.findUnique.mockResolvedValue({
        configJson: { statusMappings: { [PROJECT_ID]: sampleMappings } },
      });

      const result = await lookupWorkflowStatus(
        mockPrisma,
        CONNECTION_ID,
        PROJECT_ID,
        'Unknown Status',
      );

      expect(result).toBeNull();
    });
  });
});
