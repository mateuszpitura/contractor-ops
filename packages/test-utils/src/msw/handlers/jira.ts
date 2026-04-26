import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

export function jiraHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- OAuth Token Exchange ---
    http.post('https://auth.atlassian.com/oauth/token', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        access_token: `atlassian_mock_${mockId()}`,
        refresh_token: `atlassian_refresh_${mockId()}`,
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read:jira-work write:jira-work offline_access',
      });
    }),

    // --- Cloud ID Discovery ---
    http.get('https://api.atlassian.com/oauth/token/accessible-resources', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json([
        {
          id: 'cloud-id-mock-001',
          name: 'Test Workspace',
          url: 'https://test-workspace.atlassian.net',
          scopes: ['read:jira-work', 'write:jira-work'],
        },
      ]);
    }),

    // --- Get Issue ---
    http.get(
      'https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/issue/:issueKey',
      async ({ params }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          id: mockId(),
          key: params.issueKey,
          self: `https://api.atlassian.com/ex/jira/${params.cloudId}/rest/api/3/issue/${params.issueKey}`,
          fields: {
            summary: 'Mock Jira Issue',
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
            worklog: {
              total: 0,
              worklogs: [],
            },
          },
        });
      },
    ),

    // --- Create Issue ---
    http.post('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/issue', async ({ params }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      const key = `TEST-${Math.floor(Math.random() * 9999)}`;
      return HttpResponse.json({
        id: mockId(),
        key,
        self: `https://api.atlassian.com/ex/jira/${params.cloudId}/rest/api/3/issue/${key}`,
      });
    }),

    // --- Update Issue ---
    http.put('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/issue/:issueKey', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return new HttpResponse(null, { status: 204 });
    }),

    // --- Transition Issue ---
    http.post(
      'https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/issue/:issueKey/transitions',
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return new HttpResponse(null, { status: 204 });
      },
    ),

    // --- Get Transitions ---
    http.get(
      'https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/issue/:issueKey/transitions',
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          transitions: [
            { id: '11', name: 'To Do', to: { id: '1', name: 'To Do' } },
            {
              id: '21',
              name: 'In Progress',
              to: { id: '3', name: 'In Progress' },
            },
            { id: '31', name: 'Done', to: { id: '5', name: 'Done' } },
          ],
        });
      },
    ),

    // --- Get Worklogs ---
    http.get(
      'https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/issue/:issueKey/worklog',
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          startAt: 0,
          maxResults: 20,
          total: 1,
          worklogs: [
            {
              id: '10001',
              self: 'https://api.atlassian.com/ex/jira/cloud-001/rest/api/3/issue/TEST-1/worklog/10001',
              timeSpentSeconds: 3600,
              started: new Date().toISOString(),
              author: {
                accountId: 'user-001',
                displayName: 'Test User',
                emailAddress: 'test@example.com',
              },
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
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
            },
          ],
        });
      },
    ),

    // --- Add Worklog ---
    http.post(
      'https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/issue/:issueKey/worklog',
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          id: mockId(),
          timeSpentSeconds: 3600,
          started: new Date().toISOString(),
          author: { accountId: 'user-001', displayName: 'Test User' },
        });
      },
    ),

    // --- Search Issues (JQL) — production uses GET with query params ---
    http.get('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/search', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        total: 1,
        startAt: 0,
        maxResults: 50,
        issues: [
          {
            id: '10001',
            key: 'TEST-1',
            fields: {
              summary: 'Search Result Issue',
              status: { id: '1', name: 'To Do', statusCategory: { key: 'new' } },
              assignee: null,
              issuetype: { id: '10001', name: 'Task' },
              project: { id: '10000', key: 'TEST', name: 'Test Project' },
            },
          },
        ],
      });
    }),

    // --- Get Statuses ---
    http.get('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/status', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json([
        {
          id: '1',
          name: 'To Do',
          statusCategory: { id: 2, key: 'new', name: 'To Do' },
        },
        {
          id: '3',
          name: 'In Progress',
          statusCategory: {
            id: 4,
            key: 'indeterminate',
            name: 'In Progress',
          },
        },
        {
          id: '5',
          name: 'Done',
          statusCategory: { id: 3, key: 'done', name: 'Done' },
        },
      ]);
    }),

    // --- Get Projects (paginated search) ---
    http.get('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/project/search', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        values: [
          {
            id: '10000',
            key: 'TEST',
            name: 'Test Project',
            projectTypeKey: 'software',
          },
        ],
        total: 1,
      });
    }),

    // --- List Projects ---
    http.get('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/project', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json([
        {
          id: '10000',
          key: 'TEST',
          name: 'Test Project',
          projectTypeKey: 'software',
        },
      ]);
    }),

    // --- Get Project with issue types ---
    http.get(
      'https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/project/:projectId',
      async ({ params }) => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json({
          id: params.projectId,
          key: 'TEST',
          name: 'Test Project',
          issueTypes: [
            { id: '10001', name: 'Task', subtask: false },
            { id: '10002', name: 'Bug', subtask: false },
            { id: '10003', name: 'Sub-task', subtask: true },
          ],
        });
      },
    ),

    // --- Get Project Statuses ---
    http.get(
      'https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/status/project/:projectId',
      async () => {
        const err = await applyNetworkConditions(net);
        if (err) return err;
        return HttpResponse.json([
          {
            id: '1',
            name: 'To Do',
            statusCategory: { id: 2, key: 'new', name: 'To Do' },
          },
          {
            id: '3',
            name: 'In Progress',
            statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
          },
          {
            id: '5',
            name: 'Done',
            statusCategory: { id: 3, key: 'done', name: 'Done' },
          },
        ]);
      },
    ),

    // --- Register Webhook ---
    http.post('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/webhook', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        webhookRegistrationResult: [
          {
            createdWebhookId: 10001,
          },
        ],
      });
    }),

    // --- Delete Webhook ---
    http.delete('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/webhook', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return new HttpResponse(null, { status: 202 });
    }),

    // --- Refresh Webhook ---
    http.put('https://api.atlassian.com/ex/jira/:cloudId/rest/api/3/webhook/refresh', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        webhookRegistrationResult: [{ createdWebhookId: 10001 }],
      });
    }),
  ];
}
