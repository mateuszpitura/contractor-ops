import { pollDpdShipmentStatuses } from '@contractor-ops/api/services/courier/dpd-polling-service';
import { pollInPostShipmentStatuses } from '@contractor-ops/api/services/courier/inpost-polling-service';
import { pollUpsShipmentStatuses } from '@contractor-ops/api/services/courier/ups-polling-service';
import { prisma } from '@contractor-ops/db';
import { buildContextFromHeaders, runWithRequestContext } from '@contractor-ops/logger';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
  // F-OBS-03: reseed ALS frame from upstream QStash forward headers.
  const traceCtx = buildContextFromHeaders(request.headers);
  return runWithRequestContext(traceCtx, () => handlerInner(request));
}

async function handlerInner(request: NextRequest) {
  let body: { organizationId?: string } = {};

  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
    // safe-swallow: pre-existing — see goals/production-hardening/ phase B.7.b
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
      distinct: ['organizationId'],
    });

    for (const config of configs) {
      const orgResult = await pollAllCarriersForOrg(config.organizationId);
      results.push(orgResult);
    }
  }

  const _totalChecked = results.reduce(
    (sum, r) => sum + r.carriers.reduce((s, c) => s + c.checked, 0),
    0,
  );
  const _totalUpdated = results.reduce(
    (sum, r) => sum + r.carriers.reduce((s, c) => s + c.updated, 0),
    0,
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
  // TODO(typecheck-pass-2): polling helpers expect an extended Prisma client
  // type that doesn't structurally match the bare PrismaClient. Cast at the
  // boundary; the runtime call is unaffected.
  const inpostResult = await pollInPostShipmentStatuses(
    prisma as unknown as Parameters<typeof pollInPostShipmentStatuses>[0],
    organizationId,
  ).catch(_err => {
    return { checked: 0, updated: 0 };
  });
  carriers.push({ carrier: 'inpost', ...inpostResult });

  // Poll DPD shipments
  const dpdResult = await pollDpdShipmentStatuses(
    prisma as unknown as Parameters<typeof pollDpdShipmentStatuses>[0],
    organizationId,
  ).catch(_err => {
    return { checked: 0, updated: 0 };
  });
  carriers.push({ carrier: 'dpd', ...dpdResult });

  // Poll UPS shipments
  const upsResult = await pollUpsShipmentStatuses(
    prisma as unknown as Parameters<typeof pollUpsShipmentStatuses>[0],
    organizationId,
  ).catch(_err => {
    return { checked: 0, updated: 0 };
  });
  carriers.push({ carrier: 'ups', ...upsResult });

  return { organizationId, carriers };
}

export const POST = verifySignatureAppRouter(handler);
