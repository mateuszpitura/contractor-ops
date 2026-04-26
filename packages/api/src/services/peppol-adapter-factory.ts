// packages/api/src/services/peppol-adapter-factory.ts
//
// Phase 61 · Plan 61-05 — thin factory for the Storecove adapter instance
// consumed by the `peppol.lookupCapabilities` / `einvoice.send` paths.
//
// Scope:
// - Pulls the Storecove base URL from a fixed, pinned literal per
//   `environment` (SSRF-safety per threat T-61-05-07 — URL never derives
//   from user input).
// - API key is resolved via the existing per-org encrypted credential blob
//   that the `peppol.connect` mutation stored through
//   `IntegrationConnection.credentialsRef`.
// - Returns `null` when the org has no Peppol credential on file. Callers
//   should translate that to the UI error `PEPPOL_PARTICIPANT_NOT_ACTIVE`.
//
// Tests mock this module so the router can be exercised without running
// real Storecove HTTP calls.

import type { PrismaClient } from '@contractor-ops/db';
import { StorecoveAdapter } from '@contractor-ops/einvoice';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';

const STORECOVE_SANDBOX_BASE_URL = 'https://api-sandbox.storecove.com/api/v2';
const STORECOVE_PRODUCTION_BASE_URL = 'https://api.storecove.com/api/v2';

/**
 * Build a `StorecoveAdapter` for the given org from the credential the
 * `peppol.connect` mutation stored. Returns `null` if the org has no Peppol
 * IntegrationConnection or the connection is not CONNECTED.
 *
 * SSRF-safety: the base URL is one of two pinned literal strings, selected
 * by the credential blob's `environment` field (validated via Zod upstream
 * in `connectPeppolSchema`). No user input can influence the URL path.
 */
export async function buildStorecoveAdapterForOrg(
  db: PrismaClient,
  organizationId: string,
): Promise<StorecoveAdapter | null> {
  const connection = await db.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: 'PEPPOL',
      status: 'CONNECTED',
    },
    select: { credentialsRef: true, configJson: true },
  });
  if (!connection?.credentialsRef) return null;

  const blob = decryptCredentials(connection.credentialsRef, 'peppol');
  const apiKey = blob.accessToken;
  if (!apiKey) return null;

  const configJson = (connection.configJson as Record<string, unknown> | null) ?? {};
  const configEnv = configJson.environment;
  const blobEnv = (blob.extra as Record<string, unknown> | undefined)?.environment;
  const env = configEnv === 'production' || blobEnv === 'production' ? 'production' : 'sandbox';

  const baseUrl = env === 'production' ? STORECOVE_PRODUCTION_BASE_URL : STORECOVE_SANDBOX_BASE_URL;

  return new StorecoveAdapter({
    apiKey,
    baseUrl,
  });
}
