// ---------------------------------------------------------------------------
// UPS Status Mapper
//
// Maps UPS tracking type codes to the app's ShipmentStatus enum values.
// Unknown statuses return null and log a warning (never throw).
// ---------------------------------------------------------------------------

/**
 * Complete mapping of UPS tracking type codes to ShipmentStatus enum values.
 *
 * UPS uses single-letter (or two-letter) type codes in tracking responses.
 */
export const UPS_STATUS_MAP: Record<string, string> = {
  M: "CREATED", // Manifest/Billing info received
  P: "PICKED_UP", // Picked up
  I: "IN_TRANSIT", // In Transit
  O: "OUT_FOR_DELIVERY", // Out for delivery
  D: "DELIVERED", // Delivered
  X: "FAILED", // Exception
  RS: "RETURNED", // Returned to sender
};

/**
 * Map a raw UPS type code to the app's ShipmentStatus enum value.
 *
 * @param typeCode - The type code from UPS Tracking API response
 * @returns The mapped ShipmentStatus string, or null if the code is unknown
 */
export function mapUpsStatus(typeCode: string): string | null {
  const mapped = UPS_STATUS_MAP[typeCode];
  if (!mapped) {
    console.warn(
      `[ups-status-mapper] Unknown UPS status type code: "${typeCode}" — skipping`,
    );
    return null;
  }
  return mapped;
}

/**
 * Statuses that should trigger user notifications.
 * Intermediate statuses update silently; only terminal/critical events notify.
 */
export const UPS_NOTIFICATION_STATUSES = [
  "DELIVERED",
  "FAILED",
  "RETURNED",
] as const;
