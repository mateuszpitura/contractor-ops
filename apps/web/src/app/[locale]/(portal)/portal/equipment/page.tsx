"use client";

import { PortalEquipmentTab } from "@/components/portal/portal-equipment-tab";

// ---------------------------------------------------------------------------
// Portal Equipment Page
// ---------------------------------------------------------------------------

/**
 * Portal equipment route page at /portal/equipment.
 * Renders the PortalEquipmentTab component which lists assigned equipment
 * and provides the return flow.
 */
export default function PortalEquipmentPage() {
  return <PortalEquipmentTab />;
}
