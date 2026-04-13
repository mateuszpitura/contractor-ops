/**
 * Integration: Linear GraphQL helper + MSW (real fetch, no GraphQL mock).
 */

import { createMockServer, HttpResponse, http, selectHandlers } from '@contractor-ops/test-utils';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { linearGraphQL } from '../linear-issue-sync.js';

const { server } = createMockServer({
  handlersOnly: true,
  extraHandlers: selectHandlers(['linear']),
});

beforeAll(() =>
  server.listen({
    onUnhandledRequest: 'warn',
  }),
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('linearGraphQL + MSW', () => {
  const token = 'lin_oauth_test_token';

  it('returns workflowState from mock Linear API', async () => {
    const data = await linearGraphQL<{
      workflowState: { id: string; name: string; type: string };
    }>(token, `query WorkflowState($id: String!) { workflowState(id: $id) { id name type } }`, {
      id: 'state-todo',
    });

    expect(data.workflowState.id).toBe('state-todo');
    expect(data.workflowState.name).toBe('Todo');
  });

  it('returns issueCreate payload from mock Linear API', async () => {
    const data = await linearGraphQL<{
      issueCreate: {
        success: boolean;
        issue: { identifier: string; title: string };
      };
    }>(
      token,
      `mutation IssueCreate($title: String!) { issueCreate(input: { title: $title, teamId: "team-001" }) { success issue { identifier title } } }`,
      { title: 'From MSW integration test' },
    );

    expect(data.issueCreate.success).toBe(true);
    /** MSW fixture uses variables.input.title when present; default is "Mock Issue" */
    expect(data.issueCreate.issue.title).toMatch(/Mock|MSW integration/);
    expect(data.issueCreate.issue.identifier).toMatch(/^ENG-/);
  });

  it('throws UNAUTHORIZED when Linear returns 401', async () => {
    server.use(
      http.post('https://api.linear.app/graphql', () =>
        HttpResponse.text('Unauthorized', { status: 401 }),
      ),
    );

    await expect(linearGraphQL(token, 'query { __typename }')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
