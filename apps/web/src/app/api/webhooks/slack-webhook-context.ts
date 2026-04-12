import { Prisma, prisma } from "@contractor-ops/db";

// ---------------------------------------------------------------------------
// Slack webhook ingress — resolve org + connection from workspace team id
// ---------------------------------------------------------------------------

/**
 * Extract Slack workspace team id from Events API, interactivity, or shortcuts payloads.
 */
export function extractSlackTeamId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return;
  const p = payload as Record<string, unknown>;

  const team = p.team as Record<string, unknown> | undefined;
  if (team && typeof team.id === "string") return team.id;

  if (typeof p.team_id === "string") return p.team_id;

  const auths = p.authorizations;
  if (Array.isArray(auths)) {
    for (const a of auths) {
      if (a && typeof a === "object") {
        const tid = (a as Record<string, unknown>).team_id;
        if (typeof tid === "string") return tid;
      }
    }
  }

  const ev = p.event;
  if (ev && typeof ev === "object") {
    const e = ev as Record<string, unknown>;
    if (typeof e.team_id === "string") return e.team_id;
  }

  return;
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
