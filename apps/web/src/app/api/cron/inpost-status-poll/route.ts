import { pollDpdShipmentStatuses } from "@contractor-ops/api/services/courier/dpd-polling-service";
import { pollInPostShipmentStatuses } from "@contractor-ops/api/services/courier/inpost-polling-service";
import { pollUpsShipmentStatuses } from "@contractor-ops/api/services/courier/ups-polling-service";
import { prisma } from "@contractor-ops/db";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// POST /api/cron/inpost-status-poll
//
// QStash-scheduled polling endpoint for courier shipment status updates.
// Polls active shipments hourly across all carriers (InPost, DPD, UPS)
// as a fallback for missed webhooks.
// ---------------------------------------------------------------------------

interface CarrierResult {
  carrier: string;
  checked: number;
  updated: number;
}

interface OrgResult {
  organizationId: string;
  carriers: CarrierResult[];
}

/**
 * Poll active shipments for status updates across all carriers.
 *
 * If body contains `organizationId`, polls that org only.
 * Otherwise, polls ALL orgs with any CourierConfig.
 *
 * Each carrier is polled independently -- one carrier failure does not
 * prevent polling other carriers (fire-and-forget resilience per D-07).
 *
 * Protected by QStash signature verification.
 */
async function handler(request: NextRequest) {
  let body: { organizationId?: string } = {};

  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // Empty body is OK -- we'll poll all orgs
  }

  const results: OrgResult[] = [];

  if (body.organizationId) {
    // Poll a specific org across all carriers
    const orgResult = await pollAllCarriersForOrg(body.organizationId);
    results.push(orgResult);
  } else {
    // Poll ALL orgs with any courier config
    const configs = await prisma.courierConfig.findMany({
      select: { organizationId: true },
      distinct: ["organizationId"],
    });

    for (const config of configs) {
      const orgResult = await pollAllCarriersForOrg(config.organizationId);
      results.push(orgResult);
    }
  }

  const totalChecked = results.reduce(
    (sum, r) => sum + r.carriers.reduce((s, c) => s + c.checked, 0),
    0,
  );
  const totalUpdated = results.reduce(
    (sum, r) => sum + r.carriers.reduce((s, c) => s + c.updated, 0),
    0,
  );

  console.info(
    `[courier-status-poll] Completed: ${results.length} org(s), ${totalChecked} checked, ${totalUpdated} updated`,
  );

  return NextResponse.json({ results });
}

/**
 * Poll all three carriers for a single organization.
 * Each carrier is wrapped in independent try/catch for resilience.
 */
async function pollAllCarriersForOrg(organizationId: string): Promise<OrgResult> {
  const carriers: CarrierResult[] = [];

  // Poll InPost shipments
  const inpostResult = await pollInPostShipmentStatuses(prisma, organizationId).catch((err) => {
    console.error(`[courier-status-poll] InPost error for org ${organizationId}:`, err);
    return { checked: 0, updated: 0 };
  });
  carriers.push({ carrier: "inpost", ...inpostResult });

  // Poll DPD shipments
  const dpdResult = await pollDpdShipmentStatuses(prisma, organizationId).catch((err) => {
    console.error(`[courier-status-poll] DPD error for org ${organizationId}:`, err);
    return { checked: 0, updated: 0 };
  });
  carriers.push({ carrier: "dpd", ...dpdResult });

  // Poll UPS shipments
  const upsResult = await pollUpsShipmentStatuses(prisma, organizationId).catch((err) => {
    console.error(`[courier-status-poll] UPS error for org ${organizationId}:`, err);
    return { checked: 0, updated: 0 };
  });
  carriers.push({ carrier: "ups", ...upsResult });

  return { organizationId, carriers };
}

export const POST = verifySignatureAppRouter(handler);
