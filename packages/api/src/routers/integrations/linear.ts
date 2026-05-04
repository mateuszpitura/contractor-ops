import type { Prisma } from '@contractor-ops/db';
import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { createLogger } from '@contractor-ops/logger';
import type { LinearIssueMetadata } from '@contractor-ops/validators';
import {
  saveLinearStatusMappingInputSchema,
  saveLinearTaskConfigInputSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors.js';
import { router } from '../../init.js';
import type { TenantScopedDb } from '../../lib/tenant-db.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantProcedure } from '../../middleware/tenant.js';
import { requireTier } from '../../middleware/tier.js';
import { linearGraphQL } from '../../services/linear-issue-sync.js';
import { registerLinearWebhook } from '../../services/linear-webhook-handler.js';

const log = createLogger({ service: 'linear-router' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface LinearConnectionConfig {
  statusMappings?: Record<string, unknown[]>;
  stateCache?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Decrypts Linear credentials from a connection's credentialsRef
 * and returns the access token for API calls.
 */
function buildLinearApiContext(credentialsRef: string): {
  accessToken: string;
  authHeaders: Record<string, string>;
} {
  const credentials = decryptCredentials(credentialsRef, 'linear');

  return {
    accessToken: credentials.accessToken,
    authHeaders: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Loads a Linear connection for the org, accepting both PENDING_MAPPING
 * and CONNECTED statuses (per D-03: mapping dialog needs access post-OAuth).
 */
async function loadLinearConnection(db: TenantScopedDb, organizationId: string) {
  const connection = await db.integrationConnection.findFirst({
    where: {
      organizationId,
      provider: 'LINEAR',
      status: { in: ['PENDING_MAPPING', 'CONNECTED'] },
    },
  });

  if (!connection) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: E.INTEGRATION_NOT_FOUND,
    });
  }

  return connection;
}

// ---------------------------------------------------------------------------
// Linear Router
// ---------------------------------------------------------------------------

// linear: Linear integration -- connection, teams, status mapping, task config, linked issues
export const linearRouter = router({
  // =========================================================================
  // Read queries
  // =========================================================================

  /**
   * Get Linear connection status (id, status, config) for the current org.
   * Returns null when no connection exists.
   */
  connectionStatus: tenantProcedure.query(async ({ ctx }) => {
    const connection = await ctx.db.integrationConnection.findFirst({
      where: {
        organizationId: ctx.organizationId,
        provider: 'LINEAR',
      },
      select: {
        id: true,
        status: true,
        configJson: true,
      },
    });

    if (!connection) return null;

    return {
      id: connection.id,
      status: connection.status,
      configJson: connection.configJson as Record<string, unknown> | null,
    };
  }),

  /**
   * Fetch Linear teams for the connected workspace.
   * Queries Linear GraphQL API for teams with their workflow states.
   * Accepts both PENDING_MAPPING and CONNECTED connections (D-03).
   */
  teams: tenantProcedure.query(async ({ ctx }) => {
    const connection = await loadLinearConnection(ctx.db, ctx.organizationId);
    const { accessToken } = buildLinearApiContext(connection.credentialsRef);

    const result = await linearGraphQL<{
      teams: {
        nodes: Array<{
          id: string;
          name: string;
          key: string;
          states: {
            nodes: Array<{
              id: string;
              name: string;
              type: string;
              color: string;
              position: number;
            }>;
          };
        }>;
      };
    }>(
      accessToken,
      `{
        teams {
          nodes {
            id
            name
            key
            states {
              nodes {
                id
                name
                type
                color
                position
              }
            }
          }
        }
      }`,
    );

    return result.teams.nodes.map(team => ({
      id: team.id,
      name: team.name,
      key: team.key,
      states: team.states.nodes.map(state => ({
        id: state.id,
        name: state.name,
        type: state.type,
        color: state.color,
        position: state.position,
      })),
    }));
  }),

  /**
   * Get saved status mapping for a Linear team.
   * Returns the mapping entries from configJson.statusMappings[teamId].
   */
  getStatusMapping: tenantProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connection = await loadLinearConnection(ctx.db, ctx.organizationId);
      const config = (connection.configJson as LinearConnectionConfig) ?? {};
      const mappings = config.statusMappings ?? {};
      const teamMappings = mappings[input.teamId];

      return (teamMappings as unknown[]) ?? [];
    }),

  /**
   * Save status mapping for a Linear team.
   * Updates configJson.statusMappings[teamId] and configJson.stateCache[teamId].
   * Transitions connection from PENDING_MAPPING to CONNECTED on first save (D-03).
   */
  saveStatusMapping: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .use(requireTier('PRO'))
    .input(saveLinearStatusMappingInputSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await loadLinearConnection(ctx.db, ctx.organizationId);

      if (connection.id !== input.connectionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Connection ID does not match the active Linear connection.',
        });
      }

      const config = (connection.configJson as LinearConnectionConfig) ?? {};
      const statusMappings = config.statusMappings ?? {};
      const stateCache = config.stateCache ?? {};

      // Update status mappings for this team
      statusMappings[input.teamId] = input.mappings;

      // Build state cache for webhook lookup (stateId -> { name, type })
      const teamStateCache: Record<string, { name: string; type: string }> = {};
      for (const mapping of input.mappings) {
        teamStateCache[mapping.linearStateId] = {
          name: mapping.linearStateName,
          type: mapping.linearStateType,
        };
      }
      stateCache[input.teamId] = teamStateCache;

      // Update connection config and transition to CONNECTED if PENDING_MAPPING
      await ctx.db.integrationConnection.update({
        where: { id: connection.id },
        data: {
          configJson: {
            ...config,
            statusMappings,
            stateCache,
          } as Prisma.InputJsonValue,
          ...(connection.status === 'PENDING_MAPPING' ? { status: 'CONNECTED' } : {}),
        },
      });

      // Fire-and-forget: register webhook for this team if not yet registered
      const webhooks = (config.webhooks as Record<string, string> | undefined) ?? {};
      if (!webhooks[input.teamId]) {
        void registerLinearWebhook(ctx.db, connection.id, input.teamId).catch(err =>
          log.error({ err, teamId: input.teamId }, 'webhook registration failed for team'),
        );
      }

      return { success: true };
    }),

  /**
   * Save Linear configuration for a workflow task template.
   * Merges Linear config into existing configJson.
   */
  saveTaskConfig: tenantProcedure
    .use(requirePermission({ workflow: ['update'] }))
    .use(requireTier('PRO'))
    .input(saveLinearTaskConfigInputSchema)
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.workflowTaskTemplate.findFirst({
        where: {
          id: input.taskTemplateId,
          organizationId: ctx.organizationId,
        },
        select: { configJson: true },
      });

      if (!template) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.WORKFLOW_TEMPLATE_NOT_FOUND,
        });
      }

      const existingConfig = (template.configJson as Record<string, unknown>) ?? {};

      await ctx.db.workflowTaskTemplate.update({
        where: { id: input.taskTemplateId },
        data: {
          configJson: {
            ...existingConfig,
            ...input.config,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Get linked Linear issue for a single task run.
   * Returns the ExternalLink with parsed metadata or null.
   */
  getLinkedIssue: tenantProcedure
    .input(z.object({ taskRunId: z.string() }))
    .query(async ({ ctx, input }) => {
      const link = await ctx.db.externalLink.findFirst({
        where: {
          organizationId: ctx.organizationId,
          entityType: 'WORKFLOW_TASK_RUN',
          entityId: input.taskRunId,
          externalType: 'LINEAR_ISSUE',
        },
        select: {
          id: true,
          externalId: true,
          externalUrl: true,
          metadataJson: true,
        },
      });

      if (!link) return null;

      return {
        ...link,
        metadata: link.metadataJson as LinearIssueMetadata | null,
      };
    }),

  /**
   * Get linked Linear issues for multiple task runs (batch).
   * Returns a map of taskRunId to linked issue data or null.
   */
  getLinkedIssues: tenantProcedure
    .input(z.object({ taskRunIds: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      if (input.taskRunIds.length === 0) return {};

      const links = await ctx.db.externalLink.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: 'WORKFLOW_TASK_RUN',
          entityId: { in: input.taskRunIds },
          externalType: 'LINEAR_ISSUE',
        },
        select: {
          id: true,
          entityId: true,
          externalId: true,
          externalUrl: true,
          metadataJson: true,
        },
      });

      const result: Record<
        string,
        {
          id: string;
          externalId: string;
          externalUrl: string | null;
          metadata: LinearIssueMetadata | null;
        } | null
      > = {};

      // Initialize all requested IDs to null
      for (const taskRunId of input.taskRunIds) {
        result[taskRunId] = null;
      }

      // Fill in found links
      for (const link of links) {
        result[link.entityId] = {
          id: link.id,
          externalId: link.externalId,
          externalUrl: link.externalUrl,
          metadata: link.metadataJson as LinearIssueMetadata | null,
        };
      }

      return result;
    }),

  /**
   * Get linked Linear issues for a workflow entity (run or task run).
   * Mirrors jira.linkedIssues for UI consistency.
   */
  linkedIssues: tenantProcedure
    .input(
      z.object({
        entityType: z.enum(['WORKFLOW_TASK_RUN', 'WORKFLOW_RUN']),
        entityId: z.string(),
        // F-DB-09: bound the result set. Mirrors jira.linkedIssues.
        take: z.number().int().min(1).max(200).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.entityType === 'WORKFLOW_TASK_RUN') {
        const links = await ctx.db.externalLink.findMany({
          where: {
            organizationId: ctx.organizationId,
            entityType: 'WORKFLOW_TASK_RUN',
            entityId: input.entityId,
            externalType: 'LINEAR_ISSUE',
          },
          select: {
            id: true,
            externalId: true,
            externalUrl: true,
            metadataJson: true,
          },
          take: input.take + 1,
          ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        });

        const hasMore = links.length > input.take;
        const items = hasMore ? links.slice(0, input.take) : links;
        return {
          items,
          nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
        };
      }

      // WORKFLOW_RUN: cap the underlying task-run set as well so total work
      // stays bounded for very large runs.
      const taskRuns = await ctx.db.workflowTaskRun.findMany({
        where: {
          workflowRunId: input.entityId,
          organizationId: ctx.organizationId,
        },
        select: { id: true },
        take: 200,
      });

      if (taskRuns.length === 0) return { items: [], nextCursor: undefined };

      const links = await ctx.db.externalLink.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: 'WORKFLOW_TASK_RUN',
          entityId: { in: taskRuns.map(t => t.id) },
          externalType: 'LINEAR_ISSUE',
        },
        select: {
          id: true,
          externalId: true,
          externalUrl: true,
          metadataJson: true,
        },
        take: input.take + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = links.length > input.take;
      const items = hasMore ? links.slice(0, input.take) : links;
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),
});
