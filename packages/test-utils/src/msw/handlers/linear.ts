import { HttpResponse, http } from 'msw';
import type { HandlerOptions } from '../types.js';
import { applyNetworkConditions, mockId } from '../utils.js';

// ---------------------------------------------------------------------------
// GraphQL query dispatch
// ---------------------------------------------------------------------------

type QueryMatcher = {
  match: (query: string) => boolean;
  respond: (variables?: Record<string, unknown>) => { data: Record<string, unknown> };
};

const TEAM_STATES = [
  { id: 'state-backlog', name: 'Backlog', type: 'backlog', color: '#bec2c8', position: 0 },
  { id: 'state-todo', name: 'Todo', type: 'unstarted', color: '#e2e2e2', position: 1 },
  { id: 'state-progress', name: 'In Progress', type: 'started', color: '#f2c94c', position: 2 },
  { id: 'state-done', name: 'Done', type: 'completed', color: '#5e6ad2', position: 3 },
  { id: 'state-cancelled', name: 'Cancelled', type: 'canceled', color: '#95a2b3', position: 4 },
];

const GRAPHQL_MATCHERS: QueryMatcher[] = [
  {
    match: q => q.includes('teams') && q.includes('organization'),
    respond: () => ({
      data: {
        teams: {
          nodes: [
            { id: 'team-001', name: 'Engineering', key: 'ENG', states: { nodes: TEAM_STATES } },
          ],
        },
        organization: { id: 'org-001', name: 'Test Org', urlKey: 'test-org' },
      },
    }),
  },
  {
    match: q => q.includes('users') && (q.includes('email') || q.includes('filter')),
    respond: () => ({
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
    }),
  },
  {
    match: q => q.includes('issueCreate'),
    respond: variables => {
      const id = mockId();
      const num = Math.floor(Math.random() * 9999);
      return {
        data: {
          issueCreate: {
            success: true,
            issue: {
              id,
              number: num,
              identifier: `ENG-${num}`,
              title: (variables?.input as Record<string, unknown>)?.title ?? 'Mock Issue',
              url: `https://linear.app/test-org/issue/ENG-${id.slice(0, 4)}`,
              state: { id: 'state-todo', name: 'Todo', type: 'unstarted' },
            },
          },
        },
      };
    },
  },
  {
    match: q => q.includes('issueUpdate'),
    respond: variables => ({
      data: {
        issueUpdate: {
          success: true,
          issue: {
            id: variables?.id ?? mockId(),
            state: { id: 'state-progress', name: 'In Progress', type: 'started' },
          },
        },
      },
    }),
  },
  {
    match: q => q.includes('workflowState'),
    respond: variables => ({
      data: {
        workflowState: {
          id: (variables?.id as string) ?? 'state-todo',
          name: 'Todo',
          type: 'unstarted',
        },
      },
    }),
  },
  {
    match: q => q.includes('webhookCreate'),
    respond: () => ({
      data: { webhookCreate: { success: true, webhook: { id: mockId(), enabled: true } } },
    }),
  },
  {
    match: q => q.includes('webhookDelete'),
    respond: () => ({
      data: { webhookDelete: { success: true } },
    }),
  },
  {
    match: q => q.includes('issue(id:') || q.includes('issue('),
    respond: variables => ({
      data: {
        issue: {
          id: (variables?.id as string) ?? mockId(),
          identifier: 'ENG-123',
          title: 'Mock Issue',
          description: 'Issue description',
          state: { id: 'state-todo', name: 'Todo', type: 'unstarted' },
          assignee: { id: 'user-001', name: 'Test User', email: 'test@example.com' },
          team: { id: 'team-001', name: 'Engineering', key: 'ENG' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    }),
  },
];

function resolveLinearGraphQL(
  query: string,
  variables?: Record<string, unknown>,
): { data: Record<string, unknown> } {
  for (const matcher of GRAPHQL_MATCHERS) {
    if (matcher.match(query)) {
      return matcher.respond(variables);
    }
  }
  return { data: {} };
}

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
      const response = resolveLinearGraphQL(body.query, body.variables);
      return HttpResponse.json(response);
    }),
  ];
}
