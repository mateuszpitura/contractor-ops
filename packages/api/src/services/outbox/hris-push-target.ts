// Resolve the outbound HRIS push target for an org + worker.
//
// The outbox drain runs OUTSIDE any tenant context, so this queries the raw
// prisma client with an explicit organizationId filter (never trusting ambient
// tenant scope) and joins the CO workerId → HRIS externalId via ExternalLink.
// Returning null means "no connected HRIS / not linked" → the push handler
// no-ops (not an error).

import type { DataRegion } from '@contractor-ops/db';
import { prisma } from '@contractor-ops/db';
import type { CredentialBlob, HrisProvider } from '@contractor-ops/integrations';
import { decryptCredentials } from '@contractor-ops/integrations';

export interface HrisPushTarget {
  provider: HrisProvider;
  region: DataRegion;
  creds: CredentialBlob;
  /** The HRIS-side person id for this worker, if linked; undefined = not linked. */
  externalId?: string;
}

function providerSlug(provider: HrisProvider): 'personio' | 'bamboohr' {
  return provider === 'PERSONIO' ? 'personio' : 'bamboohr';
}

/**
 * Resolve the org's connected HRIS + decrypted credentials + the worker's
 * HRIS externalId. Returns null when no HRIS is connected for the org.
 */
export async function resolveHrisPushTarget(
  organizationId: string,
  workerId: string,
): Promise<HrisPushTarget | null> {
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      organizationId,
      status: 'CONNECTED',
      provider: { in: ['PERSONIO', 'BAMBOOHR'] },
    },
    select: {
      id: true,
      provider: true,
      credentialsRef: true,
      organization: { select: { dataRegion: true } },
    },
  });
  if (!connection) return null;

  const provider = connection.provider as HrisProvider;
  const link = await prisma.externalLink.findFirst({
    where: {
      organizationId,
      integrationConnectionId: connection.id,
      entityId: workerId,
      entityType: { in: ['WORKER', 'EMPLOYEE'] },
    },
    select: { externalId: true },
  });

  return {
    provider,
    region: connection.organization.dataRegion ?? 'EU',
    creds: decryptCredentials(connection.credentialsRef, providerSlug(provider)),
    externalId: link?.externalId,
  };
}
