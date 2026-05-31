// Phase 77 D-14 — resolve the decrypted token a Deprovisionable adapter needs.
//
// GWS  → the org's CONNECTED GOOGLE_WORKSPACE IntegrationConnection token.
// Slack→ the org's SLACK_ORG_GRID connection (marked via configJson.connectionSubKind),
//        NOT the workspace Slack bot token (D-14 / T-77-03-01).

import type { PrismaClient } from '@contractor-ops/db';
import { decryptCredentials } from '@contractor-ops/integrations';

export type DeprovisionProvider = 'GOOGLE_WORKSPACE' | 'SLACK';

export type ResolveTokenResult =
  | { ok: true; accessToken: string; connectionId: string }
  | { ok: false; reason: string };

const PROVIDER_SLUG: Record<DeprovisionProvider, string> = {
  GOOGLE_WORKSPACE: 'google_workspace',
  SLACK: 'slack',
};

/** True when an IntegrationConnection.configJson marks it as the Slack org-grid kind. */
export function isSlackOrgGridConnection(configJson: unknown): boolean {
  return (
    !!configJson &&
    typeof configJson === 'object' &&
    (configJson as { connectionSubKind?: unknown }).connectionSubKind === 'SLACK_ORG_GRID'
  );
}

export async function resolveDeprovisionToken(
  db: PrismaClient,
  organizationId: string,
  provider: DeprovisionProvider,
): Promise<ResolveTokenResult> {
  const connections = await db.integrationConnection.findMany({
    where: { organizationId, provider, status: 'CONNECTED' },
    select: { id: true, credentialsRef: true, configJson: true },
  });

  const connection =
    provider === 'SLACK'
      ? connections.find(c => isSlackOrgGridConnection(c.configJson))
      : connections[0];

  if (!connection) {
    return {
      ok: false,
      reason: provider === 'SLACK' ? 'slack_org_grid_not_connected' : 'not_connected',
    };
  }

  try {
    const credentials = decryptCredentials(connection.credentialsRef, PROVIDER_SLUG[provider]);
    return { ok: true, accessToken: credentials.accessToken, connectionId: connection.id };
  } catch {
    return { ok: false, reason: 'credential_decrypt_failed' };
  }
}
