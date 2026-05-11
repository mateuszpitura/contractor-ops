import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStatusMapping, saveStatusMapping } from '../linear-status-mapping';

describe('linear-status-mapping', () => {
  const mockFindUnique = vi.fn();
  const mockFindUniqueOrThrow = vi.fn();
  const mockUpdate = vi.fn();

  const prisma = {
    integrationConnection: {
      findUnique: mockFindUnique,
      findUniqueOrThrow: mockFindUniqueOrThrow,
      update: mockUpdate,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getStatusMapping returns empty when connection missing', async () => {
    mockFindUnique.mockResolvedValue(null);
    const r = await getStatusMapping(prisma as never, 'c1', 'team-x');
    expect(r).toEqual([]);
  });

  it('getStatusMapping returns parsed entries when valid', async () => {
    mockFindUnique.mockResolvedValue({
      configJson: {
        statusMappings: {
          'team-1': [
            {
              workflowStatus: 'DONE',
              linearStateId: 's1',
              linearStateName: 'Done',
              linearStateType: 'completed',
            },
          ],
        },
      },
    });
    const r = await getStatusMapping(prisma as never, 'c1', 'team-1');
    expect(r).toHaveLength(1);
    expect(r[0]?.linearStateId).toBe('s1');
  });

  it('getStatusMapping returns empty when schema invalid', async () => {
    mockFindUnique.mockResolvedValue({
      configJson: {
        statusMappings: { 'team-1': [{ bad: true }] },
      },
    });
    const r = await getStatusMapping(prisma as never, 'c1', 'team-1');
    expect(r).toEqual([]);
  });

  it('saveStatusMapping merges config and updates connection', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'c1',
      organizationId: 'org-1',
      status: 'PENDING_MAPPING',
      configJson: {},
    });
    mockUpdate.mockResolvedValue({});

    await saveStatusMapping(prisma as never, 'c1', 'team-1', [
      {
        workflowStatus: 'IN_PROGRESS',
        linearStateId: 's1',
        linearStateName: 'In Progress',
        linearStateType: 'started',
      },
    ]);

    expect(mockUpdate).toHaveBeenCalled();
    const arg = mockUpdate.mock.calls[0]?.[0];
    expect(arg.where.id).toBe('c1');
    expect(arg.data.status).toBe('CONNECTED');
  });
});
