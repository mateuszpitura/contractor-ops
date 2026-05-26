/**
 * Slack + Resend webhook context helpers — ported 1:1 from
 * apps/web/src/app/api/webhooks/slack-webhook-context.ts.
 *
 * The originals already used framework-agnostic deps (`@contractor-ops/db`,
 * `@contractor-ops/api/services/cache`) so this port is structural only:
 * no behaviour changes, no signature changes. Cached lookups stay TTL 60 s
 * (F-SCALE-10) keyed identically so the existing Upstash cache namespace
 * survives the cutover without a cold start.
 */

import { cached, cacheKey } from '@contractor-ops/api/services/cache';
import { prisma } from '@contractor-ops/db';

const SLACK_TEAM_CACHE_TTL_S = 60;
const RESEND_SLUG_CACHE_TTL_S = 60;

export function extractSlackTeamId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return;
  const p = payload as Record<string, unknown>;
  return (
    extractFromTeamObject(p) ??
    extractTopLevelTeamId(p) ??
    extractFromAuthorizations(p) ??
    extractFromEvent(p)
  );
}

function extractFromTeamObject(p: Record<string, unknown>): string | undefined {
  const team = p.team as Record<string, unknown> | undefined;
  if (team && typeof team.id === 'string') return team.id;
}

function extractTopLevelTeamId(p: Record<string, unknown>): string | undefined {
  if (typeof p.team_id === 'string') return p.team_id;
}

function extractFromAuthorizations(p: Record<string, unknown>): string | undefined {
  const auths = p.authorizations;
  if (!Array.isArray(auths)) return;
  for (const a of auths) {
    if (a && typeof a === 'object') {
      const tid = (a as Record<string, unknown>).team_id;
      if (typeof tid === 'string') return tid;
    }
  }
}

function extractFromEvent(p: Record<string, unknown>): string | undefined {
  const ev = p.event;
  if (ev && typeof ev === 'object') {
    const e = ev as Record<string, unknown>;
    if (typeof e.team_id === 'string') return e.team_id;
  }
}

export async function resolveSlackConnectionByTeamId(teamId: string): Promise<{
  organizationId: string;
  connectionId: string;
} | null> {
  return cached(cacheKey('webhook', 'slack', 'team', teamId), SLACK_TEAM_CACHE_TTL_S, async () => {
    const rows = await prisma.$queryRaw<Array<{ id: string; organizationId: string }>>`
      SELECT id, "organizationId"
      FROM "IntegrationConnection"
      WHERE provider = 'SLACK'
        AND status = 'CONNECTED'
        AND "configJson"->>'teamId' = ${teamId}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    return { organizationId: row.organizationId, connectionId: row.id };
  });
}

export async function resolveOrgIdBySlug(slug: string): Promise<string | null> {
  if (!slug) return null;
  return cached(cacheKey('webhook', 'org-by-slug', slug), RESEND_SLUG_CACHE_TTL_S, async () => {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    return org?.id ?? null;
  });
}
