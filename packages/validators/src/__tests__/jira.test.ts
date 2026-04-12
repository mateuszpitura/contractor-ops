/**
 * Validators in `jira.ts`: webhook payload, task config, status mappings, metadata.
 */

import { describe, expect, it } from 'vitest';
import {
  jiraIssueMetadataSchema,
  jiraProjectSchema,
  jiraStatusMappingEntrySchema,
  jiraTaskConfigSchema,
  jiraTransitionSchema,
  jiraWebhookPayloadSchema,
  saveJiraStatusMappingInputSchema,
  saveJiraTaskConfigInputSchema,
} from '../jira.js';

const minimalWebhook = {
  webhookEvent: 'jira:issue_updated' as const,
  timestamp: 1700000000,
  issue: {
    id: '100',
    key: 'CO-1',
    fields: {
      summary: 'Task',
      status: {
        name: 'To Do',
        statusCategory: { key: 'new' as const, name: 'New' },
      },
      project: { id: '1', key: 'CO', name: 'Core' },
    },
  },
  changelog: {
    items: [
      {
        field: 'status',
        fieldtype: 'jira',
        from: null,
        fromString: null,
        to: '2',
        toString: 'In Progress',
      },
    ],
  },
};

describe('jiraWebhookPayloadSchema', () => {
  it('parses minimal valid webhook', () => {
    const r = jiraWebhookPayloadSchema.safeParse(minimalWebhook);
    expect(r.success).toBe(true);
  });

  it('rejects wrong webhookEvent literal', () => {
    const r = jiraWebhookPayloadSchema.safeParse({
      ...minimalWebhook,
      webhookEvent: 'issue_created',
    });
    expect(r.success).toBe(false);
  });
});

describe('jiraTaskConfigSchema', () => {
  it('defaults jiraEnabled false', () => {
    const r = jiraTaskConfigSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.jiraEnabled).toBe(false);
  });
});

describe('jiraStatusMappingEntrySchema', () => {
  it('accepts mapping entry', () => {
    const r = jiraStatusMappingEntrySchema.safeParse({
      workflowStatus: 'DONE',
      jiraTransitionId: 't1',
      jiraTransitionName: 'Done',
      jiraTargetStatusName: 'Done',
      jiraTargetStatusCategory: 'done',
    });
    expect(r.success).toBe(true);
  });
});

describe('jiraIssueMetadataSchema', () => {
  it('requires valid url', () => {
    const good = jiraIssueMetadataSchema.safeParse({
      key: 'CO-1',
      summary: 'x',
      status: 'Open',
      statusCategory: 'new',
      url: 'https://example.atlassian.net/browse/CO-1',
    });
    expect(good.success).toBe(true);

    const bad = jiraIssueMetadataSchema.safeParse({
      key: 'CO-1',
      summary: 'x',
      status: 'Open',
      statusCategory: 'new',
      url: 'not-url',
    });
    expect(bad.success).toBe(false);
  });
});

describe('jiraProjectSchema', () => {
  it('parses project', () => {
    const r = jiraProjectSchema.safeParse({
      id: '1',
      key: 'P',
      name: 'Proj',
    });
    expect(r.success).toBe(true);
  });
});

describe('jiraTransitionSchema', () => {
  it('parses transition with nested status category', () => {
    const r = jiraTransitionSchema.safeParse({
      id: 'tr1',
      name: 'Close',
      to: {
        id: 's3',
        name: 'Done',
        statusCategory: { key: 'done', name: 'Done' },
      },
    });
    expect(r.success).toBe(true);
  });
});

describe('saveJiraStatusMappingInputSchema', () => {
  it('accepts mappings array', () => {
    const r = saveJiraStatusMappingInputSchema.safeParse({
      connectionId: 'c1',
      projectId: 'p1',
      mappings: [
        {
          workflowStatus: 'DONE',
          jiraTransitionId: 't1',
          jiraTransitionName: 'Done',
          jiraTargetStatusName: 'Done',
          jiraTargetStatusCategory: 'done',
        },
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe('saveJiraTaskConfigInputSchema', () => {
  it('wraps task config', () => {
    const r = saveJiraTaskConfigInputSchema.safeParse({
      taskTemplateId: 'tmpl1',
      config: { jiraEnabled: true, jiraProjectKey: 'CO' },
    });
    expect(r.success).toBe(true);
  });
});
