import { prisma } from '@contractor-ops/db';
import { cached, cacheKey } from '@contractor-ops/api/services/cache';

// ---------------------------------------------------------------------------
// Slack webhook ingress — resolve org + connection from workspace team id
// ---------------------------------------------------------------------------
//
// F-SCALE-10 — Slack webhooks fire dozens of events per workspace per minute
// at scale; a fresh `prisma.integrationConnection.findFirst` per event makes
// the Neon round-trip the throughput bottleneck. We cache the
// `teamId → { orgId, connectionId }` resolution in Upstash Redis with a
// 60 s TTL. The TTL is short on purpose so disconnect / re-connect flows
// converge within one cron tick, and connection upserts don't need bespoke
// invalidation hooks. Dev / no-Redis environments fall through to the DB
// query unchanged via the `cached()` helper.
const SLACK_TEAM_CACHE_TTL_S = 60;
const RESEND_SLUG_CACHE_TTL_S = 60;

/**
 * Extract Slack workspace team id from Events API, interactivity, or shortcuts payloads.
 *
 * Checks multiple locations where Slack embeds the team ID:
 * 1. `team.id` (interactive payloads)
 * 2. `team_id` (top-level shortcut)
 * 3. `authorizations[].team_id` (Events API v2)
 * 4. `event.team_id` (Events API nested)
 */
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

/**
 * Looks up the org-scoped Slack integration whose OAuth config stores this workspace team id.
 * Uses JSON path query (PostgreSQL).
 *
 * F-SCALE-10 — wrapped in a 60 s Upstash cache keyed by team id. Slack events
 * fire frequently per workspace and the per-event Neon round-trip is the
 * limiting factor on ingest throughput. Negative results (`null`) are cached
 * too via the envelope wrapper so a malformed / unknown teamId does not
 * round-trip the DB on every event.
 */
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

/**
 * F-SCALE-10 — cached `slug → orgId` lookup used by Resend webhook ingest.
 * Same rationale as `resolveSlackConnectionByTeamId`: Resend fires per-email
 * delivery / open / click events at high frequency; without a cache each
 * event blocks on a Neon `findUnique` of the small but very hot
 * `Organization` table.
 */
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
