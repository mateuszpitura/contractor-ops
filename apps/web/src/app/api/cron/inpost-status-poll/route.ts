import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { prisma } from "@contractor-ops/db";
import { pollInPostShipmentStatuses } from "@contractor-ops/api/services/courier/inpost-polling-service";

// ---------------------------------------------------------------------------
// POST /api/cron/inpost-status-poll
//
// QStash-scheduled polling endpoint for InPost shipment status updates.
// Polls active InPost shipments hourly as a fallback for missed webhooks.
// ---------------------------------------------------------------------------

/**
 * Poll active InPost shipments for status updates.
 *
 * If body contains `organizationId`, polls that org only.
 * Otherwise, polls ALL orgs with an InPost CourierConfig.
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
    // Empty body is OK — we'll poll all orgs
  }

  const results: Array<{
    organizationId: string;
    checked: number;
    updated: number;
  }> = [];

  if (body.organizationId) {
    // Poll a specific org
    const result = await pollInPostShipmentStatuses(
      prisma,
      body.organizationId,
    );
    results.push({
      organizationId: body.organizationId,
      ...result,
    });
  } else {
    // Poll ALL orgs with InPost config
    const configs = await prisma.courierConfig.findMany({
      where: { carrier: "inpost" },
      select: { organizationId: true },
    });

    for (const config of configs) {
      try {
        const result = await pollInPostShipmentStatuses(
          prisma,
          config.organizationId,
        );
        results.push({
          organizationId: config.organizationId,
          ...result,
        });
      } catch (error) {
        console.error(
          `[inpost-status-poll] Failed for org=${config.organizationId}:`,
          error,
        );
        results.push({
          organizationId: config.organizationId,
          checked: 0,
          updated: 0,
        });
      }
    }
  }

  const totalChecked = results.reduce((sum, r) => sum + r.checked, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);

  console.info(
    `[inpost-status-poll] Completed: ${results.length} org(s), ${totalChecked} checked, ${totalUpdated} updated`,
  );

  return NextResponse.json({ results });
}

export const POST = verifySignatureAppRouter(handler);
