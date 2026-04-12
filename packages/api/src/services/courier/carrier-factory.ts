import type { CourierClient } from "./courier-client.js";
import type { DPDClientConfig } from "./dpd-client.js";
import { DPDClient } from "./dpd-client.js";
import type { InPostClientConfig } from "./inpost-client.js";
import { InPostClient } from "./inpost-client.js";
import type { UPSClientConfig } from "./ups-client.js";
import { UPSClient } from "./ups-client.js";

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
    case "inpost":
      return new InPostClient(config as InPostClientConfig);
    case "dpd":
      return new DPDClient(config as DPDClientConfig);
    case "ups":
      return new UPSClient(config as UPSClientConfig);
    default:
      throw new Error(`[carrier-factory] Unknown carrier: ${carrier}`);
  }
}
