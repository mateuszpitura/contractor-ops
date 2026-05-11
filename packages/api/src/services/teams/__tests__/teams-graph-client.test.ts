import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: vi.fn(() => ({
      api: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        get: mockGet,
      })),
    })),
  },
}));

import { getJoinedTeams, getTeamsChannels } from '../teams-graph-client';

describe('teams-graph-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      value: [{ id: 't1', displayName: 'Team One' }],
    });
  });

  it('getJoinedTeams returns value array from Graph', async () => {
    const teams = await getJoinedTeams('token');
    expect(teams).toEqual([{ id: 't1', displayName: 'Team One' }]);
  });

  it('getTeamsChannels requests team channels', async () => {
    mockGet.mockResolvedValue({
      value: [{ id: 'c1', displayName: 'General' }],
    });
    const ch = await getTeamsChannels('token', 'team-99');
    expect(ch).toEqual([{ id: 'c1', displayName: 'General' }]);
  });
});
