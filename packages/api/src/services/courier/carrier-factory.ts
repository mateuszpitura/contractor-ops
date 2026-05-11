import { TRPCError } from '@trpc/server';
import type { TenantScopedDb } from '../../lib/tenant-db';
import type { CourierClient } from './courier-client';
import type { DPDClientConfig } from './dpd-client';
import { DPDClient } from './dpd-client';
import type { InPostClientConfig } from './inpost-client';
import { InPostClient } from './inpost-client';
import type { UPSClientConfig } from './ups-client';
import { UPSClient } from './ups-client';

/** Carrier identifiers persisted in `CourierConfig.carrier` (lower-case). */
export type CarrierId = 'inpost' | 'dpd' | 'ups';

// ---------------------------------------------------------------------------
// Carrier Factory
//
// Creates the correct CourierClient instance based on carrier string.
// Used by polling services and shipment creation endpoints.
// ---------------------------------------------------------------------------

/**
 * Get the appropriate courier client for a given carrier.
 *
 * @param carrier - The carrier identifier (case-insensitive)
 * @param config - Carrier-specific configuration object
 * @returns A CourierClient instance
 * @throws Error if the carrier is unknown
 */
export function getCourierClient(carrier: string, config: unknown): CourierClient {
  switch (carrier.toLowerCase()) {
    case 'inpost':
      return new InPostClient(config as InPostClientConfig);
    case 'dpd':
      return new DPDClient(config as DPDClientConfig);
    case 'ups':
      return new UPSClient(config as UPSClientConfig);
    default:
      throw new Error(`[carrier-factory] Unknown carrier: ${carrier}`);
  }
}

/**
 * Load and instantiate a courier client for an organization.
 *
 * Centralizes the load + null-check + JSON cast + factory dispatch pattern that
 * was previously inlined across equipment + portal routers. Throws a tRPC
 * NOT_FOUND error if the org has no `CourierConfig` row for the given carrier.
 */
export async function loadCourierClient(
  db: Pick<TenantScopedDb, 'courierConfig'>,
  organizationId: string,
  carrier: CarrierId,
): Promise<CourierClient> {
  const courierConfig = await db.courierConfig.findUnique({
    where: { organizationId_carrier: { organizationId, carrier } },
  });

  if (!courierConfig) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'COURIER_CONFIG_NOT_FOUND',
    });
  }

  return getCourierClient(carrier, courierConfig.configJson);
}
