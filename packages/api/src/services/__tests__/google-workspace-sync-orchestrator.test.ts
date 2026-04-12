import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockFindUniqueOrThrow = vi.fn();
const mockUpdate = vi.fn();
const mockSyncLogUpdate = vi.fn();

vi.mock('@contractor-ops/db', () => ({
  prisma: {
    integrationSyncLog: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockSyncLogUpdate(...args),
    },
    integrationConnection: {
      findUniqueOrThrow: (...args: unknown[]) => mockFindUniqueOrThrow(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
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
