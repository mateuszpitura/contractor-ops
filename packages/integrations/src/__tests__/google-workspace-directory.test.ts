import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleWorkspaceAdapter } from '../adapters/google-workspace-adapter.js';

function mockFetchSequential(
  responses: Array<{
    ok: boolean;
    status: number;
    body: unknown;
  }>,
) {
  const fn = vi.fn();
  let i = 0;
  fn.mockImplementation(() => {
    const r = responses[i];
    if (!r) {
      throw new Error(`mockFetchSequential: no response at index ${i}`);
    }
    i += 1;
    return Promise.resolve({
      ok: r.ok,
      status: r.status,
      text: () => Promise.resolve(typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
      json: () => Promise.resolve(r.body),
    });
  });
  return fn;
}

describe('GoogleWorkspaceAdapter — Directory API', () => {
  let adapter: GoogleWorkspaceAdapter;

  beforeEach(() => {
    adapter = new GoogleWorkspaceAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('listAllDirectoryUsers', () => {
    it('follows nextPageToken across pages', async () => {
      const fetchMock = mockFetchSequential([
        {
          ok: true,
          status: 200,
          body: {
            users: [
              {
                id: '1',
                primaryEmail: 'a@example.com',
                name: { givenName: 'A', familyName: 'One', fullName: 'A One' },
                suspended: false,
              },
            ],
            nextPageToken: 'page2',
          },
        },
        {
          ok: true,
          status: 200,
          body: {
            users: [
              {
                id: '2',
                primaryEmail: 'b@example.com',
                name: { givenName: 'B', familyName: 'Two', fullName: 'B Two' },
                suspended: false,
              },
            ],
          },
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      const users = await adapter.listAllDirectoryUsers('token');

      expect(users).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const firstUrl = fetchMock.mock.calls[0]?.[0] as string;
      const secondUrl = fetchMock.mock.calls[1]?.[0] as string;
      expect(firstUrl).not.toMatch(/pageToken=/);
      expect(secondUrl).toContain('pageToken=page2');
    });

    it('filters out suspended users', async () => {
      const fetchMock = mockFetchSequential([
        {
          ok: true,
          status: 200,
          body: {
            users: [
              {
                id: '1',
                primaryEmail: 'active@example.com',
                name: { givenName: 'A', familyName: 'A', fullName: 'A A' },
                suspended: false,
              },
              {
                id: '2',
                primaryEmail: 'gone@example.com',
                name: { givenName: 'G', familyName: 'G', fullName: 'G G' },
                suspended: true,
              },
            ],
          },
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      const users = await adapter.listAllDirectoryUsers('token');
      expect(users).toHaveLength(1);
      expect(users[0]?.primaryEmail).toBe('active@example.com');
    });

    it('preserves organizations including primary department for consumers', async () => {
      const fetchMock = mockFetchSequential([
        {
          ok: true,
          status: 200,
          body: {
            users: [
              {
                id: '1',
                primaryEmail: 'dev@example.com',
                name: { givenName: 'D', familyName: 'V', fullName: 'D V' },
                suspended: false,
                organizations: [{ department: 'Engineering', primary: true, title: 'IC' }],
              },
            ],
          },
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      const users = await adapter.listAllDirectoryUsers('token');
      expect(users[0]?.organizations?.[0]?.department).toBe('Engineering');
      expect(users[0]?.organizations?.[0]?.primary).toBe(true);
    });

    it('returns empty array when directory has no users', async () => {
      const fetchMock = mockFetchSequential([{ ok: true, status: 200, body: {} }]);
      vi.stubGlobal('fetch', fetchMock);

      const users = await adapter.listAllDirectoryUsers('token');
      expect(users).toEqual([]);
    });

    it('throws on 403 with status in message', async () => {
      const fetchMock = mockFetchSequential([
        { ok: false, status: 403, body: { error: 'Forbidden' } },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      await expect(adapter.listAllDirectoryUsers('token')).rejects.toThrow(
        /Google Workspace Directory API failed \(403\)/,
      );
    });

    it('throws on other non-ok responses with status code', async () => {
      const fetchMock = mockFetchSequential([{ ok: false, status: 500, body: 'Internal' }]);
      vi.stubGlobal('fetch', fetchMock);

      await expect(adapter.listAllDirectoryUsers('token')).rejects.toThrow(/\(500\)/);
    });
  });

  describe('listUserGroups', () => {
    it('fetches groups for userKey and returns mapped groups', async () => {
      const fetchMock = mockFetchSequential([
        {
          ok: true,
          status: 200,
          body: {
            groups: [
              {
                id: 'g1',
                email: 'team@example.com',
                name: 'Team',
              },
            ],
          },
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      const groups = await adapter.listUserGroups('token', 'user@example.com');
      expect(groups).toHaveLength(1);
      expect(groups[0]?.email).toBe('team@example.com');
      const url = fetchMock.mock.calls[0]?.[0] as string;
      expect(url).toContain('userKey=user%40example.com');
    });

    it('paginates through multiple pages of groups', async () => {
      const fetchMock = mockFetchSequential([
        {
          ok: true,
          status: 200,
          body: {
            groups: [{ id: 'g1', email: 'a@x.com', name: 'A' }],
            nextPageToken: 'tok2',
          },
        },
        {
          ok: true,
          status: 200,
          body: {
            groups: [{ id: 'g2', email: 'b@x.com', name: 'B' }],
          },
        },
      ]);
      vi.stubGlobal('fetch', fetchMock);

      const groups = await adapter.listUserGroups('token', 'u@example.com');
      expect(groups).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns empty array on 404', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal('fetch', fetchMock);

      const groups = await adapter.listUserGroups('token', 'nobody@example.com');
      expect(groups).toEqual([]);
    });

    it('throws on non-ok response other than 404', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('unavailable'),
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal('fetch', fetchMock);

      await expect(adapter.listUserGroups('token', 'u@example.com')).rejects.toThrow(
        /Google Workspace Groups API failed \(503\)/,
      );
    });
  });
});
