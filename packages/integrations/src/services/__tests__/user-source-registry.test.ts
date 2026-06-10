import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { linearGraphQL } from '../linear-teams-client.js';
import {
  clearUserSourceFetchers,
  fetchUsersFromIntegrationSource,
  registerBuiltInUserSourceFetchers,
} from '../user-source-registry.js';

vi.mock('../linear-teams-client.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../linear-teams-client.js')>();
  return {
    ...actual,
    linearGraphQL: vi.fn(),
  };
});

const linearGraphQLMock = vi.mocked(linearGraphQL);

describe('user-source-registry', () => {
  beforeEach(() => {
    clearUserSourceFetchers();
    registerBuiltInUserSourceFetchers();
    linearGraphQLMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws for unknown provider when registry empty', async () => {
    clearUserSourceFetchers();
    await expect(fetchUsersFromIntegrationSource('JIRA', 'token', {})).rejects.toThrow(
      'Unknown user source provider',
    );
  });

  it('throws when Jira cloudId missing', async () => {
    await expect(fetchUsersFromIntegrationSource('JIRA', 'token', {})).rejects.toThrow(
      'Missing or invalid Jira cloudId',
    );
  });

  it('fetches Jira users when cloudId is valid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              emailAddress: 'jira@example.com',
              displayName: 'Jira User',
              self: 'https://jira.example/rest/api/3/user?accountId=1',
            },
          ]),
          { status: 200 },
        ),
      ),
    );

    const users = await fetchUsersFromIntegrationSource('JIRA', 'token', {
      cloudId: 'abc-cloud-123',
    });

    expect(users).toEqual([
      {
        email: 'jira@example.com',
        name: 'Jira User',
        source: 'JIRA',
        avatarUrl: undefined,
        metadata: { self: 'https://jira.example/rest/api/3/user?accountId=1' },
      },
    ]);
  });

  it('paginates Google Workspace directory users', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            users: [{ id: '1', primaryEmail: 'a@example.com', name: { fullName: 'A' } }],
            nextPageToken: 'page-2',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            users: [{ id: '2', primaryEmail: 'b@example.com' }],
          }),
          { status: 200 },
        ),
      );

    vi.stubGlobal('fetch', fetchMock);

    const users = await fetchUsersFromIntegrationSource('GOOGLE_WORKSPACE', 'token', null);

    expect(users).toHaveLength(2);
    expect(users[0]?.email).toBe('a@example.com');
    expect(users[1]?.name).toBe('b@example.com');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('pageToken=page-2');
  });

  it('maps Slack users and skips bots without email', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            members: [
              {
                id: 'U1',
                is_bot: false,
                profile: { email: 'user@example.com', real_name: 'User' },
              },
              { id: 'B1', is_bot: true, profile: {} },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const users = await fetchUsersFromIntegrationSource('SLACK', 'token', null);
    expect(users).toEqual([
      {
        email: 'user@example.com',
        name: 'User',
        source: 'SLACK',
        avatarUrl: undefined,
      },
    ]);
  });

  it('throws when Slack users.list returns ok=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false, members: [] }), { status: 200 }),
      ),
    );

    await expect(fetchUsersFromIntegrationSource('SLACK', 'token', null)).rejects.toThrow(
      'users.list returned ok=false',
    );
  });

  it('skips Linear users without email', async () => {
    linearGraphQLMock.mockResolvedValue({
      organization: {
        users: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            { id: '1', name: 'With Email', email: 'active@example.com', active: true },
            { id: '2', name: 'No Email', email: '', active: true },
            { id: '3', name: 'Whitespace', email: '   ', active: true },
            { id: '4', name: 'Inactive', email: 'inactive@example.com', active: false },
          ],
        },
      },
    });

    const users = await fetchUsersFromIntegrationSource('LINEAR', 'token', null);

    expect(users).toEqual([
      {
        email: 'active@example.com',
        name: 'With Email',
        source: 'LINEAR',
        avatarUrl: undefined,
        metadata: { linearId: '1' },
      },
    ]);
  });


  it('skips suspended and archived Google Workspace users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            users: [
              { id: '1', primaryEmail: 'active@example.com', suspended: false },
              { id: '2', primaryEmail: 'gone@example.com', suspended: true },
              { id: '3', primaryEmail: 'archived@example.com', archived: true },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const users = await fetchUsersFromIntegrationSource('GOOGLE_WORKSPACE', 'token', null);
    expect(users).toEqual([
      {
        email: 'active@example.com',
        name: 'active@example.com',
        source: 'GOOGLE_WORKSPACE',
        avatarUrl: undefined,
        metadata: { googleId: '1' },
      },
    ]);
  });

  it('skips Slack members with invalid email addresses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            members: [
              {
                id: 'U1',
                is_bot: false,
                profile: { email: 'not-an-email', real_name: 'Bad' },
              },
              {
                id: 'U2',
                is_bot: false,
                profile: { email: 'good@example.com', real_name: 'Good' },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const users = await fetchUsersFromIntegrationSource('SLACK', 'token', null);
    expect(users).toEqual([
      {
        email: 'good@example.com',
        name: 'Good',
        source: 'SLACK',
        avatarUrl: undefined,
      },
    ]);
  });
  it('throws when Google Workspace pagination exceeds max pages', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            users: [{ id: '1', primaryEmail: 'a@example.com' }],
            nextPageToken: 'next',
          }),
          { status: 200 },
        ),
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchUsersFromIntegrationSource('GOOGLE_WORKSPACE', 'token', null)).rejects.toThrow(
      'Exceeded maximum pagination limit (100 pages)',
    );
    expect(fetchMock).toHaveBeenCalledTimes(100);
  });
});
