import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStatusMapping, saveStatusMapping } from '../linear-status-mapping';

const ORG_ID = 'org-1';
const CONNECTION_ID = 'c1';
const TEAM_ID = 'team-1';

describe('linear-status-mapping', () => {
  const mockTx = {
    integrationConnection: {
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
    },
  };

  const prisma = {
    integrationConnection: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) =>
      fn(mockTx),
    );
  });

  it('getStatusMapping returns empty when connection missing', async () => {
    prisma.integrationConnection.findFirst.mockResolvedValue(null);
    const r = await getStatusMapping(prisma, ORG_ID, CONNECTION_ID, 'team-x');
    expect(r).toEqual([]);
  });

  it('getStatusMapping returns parsed entries when valid', async () => {
    prisma.integrationConnection.findFirst.mockResolvedValue({
      configJson: {
        statusMappings: {
          [TEAM_ID]: [
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
    const r = await getStatusMapping(prisma, ORG_ID, CONNECTION_ID, TEAM_ID);
    expect(r).toHaveLength(1);
    expect(r[0]?.linearStateId).toBe('s1');
  });

  it('getStatusMapping returns empty when schema invalid', async () => {
    prisma.integrationConnection.findFirst.mockResolvedValue({
      configJson: {
        statusMappings: { [TEAM_ID]: [{ bad: true }] },
      },
    });
    const r = await getStatusMapping(prisma, ORG_ID, CONNECTION_ID, TEAM_ID);
    expect(r).toEqual([]);
  });

  it('saveStatusMapping merges config and updates connection', async () => {
    mockTx.integrationConnection.findFirstOrThrow.mockResolvedValue({
      id: CONNECTION_ID,
      organizationId: ORG_ID,
      status: 'PENDING_MAPPING',
      configJson: {},
    });
    mockTx.integrationConnection.update.mockResolvedValue({});

    await saveStatusMapping(prisma, ORG_ID, CONNECTION_ID, TEAM_ID, [
      {
        workflowStatus: 'IN_PROGRESS',
        linearStateId: 's1',
        linearStateName: 'In Progress',
        linearStateType: 'started',
      },
    ]);

    expect(mockTx.integrationConnection.update).toHaveBeenCalled();
    const arg = mockTx.integrationConnection.update.mock.calls[0]?.[0];
    expect(arg.where.id).toBe(CONNECTION_ID);
    expect(arg.where.organizationId).toBe(ORG_ID);
    expect(arg.data.status).toBe('CONNECTED');
  });
});
