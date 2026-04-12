// ---------------------------------------------------------------------------
// InPost ShipX Status Mapper
//
// Maps granular ShipX statuses to the app's ShipmentStatus enum values.
// Unknown statuses return null and log a warning (never throw).
// ---------------------------------------------------------------------------

/**
 * Complete mapping of ShipX status strings to ShipmentStatus enum values.
 *
 * ShipX uses granular carrier-specific statuses that don't map 1:1 to our
 * simplified enum. Multiple ShipX statuses can map to the same ShipmentStatus.
 */
export const INPOST_STATUS_MAP: Record<string, string> = {
  created: "CREATED",
  offers_prepared: "CREATED",
  offer_selected: "CREATED",
  confirmed: "LABEL_GENERATED",
  dispatched_by_sender: "PICKED_UP",
  collected_from_sender: "PICKED_UP",
  taken_by_courier: "PICKED_UP",
  adopted_at_source_branch: "IN_TRANSIT",
  sent_from_source_branch: "IN_TRANSIT",
  out_for_delivery: "OUT_FOR_DELIVERY",
  ready_to_pickup: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED",
  picked_up_by_receiver: "DELIVERED",
  avizo: "OUT_FOR_DELIVERY",
  claimed: "FAILED",
  returned_to_sender: "RETURNED",
  not_delivered: "FAILED",
};

/**
 * Map a raw ShipX status string to the app's ShipmentStatus enum value.
 *
 * @param rawStatus - The status string from ShipX API or webhook payload
 * @returns The mapped ShipmentStatus string, or null if the status is unknown
 */
export function mapInPostStatus(rawStatus: string): string | null {
  const mapped = INPOST_STATUS_MAP[rawStatus];
  if (!mapped) {
    console.warn(`[inpost-status-mapper] Unknown ShipX status: "${rawStatus}" — skipping`);
    return null;
  }
  return mapped;
}

/**
 * Statuses that should trigger user notifications (per D-06).
 * Intermediate statuses update silently; only terminal/critical events notify.
 */
export const NOTIFICATION_STATUSES = ["DELIVERED", "FAILED", "RETURNED"] as const;
