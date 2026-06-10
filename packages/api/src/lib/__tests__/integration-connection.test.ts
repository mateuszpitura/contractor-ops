import { TRPCError } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';
import * as E from '../../errors.js';
import {
  loadIntegrationConnection,
  loadOrgIntegrationConnection,
} from '../integration-connection.js';

function mockDb(connection: unknown) {
  return {
    integrationConnection: {
      findFirst: vi.fn().mockResolvedValue(connection),
    },
  };
}

describe('loadOrgIntegrationConnection', () => {
  it('defaults status filter to CONNECTED', async () => {
    const db = mockDb({ id: 'conn-1', status: 'CONNECTED' });

    await loadOrgIntegrationConnection(db as never, 'org-1', 'LINEAR');

    expect(db.integrationConnection.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        provider: 'LINEAR',
        status: 'CONNECTED',
      },
    });
  });

  it('supports array status filter', async () => {
    const db = mockDb({ id: 'conn-1', status: 'PENDING_MAPPING' });

    await loadOrgIntegrationConnection(db as never, 'org-1', 'LINEAR', {
      status: ['PENDING_MAPPING', 'CONNECTED'],
    });

    expect(db.integrationConnection.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        provider: 'LINEAR',
        status: { in: ['PENDING_MAPPING', 'CONNECTED'] },
      },
    });
  });

  it('throws NOT_FOUND with default message when missing', async () => {
    const db = mockDb(null);

    await expect(
      loadOrgIntegrationConnection(db as never, 'org-1', 'MICROSOFT_TEAMS'),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('NOT_FOUND');
      expect((error as TRPCError).message).toBe(E.INTEGRATION_NOT_FOUND);
      return true;
    });
  });

  it('uses custom notFoundMessage', async () => {
    const db = mockDb(null);

    await expect(
      loadOrgIntegrationConnection(db as never, 'org-1', 'GOOGLE_WORKSPACE', {
        notFoundMessage: 'googleWorkspaceNotConnected',
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect((error as TRPCError).message).toBe('googleWorkspaceNotConnected');
      return true;
    });
  });

  it('skips status filter when status is any', async () => {
    const db = mockDb({ id: 'conn-1', status: 'DISCONNECTED' });

    await loadOrgIntegrationConnection(db as never, 'org-1', 'PEPPOL', { status: 'any' });

    expect(db.integrationConnection.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        provider: 'PEPPOL',
      },
    });
  });

  it('returns null when optional and missing', async () => {
    const db = mockDb(null);

    const result = await loadOrgIntegrationConnection(db as never, 'org-1', 'KSEF', {
      status: 'any',
      optional: true,
    });

    expect(result).toBeNull();
  });
});

describe('loadIntegrationConnection', () => {
  it('rejects non-CONNECTED connections by default', async () => {
    const db = mockDb({ id: 'conn-1', status: 'DISCONNECTED' });

    await expect(
      loadIntegrationConnection(db as never, 'conn-1', 'org-1', { provider: 'JIRA' }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('PRECONDITION_FAILED');
      expect((error as TRPCError).message).toBe(E.INTEGRATION_NOT_CONNECTED);
      return true;
    });
  });

  it('allows any status when requireConnected is false', async () => {
    const connection = { id: 'conn-1', status: 'DISCONNECTED' };
    const db = mockDb(connection);

    const result = await loadIntegrationConnection(db as never, 'conn-1', 'org-1', {
      provider: 'JIRA',
      requireConnected: false,
      notFoundMessage: E.INTEGRATION_NOT_FOUND,
    });

    expect(result).toBe(connection);
  });
});
