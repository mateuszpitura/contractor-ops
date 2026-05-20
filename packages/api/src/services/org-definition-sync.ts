// ---------------------------------------------------------------------------
// Organization Definitions sync — Jira projects + Linear teams → Project rows
// ---------------------------------------------------------------------------
//
// Shared by:
//   - the nightly cron at /api/cron/org-definition-sync (one run per
//     connected integration per 24h);
//   - the per-integration "Sync now" tRPC mutation
//     (`organizationDefinitions.project.sync`);
//   - the fire-and-forget call from the Jira / Linear OAuth complete-connection
//     mutation so the user sees Projects appear the first time they connect.
//
// Each sync run:
//   1. Pulls all projects from the provider via the shared
//      `@contractor-ops/integrations` clients (same surface used by
//      onboarding-import — no divergent HTTP code).
//   2. For each remote project, checks `ProjectExternalLink`:
//        - found  → touches `syncedAt` on the matching link (no-op for the
//                   underlying Project so user edits survive).
//        - missing→ case-insensitive name lookup against existing Projects in
//                   the same org:
//                     – no collision → INSERT Project + ProjectExternalLink.
//                     – collision    → upsert a PendingProjectMerge row for
//                                       admin resolution; no Project is
//                                       written yet.
//   3. Per-row atomicity: each fresh-insert wraps Project + ProjectExternalLink
//      + AuditLog in one `$transaction`, so a row either fully lands or fully
//      rolls back. Batch-level is **best-effort** — a P2002 on one row does
//      NOT abort the run; the row is counted in `result.errors`, the rest
//      continue. This is intentional: a single misbehaving remote project
//      (renamed under a clashing name, dropped permission, etc.) must not
//      block the other 99 from importing. The cron retries the failed rows
//      on the next pass.
//   4. Per write, the centralised audit-writer records an AuditLog row.
//   5. A single Pino INFO line per run reports the resulting counts.

import type { Prisma } from '@contractor-ops/db';
import {
  decryptCredentials,
  fetchJiraProjects,
  fetchLinearTeams,
} from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
import { writeAuditLog } from './audit-writer';
import type { DbClient } from './types';

const log = createLogger({ service: 'org-definition-sync' });

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Provider + cloud-id metadata persisted on the IntegrationConnection. */
interface ConnectionConfig {
  cloudId?: string;
  [key: string]: unknown;
}

/** Minimal IntegrationConnection slice this service needs. */
export interface SyncableIntegrationConnection {
  id: string;
  organizationId: string;
  provider: 'JIRA' | 'LINEAR';
  credentialsRef: string;
  configJson: ConnectionConfig | null;
}

export interface OrgDefinitionSyncResult {
  /** Number of newly-inserted Project rows. */
  inserted: number;
  /** Number of remote projects already linked → just bumped `syncedAt`. */
  linked: number;
  /** Number of name-collision rows queued for admin merge resolution. */
  pending: number;
  /** Number of remote projects skipped because of a per-row error. */
  errors: number;
}

interface RemoteProject {
  externalId: string;
  name: string;
}

interface SyncContext {
  db: DbClient;
  /** Actor stamped on AuditLog rows — either a user id (manual "Sync now") or `null` for the cron. */
  actorUserId: string | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function syncJiraProjectsToOrgDefinitions(
  ctx: SyncContext,
  connection: SyncableIntegrationConnection,
): Promise<OrgDefinitionSyncResult> {
  if (connection.provider !== 'JIRA') {
    throw new Error(
      `syncJiraProjectsToOrgDefinitions: expected provider=JIRA, got ${connection.provider}`,
    );
  }
  const cloudId = connection.configJson?.cloudId;
  if (!cloudId) {
    log.warn(
      { organizationId: connection.organizationId, connectionId: connection.id },
      'jira sync skipped — missing cloudId',
    );
    return zeroResult();
  }

  const credentials = decryptCredentials(connection.credentialsRef, 'jira');
  const remote = await fetchJiraProjects(credentials.accessToken, { cloudId });
  return syncRemoteProjects(ctx, connection, 'JIRA', remote);
}

export async function syncLinearTeamsToOrgDefinitions(
  ctx: SyncContext,
  connection: SyncableIntegrationConnection,
): Promise<OrgDefinitionSyncResult> {
  if (connection.provider !== 'LINEAR') {
    throw new Error(
      `syncLinearTeamsToOrgDefinitions: expected provider=LINEAR, got ${connection.provider}`,
    );
  }

  const credentials = decryptCredentials(connection.credentialsRef, 'linear');
  const remote = await fetchLinearTeams(credentials.accessToken);
  return syncRemoteProjects(ctx, connection, 'LINEAR', remote);
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-row sync logic (link / collision / insert / audit) reads cleaner inline than split into five helpers.
async function syncRemoteProjects(
  ctx: SyncContext,
  connection: SyncableIntegrationConnection,
  source: 'JIRA' | 'LINEAR',
  remote: RemoteProject[],
): Promise<OrgDefinitionSyncResult> {
  const start = Date.now();
  const result = zeroResult();

  if (remote.length === 0) {
    log.info(
      {
        organizationId: connection.organizationId,
        connectionId: connection.id,
        provider: source,
        ...result,
        durationMs: Date.now() - start,
      },
      'org-definition-sync: no remote projects',
    );
    return result;
  }

  // Pre-load the org's existing links and projects in one shot. The remote
  // sets we deal with are O(100), and a single round-trip beats per-row
  // lookups inside the transaction.
  const [existingLinks, existingProjects] = await Promise.all([
    ctx.db.projectExternalLink.findMany({
      where: {
        organizationId: connection.organizationId,
        source,
        externalId: { in: remote.map(r => r.externalId) },
      },
      select: { id: true, externalId: true, projectId: true },
    }),
    ctx.db.project.findMany({
      where: { organizationId: connection.organizationId },
      select: { id: true, name: true },
    }),
  ]);

  const linksByExternal = new Map(existingLinks.map(l => [l.externalId, l]));
  // Lowercased trimmed name → ids (multiple projects can share a normalised name)
  const projectsByNormalisedName = new Map<string, string[]>();
  for (const p of existingProjects) {
    const key = p.name.trim().toLowerCase();
    const existing = projectsByNormalisedName.get(key);
    if (existing) existing.push(p.id);
    else projectsByNormalisedName.set(key, [p.id]);
  }

  for (const project of remote) {
    try {
      const link = linksByExternal.get(project.externalId);
      if (link) {
        // Already imported — just refresh the syncedAt timestamp. No project
        // edits so user-overridden names survive.
        await ctx.db.projectExternalLink.update({
          where: { id: link.id },
          data: { syncedAt: new Date() },
        });
        result.linked++;
        continue;
      }

      const normalised = project.name.trim().toLowerCase();
      const candidates = projectsByNormalisedName.get(normalised) ?? [];
      if (candidates.length > 0) {
        await ctx.db.pendingProjectMerge.upsert({
          where: {
            organizationId_source_externalId: {
              organizationId: connection.organizationId,
              source,
              externalId: project.externalId,
            },
          },
          create: {
            organizationId: connection.organizationId,
            source,
            externalId: project.externalId,
            incomingName: project.name,
            candidateProjectIds: candidates,
          },
          update: {
            incomingName: project.name,
            candidateProjectIds: candidates,
          },
        });
        result.pending++;
        continue;
      }

      // No link, no name collision — fresh insert.
      await ctx.db.$transaction(async tx => {
        const created = await tx.project.create({
          data: {
            organizationId: connection.organizationId,
            name: project.name,
            source,
            externalId: project.externalId,
          },
        });
        await tx.projectExternalLink.create({
          data: {
            organizationId: connection.organizationId,
            projectId: created.id,
            source,
            externalId: project.externalId,
            syncedAt: new Date(),
          },
        });
        await writeAuditLog({
          organizationId: connection.organizationId,
          actorType: ctx.actorUserId ? 'USER' : 'INTEGRATION',
          actorId: ctx.actorUserId ?? null,
          action: 'project.sync.create',
          resourceType: 'PROJECT',
          resourceId: created.id,
          resourceName: created.name,
          newValues: {
            name: created.name,
            source,
            externalId: project.externalId,
            connectionId: connection.id,
          },
          tx: tx as unknown as Parameters<typeof writeAuditLog>[0]['tx'],
        });
      });
      result.inserted++;
      // Update the in-memory index so a second remote project with the same
      // normalised name landing in this run triggers a merge, not a duplicate.
      const updated = projectsByNormalisedName.get(normalised) ?? [];
      projectsByNormalisedName.set(normalised, updated.concat([project.externalId]));
    } catch (err) {
      result.errors++;
      log.error(
        {
          err,
          organizationId: connection.organizationId,
          connectionId: connection.id,
          provider: source,
          externalId: project.externalId,
        },
        'org-definition-sync: failed to import project',
      );
    }
  }

  // Stamp the connection's lastSyncAt + clear/set lastError so the UI can show
  // either the timestamp or the last error message. We update outside the
  // per-project loop so partial successes still record a sync attempt.
  try {
    await ctx.db.integrationConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        ...(result.errors === 0
          ? { lastSuccessAt: new Date(), lastErrorAt: null, lastErrorMessage: null }
          : {
              lastErrorAt: new Date(),
              lastErrorMessage: `org-definition-sync: ${result.errors} row(s) failed`,
            }),
      },
    });
  } catch (err) {
    log.error(
      { err, organizationId: connection.organizationId, connectionId: connection.id },
      'org-definition-sync: failed to update IntegrationConnection lastSyncAt',
    );
  }

  log.info(
    {
      organizationId: connection.organizationId,
      connectionId: connection.id,
      provider: source,
      ...result,
      durationMs: Date.now() - start,
    },
    'org-definition-sync completed',
  );
  return result;
}

function zeroResult(): OrgDefinitionSyncResult {
  return { inserted: 0, linked: 0, pending: 0, errors: 0 };
}

// ---------------------------------------------------------------------------
// Cron entrypoint
// ---------------------------------------------------------------------------

/** Per-connection-per-24h rate limit. Matches the nightly cron cadence. */
const SYNC_THROTTLE_MS = 24 * 60 * 60 * 1000;

export interface ScheduledOrgDefinitionSyncResult {
  /** Total CONNECTED Jira/Linear integrations evaluated. */
  evaluated: number;
  /** Connections that ran a sync this invocation. */
  ran: number;
  /** Connections skipped because they synced within the last 24h. */
  skipped: number;
  /** Per-run results, keyed by connectionId. */
  runs: Array<{
    organizationId: string;
    connectionId: string;
    provider: 'JIRA' | 'LINEAR';
    result: OrgDefinitionSyncResult | { error: string };
  }>;
}

/**
 * Cron entrypoint — iterates every CONNECTED Jira / Linear integration across
 * every organization and runs a sync per connection, skipping connections
 * that already synced within the last 24h.
 *
 * Region-aware: each org gets its own regional Prisma client via
 * `getRegionalClient` so the sync writes against the correct shard.
 */
export async function runScheduledOrgDefinitionSync(deps: {
  prisma: import('@contractor-ops/db').PrismaClient;
  getRegionalClient: (region: 'EU' | 'ME') => unknown;
  createTenantClientFrom: (p: unknown) => DbClient;
  tenantStore: {
    run<R>(ctx: { organizationId: string; region: string }, cb: () => R): R;
  };
}): Promise<ScheduledOrgDefinitionSyncResult> {
  const cutoff = new Date(Date.now() - SYNC_THROTTLE_MS);
  const summary: ScheduledOrgDefinitionSyncResult = {
    evaluated: 0,
    ran: 0,
    skipped: 0,
    runs: [],
  };

  // Pull every CONNECTED Jira / Linear integration plus the org row that
  // tells us which region to target. Bypasses tenant scope by design — this
  // is the cron's fan-out entrypoint.
  const connections = await deps.prisma.integrationConnection.findMany({
    where: {
      status: 'CONNECTED',
      provider: { in: ['JIRA', 'LINEAR'] },
    },
    select: {
      id: true,
      organizationId: true,
      provider: true,
      credentialsRef: true,
      configJson: true,
      lastSyncAt: true,
      organization: { select: { dataRegion: true } },
    },
  });
  summary.evaluated = connections.length;

  for (const c of connections) {
    if (c.lastSyncAt && c.lastSyncAt > cutoff) {
      summary.skipped++;
      continue;
    }

    const region = (c.organization.dataRegion ?? 'EU') as 'EU' | 'ME';
    const regional = deps.getRegionalClient(region);
    const tenantDb = deps.createTenantClientFrom(regional);
    const provider = c.provider as 'JIRA' | 'LINEAR';

    try {
      const result = await deps.tenantStore.run({ organizationId: c.organizationId, region }, () =>
        provider === 'JIRA'
          ? syncJiraProjectsToOrgDefinitions(
              { db: tenantDb, actorUserId: null },
              {
                id: c.id,
                organizationId: c.organizationId,
                provider,
                credentialsRef: c.credentialsRef,
                configJson: c.configJson as ConnectionConfig | null,
              },
            )
          : syncLinearTeamsToOrgDefinitions(
              { db: tenantDb, actorUserId: null },
              {
                id: c.id,
                organizationId: c.organizationId,
                provider,
                credentialsRef: c.credentialsRef,
                configJson: c.configJson as ConnectionConfig | null,
              },
            ),
      );
      summary.ran++;
      summary.runs.push({
        organizationId: c.organizationId,
        connectionId: c.id,
        provider,
        result,
      });
    } catch (err) {
      summary.runs.push({
        organizationId: c.organizationId,
        connectionId: c.id,
        provider,
        result: { error: err instanceof Error ? err.message : String(err) },
      });
      log.error(
        { err, organizationId: c.organizationId, connectionId: c.id, provider },
        'org-definition-sync cron: connection failed',
      );
    }
  }

  log.info(
    {
      evaluated: summary.evaluated,
      ran: summary.ran,
      skipped: summary.skipped,
    },
    'org-definition-sync cron completed',
  );
  return summary;
}

export type { Prisma };
