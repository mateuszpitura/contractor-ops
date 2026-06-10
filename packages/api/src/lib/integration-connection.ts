import type {
  IntegrationConnection,
  IntegrationProvider,
  IntegrationStatus,
} from '@contractor-ops/db/generated/prisma/client';
import { TRPCError } from '@trpc/server';
import * as E from '../errors.js';
import type { TenantScopedDb } from './tenant-db.js';

export type IntegrationProviderSlug = IntegrationProvider;
export type IntegrationConnectionStatus = IntegrationStatus;

/**
 * Loads a tenant-scoped integration connection and validates CONNECTED status.
 */
export async function loadIntegrationConnection(
  db: TenantScopedDb,
  connectionId: string,
  organizationId: string,
  options?: {
    provider?: IntegrationProviderSlug;
    requireConnected?: boolean;
    notFoundMessage?: string;
  },
) {
  const connection = await db.integrationConnection.findFirst({
    where: {
      id: connectionId,
      organizationId,
      ...(options?.provider !== undefined ? { provider: options.provider } : {}),
    },
  });

  const notFoundMessage = options?.notFoundMessage ?? E.INTEGRATION_NOT_CONNECTED;

  if (!connection) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: notFoundMessage,
    });
  }

  const requireConnected = options?.requireConnected ?? true;
  if (requireConnected && connection.status !== 'CONNECTED') {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.INTEGRATION_NOT_CONNECTED,
    });
  }

  return connection;
}

/**
 * Loads the org's integration connection for a provider, filtered by status.
 */
type OrgIntegrationConnectionStatusFilter =
  | IntegrationConnectionStatus
  | IntegrationConnectionStatus[]
  | 'any';

function orgIntegrationStatusWhere(
  statusFilter: OrgIntegrationConnectionStatusFilter,
): { status: IntegrationConnectionStatus | { in: IntegrationConnectionStatus[] } } | undefined {
  if (statusFilter === 'any') {
    return undefined;
  }

  return {
    status: Array.isArray(statusFilter) ? { in: statusFilter } : statusFilter,
  };
}

export async function loadOrgIntegrationConnection(
  db: TenantScopedDb,
  organizationId: string,
  provider: IntegrationProviderSlug,
  options?: {
    status?: OrgIntegrationConnectionStatusFilter;
    notFoundMessage?: string;
    optional?: false;
  },
): Promise<IntegrationConnection>;
export async function loadOrgIntegrationConnection(
  db: TenantScopedDb,
  organizationId: string,
  provider: IntegrationProviderSlug,
  options: {
    status?: OrgIntegrationConnectionStatusFilter;
    notFoundMessage?: string;
    optional: true;
  },
): Promise<IntegrationConnection | null>;
export async function loadOrgIntegrationConnection(
  db: TenantScopedDb,
  organizationId: string,
  provider: IntegrationProviderSlug,
  options?: {
    status?: OrgIntegrationConnectionStatusFilter;
    notFoundMessage?: string;
    optional?: boolean;
  },
): Promise<IntegrationConnection | null> {
  const statusFilter = options?.status ?? 'CONNECTED';
  const statusWhere = orgIntegrationStatusWhere(statusFilter);

  const connection = await db.integrationConnection.findFirst({
    where: {
      organizationId,
      provider,
      ...statusWhere,
    },
  });

  if (!connection) {
    if (options?.optional) {
      return null;
    }

    throw new TRPCError({
      code: 'NOT_FOUND',
      message: options?.notFoundMessage ?? E.INTEGRATION_NOT_FOUND,
    });
  }

  return connection;
}
