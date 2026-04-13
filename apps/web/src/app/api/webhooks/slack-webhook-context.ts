import { Prisma, prisma } from '@contractor-ops/db';

// ---------------------------------------------------------------------------
// Slack webhook ingress — resolve org + connection from workspace team id
// ---------------------------------------------------------------------------

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
 */
export async function resolveSlackConnectionByTeamId(teamId: string): Promise<{
  organizationId: string;
  connectionId: string;
} | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; organizationId: string }>>(Prisma.sql`
    SELECT id, "organizationId"
    FROM "IntegrationConnection"
    WHERE provider = 'SLACK'
      AND status = 'CONNECTED'
      AND "configJson"->>'teamId' = ${teamId}
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) return null;
  return { organizationId: row.organizationId, connectionId: row.id };
}
