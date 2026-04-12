import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

export function linearHandlers(options?: HandlerOptions) {
  const net = options?.network;

  return [
    // --- OAuth Token Exchange ---
    http.post('https://api.linear.app/oauth/token', async () => {
      const err = await applyNetworkConditions(net);
      if (err) return err;
      return HttpResponse.json({
        access_token: `lin_mock_${mockId()}`,
        refresh_token: `lin_refresh_${mockId()}`,
        expires_in: 315360000,
        token_type: 'Bearer',
        scope: ['read', 'write', 'issues:create'],
      });
    }),

    // --- GraphQL API ---
    http.post('https://api.linear.app/graphql', async ({ request }) => {
      const err = await applyNetworkConditions(net);
      if (err) return err;

      const body = (await request.json()) as { query: string; variables?: Record<string, unknown> };
      const query = body.query;

      // Workspace / teams query
      if (query.includes('teams') && query.includes('organization')) {
        return HttpResponse.json({
          data: {
            teams: {
              nodes: [
                {
                  id: 'team-001',
                  name: 'Engineering',
                  key: 'ENG',
                  states: {
                    nodes: [
                      {
                        id: 'state-backlog',
                        name: 'Backlog',
                        type: 'backlog',
                        color: '#bec2c8',
                        position: 0,
                      },
                      {
                        id: 'state-todo',
                        name: 'Todo',
                        type: 'unstarted',
                        color: '#e2e2e2',
                        position: 1,
                      },
                      {
                        id: 'state-progress',
                        name: 'In Progress',
                        type: 'started',
                        color: '#f2c94c',
                        position: 2,
                      },
                      {
                        id: 'state-done',
                        name: 'Done',
                        type: 'completed',
                        color: '#5e6ad2',
                        position: 3,
                      },
                      {
                        id: 'state-cancelled',
                        name: 'Cancelled',
                        type: 'canceled',
                        color: '#95a2b3',
                        position: 4,
                      },
                    ],
                  },
                },
              ],
            },
            organization: {
              id: 'org-001',
              name: 'Test Org',
              urlKey: 'test-org',
            },
          },
        });
      }

      // Users query (email lookup for assignment)
      if (query.includes('users') && (query.includes('email') || query.includes('filter'))) {
        return HttpResponse.json({
          data: {
            users: {
              nodes: [
                {
                  id: 'user-001',
                  name: 'Test User',
                  email: 'test@example.com',
                  active: true,
                  displayName: 'Test User',
                },
              ],
            },
          },
        });
      }

      // Issue create mutation
      if (query.includes('issueCreate')) {
        const id = mockId();
        const num = Math.floor(Math.random() * 9999);
        return HttpResponse.json({
          data: {
            issueCreate: {
              success: true,
              issue: {
                id,
                number: num,
                identifier: `ENG-${num}`,
                title: (body.variables?.input as Record<string, unknown>)?.title ?? 'Mock Issue',
                url: `https://linear.app/test-org/issue/ENG-${id.slice(0, 4)}`,
                state: { id: 'state-todo', name: 'Todo', type: 'unstarted' },
              },
            },
          },
        });
      }

      // Issue update mutation
      if (query.includes('issueUpdate')) {
        return HttpResponse.json({
          data: {
            issueUpdate: {
              success: true,
              issue: {
                id: body.variables?.id ?? mockId(),
                state: { id: 'state-progress', name: 'In Progress', type: 'started' },
              },
            },
          },
        });
      }

      // WorkflowState query (used in webhook handler for state lookup)
      if (query.includes('workflowState')) {
        return HttpResponse.json({
          data: {
            workflowState: {
              id: (body.variables?.id as string) ?? 'state-todo',
              name: 'Todo',
              type: 'unstarted',
            },
          },
        });
      }

      // Webhook create mutation
      if (query.includes('webhookCreate')) {
        return HttpResponse.json({
          data: {
            webhookCreate: {
              success: true,
              webhook: {
                id: mockId(),
                enabled: true,
              },
            },
          },
        });
      }

      // Webhook delete mutation
      if (query.includes('webhookDelete')) {
        return HttpResponse.json({
          data: {
            webhookDelete: {
              success: true,
            },
          },
        });
      }

      // Issue query by ID
      if (query.includes('issue(id:') || query.includes('issue(')) {
        return HttpResponse.json({
          data: {
            issue: {
              id: (body.variables?.id as string) ?? mockId(),
              identifier: 'ENG-123',
              title: 'Mock Issue',
              description: 'Issue description',
              state: { id: 'state-todo', name: 'Todo', type: 'unstarted' },
              assignee: {
                id: 'user-001',
                name: 'Test User',
                email: 'test@example.com',
              },
              team: { id: 'team-001', name: 'Engineering', key: 'ENG' },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }

      // Default: empty data
      return HttpResponse.json({ data: {} });
    }),
  ];
}
