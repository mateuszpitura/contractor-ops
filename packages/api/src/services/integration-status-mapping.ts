import type { Prisma } from '@contractor-ops/db';
import type { DbClient } from './types.js';

type PrismaClient = DbClient;

interface ConnectionConfigJson<TEntry = unknown> {
  statusMappings?: Record<string, TEntry[]>;
  [key: string]: unknown;
}

/**
 * Generic status-mapping persistence in IntegrationConnection.configJson.
 * Used by Jira (projectId) and Linear (teamId) with provider-specific entry types.
 */
export async function saveIntegrationStatusMapping<TEntry>(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  scopeKey: string,
  mappings: TEntry[],
  options?: {
    mergeConfig?: (
      existing: ConnectionConfigJson<TEntry>,
      statusMappings: Record<string, TEntry[]>,
    ) => ConnectionConfigJson<TEntry>;
    transitionOnSave?: (connection: { status: string }) => Record<string, unknown>;
  },
): Promise<void> {
  await prisma.$transaction(async tx => {
    const connection = await tx.integrationConnection.findFirstOrThrow({
      where: { id: connectionId, organizationId },
    });

    const existingConfig = (connection.configJson as ConnectionConfigJson<TEntry>) ?? {};
    const statusMappings = {
      ...(existingConfig.statusMappings ?? {}),
      [scopeKey]: mappings,
    };

    const updatedConfig = options?.mergeConfig
      ? options.mergeConfig(existingConfig, statusMappings as Record<string, TEntry[]>)
      : { ...existingConfig, statusMappings };

    await tx.integrationConnection.update({
      where: { id: connectionId, organizationId },
      data: {
        configJson: updatedConfig as Prisma.InputJsonValue,
        ...(options?.transitionOnSave?.(connection) ?? {}),
      },
    });
  });
}

export async function getIntegrationStatusMapping<TEntry>(
  prisma: PrismaClient,
  organizationId: string,
  connectionId: string,
  scopeKey: string,
): Promise<TEntry[] | null> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, organizationId },
    select: { configJson: true },
  });

  const config = (connection?.configJson ?? {}) as ConnectionConfigJson<TEntry>;
  const mappings = config.statusMappings?.[scopeKey];

  return (mappings as TEntry[] | undefined) ?? null;
}
