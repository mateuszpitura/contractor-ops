import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate, mockFindUniqueOrThrow, mockUpdate, mockSyncLogUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindUniqueOrThrow: vi.fn(),
  mockUpdate: vi.fn(),
  mockSyncLogUpdate: vi.fn(),
}));

vi.mock('@contractor-ops/db', () => ({
  withRlsTransactions: <T,>(c: T) => c,
  withRlsReads: <T,>(c: T) => c,
  prisma: {
    integrationSyncLog: {
      create: mockCreate,
      update: mockSyncLogUpdate,
    },
    integrationConnection: {
      findUniqueOrThrow: mockFindUniqueOrThrow,
      update: mockUpdate,
    },
    // Raw SQL hooks: tenant scoping (search_path) + advisory lock acquire/release.
    $queryRawUnsafe: vi.fn(async () => [{ acquired: true }]),
    $executeRawUnsafe: vi.fn(async () => 0),
  },
}));

import { processDirectorySync } from '../google-workspace-sync-orchestrator.js';

describe('processDirectorySync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ id: 'log-1' });
    mockSyncLogUpdate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
  });

  it('throws when connection belongs to another organization', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'conn-1',
      organizationId: 'other-org',
      status: 'CONNECTED',
    });

    await expect(
      processDirectorySync({
        organizationId: 'org-1',
        connectionId: 'conn-1',
      }),
    ).rejects.toThrow(/does not belong/);
  });

  it('throws when connection is not CONNECTED', async () => {
    mockFindUniqueOrThrow.mockResolvedValue({
      id: 'conn-1',
      organizationId: 'org-1',
      status: 'ERROR',
    });

    await expect(
      processDirectorySync({
        organizationId: 'org-1',
        connectionId: 'conn-1',
      }),
    ).rejects.toThrow(/not active/);
  });
});
