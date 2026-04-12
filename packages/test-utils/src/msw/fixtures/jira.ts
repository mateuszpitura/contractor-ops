import { mockId } from '../utils.js';

/** Factory for Jira-like objects with realistic shapes. */
export const jiraFixtures = {
  issue: (overrides?: Record<string, unknown>) => ({
    id: mockId(),
    key: `TEST-${Math.floor(Math.random() * 9999)}`,
    fields: {
      summary: 'Test Issue',
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Issue description' }],
          },
        ],
      },
      status: { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
      assignee: {
        accountId: 'user-001',
        displayName: 'Test User',
        emailAddress: 'test@example.com',
      },
      priority: { id: '3', name: 'Medium' },
      issuetype: { id: '10001', name: 'Task' },
      project: { id: '10000', key: 'TEST', name: 'Test Project' },
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      worklog: { total: 0, worklogs: [] },
      ...overrides,
    },
  }),

  /** Issue with minimal data — tests null handling */
  issueMinimal: (overrides?: Record<string, unknown>) => ({
    id: mockId(),
    key: `TEST-${Math.floor(Math.random() * 9999)}`,
    fields: {
      summary: 'Minimal Issue',
      status: { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
      assignee: null,
      priority: null,
      issuetype: { id: '10001', name: 'Task' },
      project: { id: '10000', key: 'TEST', name: 'Test Project' },
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      ...overrides,
    },
  }),

  worklog: (overrides?: Record<string, unknown>) => ({
    id: mockId(),
    timeSpentSeconds: 3600,
    started: new Date().toISOString(),
    author: { accountId: 'user-001', displayName: 'Test User' },
    comment: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Development work' }],
        },
      ],
    },
    ...overrides,
  }),
};
