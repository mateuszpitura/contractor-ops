/**
 * Courier shipment status poll handler (InPost + DPD + UPS).
 *
 * Hourly fallback poll for missed carrier webhooks. Each carrier polls
 * independently — one carrier failure does not block the others
 * (D-07 fire-and-forget resilience). The job name `inpost-status-poll` is
 * kept for Render dashboard continuity even though it now covers all 3
 * carriers.
 */

import { pollDpdShipmentStatuses } from '@contractor-ops/api/services/courier/dpd-polling-service';
import { pollInPostShipmentStatuses } from '@contractor-ops/api/services/courier/inpost-polling-service';
import { pollUpsShipmentStatuses } from '@contractor-ops/api/services/courier/ups-polling-service';
import { prisma } from '@contractor-ops/db';
import { Sentry } from '../../lib/sentry.js';
import type { JobHandler } from '../runner.js';

interface CarrierResult {
  carrier: string;
  checked: number;
  updated: number;
}

interface OrgResult {
  organizationId: string;
  carriers: CarrierResult[];
}

async function pollAllCarriersForOrg(organizationId: string): Promise<OrgResult> {
  const carriers: CarrierResult[] = [];

  const inpostResult = await pollInPostShipmentStatuses(
    prisma as unknown as Parameters<typeof pollInPostShipmentStatuses>[0],
    organizationId,
  ).catch(() => ({ checked: 0, updated: 0 }));
  carriers.push({ carrier: 'inpost', ...inpostResult });

  const dpdResult = await pollDpdShipmentStatuses(
    prisma as unknown as Parameters<typeof pollDpdShipmentStatuses>[0],
    organizationId,
  ).catch(() => ({ checked: 0, updated: 0 }));
  carriers.push({ carrier: 'dpd', ...dpdResult });

  const upsResult = await pollUpsShipmentStatuses(
    prisma as unknown as Parameters<typeof pollUpsShipmentStatuses>[0],
    organizationId,
  ).catch(() => ({ checked: 0, updated: 0 }));
  carriers.push({ carrier: 'ups', ...upsResult });

  return { organizationId, carriers };
}

export const inpostStatusPollHandler: JobHandler = async ctx => {
  const start = performance.now();
  try {
    const configs = await prisma.courierConfig.findMany({
      select: { organizationId: true },
      distinct: ['organizationId'],
    });

    const results: OrgResult[] = [];
    for (const config of configs) {
      const orgResult = await pollAllCarriersForOrg(config.organizationId);
      results.push(orgResult);
    }

    const totalChecked = results.reduce(
      (sum, r) => sum + r.carriers.reduce((s, c) => s + c.checked, 0),
      0,
    );
    const totalUpdated = results.reduce(
      (sum, r) => sum + r.carriers.reduce((s, c) => s + c.updated, 0),
      0,
    );

    ctx.log.info({ orgs: results.length, totalChecked, totalUpdated }, 'courier poll completed');
    return {
      ok: true,
      durationMs: Math.round(performance.now() - start),
      details: { orgs: results.length, totalChecked, totalUpdated },
    };
  } catch (err) {
    ctx.log.error({ err }, 'courier poll failed');
    Sentry.captureException(err, { tags: { 'cron.job': 'inpost-status-poll' } });
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      details: { error: err instanceof Error ? err.message : String(err) },
    };
  }
};
