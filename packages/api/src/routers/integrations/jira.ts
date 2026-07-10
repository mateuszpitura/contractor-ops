import { decryptCredentials } from '@contractor-ops/integrations/services/credential-service';
import { createLogger } from '@contractor-ops/logger';
import {
  jiraTaskConfigSchema,
  saveJiraStatusMappingInputSchema,
  saveJiraTaskConfigInputSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import {
  loadIntegrationConnection,
  loadOrgIntegrationConnection,
} from '../../lib/integration-connection.js';
import { integrationProcedure } from '../../lib/integration-procedure';
import type { TenantScopedDb } from '../../lib/tenant-db';
import { writeAuditLog } from '../../services/audit-writer';
import { detectScopeExpansionNeeded } from '../../services/jira-issue-sync';
import { getStatusMapping, saveStatusMapping } from '../../services/jira-status-mapping';
import { deregisterJiraWebhooks, registerJiraWebhooks } from '../../services/jira-webhook-handler';

const log = createLogger({ service: 'jira-router' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface JiraConnectionConfig {
  cloudId?: string;
  statusMappings?: Record<string, unknown[]>;
  [key: string]: unknown;
}

/**
 * Project a Jira connection's `configJson` down to fields that are safe to
 * expose to any member with `settings:['read']`. The raw blob also stores the
 * per-connection inbound `webhookSecret` (HMAC signing key) plus `webhookIds`;
 * returning those verbatim would let a read-only member forge signed Jira
 * webhooks. Only non-secret display/config fields are surfaced.
 */
function publicJiraConfig(configJson: unknown): Record<string, unknown> | null {
  if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) return null;
  const config = configJson as JiraConnectionConfig;
  return {
    cloudId: config.cloudId,
    siteName: config.siteName,
    siteUrl: config.siteUrl,
    statusMappings: config.statusMappings,
    webhookRegisteredAt: config.webhookRegisteredAt,
  };
}

/**
 * Builds the Jira Cloud REST API base URL and authorization headers
 * from a connection's decrypted credentials and config.
 */
function buildJiraApiContext(
  configJson: unknown,
  credentialsRef: string,
): { baseUrl: string; authHeaders: Record<string, string> } {
  const config = configJson as JiraConnectionConfig;

  if (!config?.cloudId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.JIRA_MISSING_CLOUD_ID,
    });
  }

  const credentials = decryptCredentials(credentialsRef, 'jira');

  return {
    baseUrl: `https://api.atlassian.com/ex/jira/${config.cloudId}/rest/api/3`,
    authHeaders: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  };
}

async function loadConnection(db: TenantScopedDb, connectionId: string, organizationId: string) {
  return loadIntegrationConnection(db, connectionId, organizationId, { provider: 'JIRA' });
}

/**
 * Issues an authenticated GET against Jira Cloud REST API v3 for the given
 * connection and validates the JSON body against `schema`. Throws
 * INTERNAL_SERVER_ERROR with the upstream response text on non-2xx, and on a
 * body that does not match `schema` (the Jira response is external input —
 * never coerced via an unchecked cast).
 *
 * Centralises the load-context → fetch → ok-check → text-on-error → validate
 * pipeline that the list procedures previously duplicated.
 */
async function jiraApiGet<S extends z.ZodType>(
  connection: { configJson: unknown; credentialsRef: string },
  path: string,
  errorLabel: string,
  schema: S,
): Promise<z.infer<S>> {
  const { baseUrl, authHeaders } = buildJiraApiContext(
    connection.configJson,
    connection.credentialsRef,
  );

  const response = await fetch(`${baseUrl}${path}`, { headers: authHeaders });

  if (!response.ok) {
    const text = await response.text();
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to ${errorLabel}: ${text}`,
    });
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to ${errorLabel}: unexpected response shape`,
    });
  }

  return parsed.data;
}

// ---------------------------------------------------------------------------
// Jira Router
// ---------------------------------------------------------------------------

export const jiraRouter = router({
  // =========================================================================
  // Read queries
  // =========================================================================

  /**
   * Get the current Jira connection status for this organization.
   * Returns connection details including scope expansion detection.
   */
  connectionStatus: integrationProcedure({ permission: { settings: ['read'] } }).query(
    async ({ ctx }) => {
      const connection = await loadOrgIntegrationConnection(ctx.db, ctx.organizationId, 'JIRA', {
        status: 'any',
        optional: true,
      });

      if (!connection) return null;

      // Detect whether stored scopes need expansion (scope upgrade)
      let scopeExpansionNeeded = false;
      if (connection.credentialsRef) {
        try {
          const creds = decryptCredentials(connection.credentialsRef, 'jira');
          if (creds.scope) {
            scopeExpansionNeeded = detectScopeExpansionNeeded(creds.scope);
          }
        } catch {
          // Cannot decrypt — likely needs reconnection
          scopeExpansionNeeded = true;
        }
      }

      return {
        id: connection.id,
        status: connection.status,
        displayName: connection.displayName,
        configJson: publicJiraConfig(connection.configJson),
        lastSyncAt: connection.lastSyncAt,
        tokenExpiresAt: connection.tokenExpiresAt,
        scopeExpansionNeeded,
      };
    },
  ),

  /**
   * List all Jira projects accessible via the connected account.
   */
  listProjects: integrationProcedure({ permission: { settings: ['read'] } })
    .input(z.object({ connectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connection = await loadConnection(ctx.db, input.connectionId, ctx.organizationId);
      const projects = await jiraApiGet(
        connection,
        '/project',
        'list Jira projects',
        z.array(z.object({ id: z.string(), key: z.string(), name: z.string() })),
      );
      return projects.map(p => ({ id: p.id, key: p.key, name: p.name }));
    }),

  /**
   * List issue types for a specific Jira project.
   */
  listIssueTypes: integrationProcedure({ permission: { settings: ['read'] } })
    .input(
      z.object({
        connectionId: z.string(),
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const connection = await loadConnection(ctx.db, input.connectionId, ctx.organizationId);
      const project = await jiraApiGet(
        connection,
        `/project/${input.projectId}`,
        'list Jira issue types',
        z.object({
          issueTypes: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
        }),
      );
      return (project.issueTypes ?? []).map(t => ({ id: t.id, name: t.name }));
    }),

  /**
   * List project-level statuses with transition info.
   */
  listProjectStatuses: integrationProcedure({ permission: { settings: ['read'] } })
    .input(
      z.object({
        connectionId: z.string(),
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const connection = await loadConnection(ctx.db, input.connectionId, ctx.organizationId);
      return jiraApiGet(
        connection,
        `/status/project/${input.projectId}`,
        'list Jira project statuses',
        z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            statusCategory: z.object({ key: z.string(), name: z.string() }),
          }),
        ),
      );
    }),

  /**
   * Get saved status mapping for a Jira project.
   */
  getStatusMapping: integrationProcedure({ permission: { settings: ['read'] } })
    .input(
      z.object({
        connectionId: z.string(),
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await loadConnection(ctx.db, input.connectionId, ctx.organizationId);
      const mapping = await getStatusMapping(
        ctx.db,
        ctx.organizationId,
        input.connectionId,
        input.projectId,
      );

      return mapping ?? [];
    }),

  /**
   * Get Jira configuration for a workflow task template.
   */
  getTaskConfig: integrationProcedure({ permission: { workflow: ['read'] } })
    .input(z.object({ taskTemplateId: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.workflowTaskTemplate.findUnique({
        where: { id: input.taskTemplateId },
        select: { configJson: true },
      });

      if (!template?.configJson) {
        return { jiraEnabled: false };
      }

      const parsed = jiraTaskConfigSchema.safeParse(template.configJson);
      return parsed.success ? parsed.data : { jiraEnabled: false };
    }),

  /**
   * Get linked Jira issues for a workflow entity.
   */
  linkedIssues: integrationProcedure({ permission: { workflow: ['read'] } })
    .input(
      z.object({
        entityType: z.enum(['WORKFLOW_TASK_RUN', 'WORKFLOW_RUN']),
        entityId: z.string(),
        // Bound the result set. WORKFLOW_RUN aggregates over all task runs;
        // without a cap, a long-running workflow with many tasks loads every
        // external link in one request.
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
            externalType: 'JIRA_ISSUE',
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

      // WORKFLOW_RUN: cap the underlying task-run set so total work stays
      // bounded for very large runs.
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
          externalType: 'JIRA_ISSUE',
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

  /**
   * Get recent Jira activity for a contractor.
   */
  recentActivity: integrationProcedure({ permission: { workflow: ['read'] } })
    .input(
      z.object({
        contractorId: z.string(),
        limit: z.number().min(1).max(20).default(5),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Find all workflow runs for this contractor
      const runs = await ctx.db.workflowRun.findMany({
        where: {
          contractorId: input.contractorId,
          organizationId: ctx.organizationId,
        },
        select: { id: true },
      });

      if (runs.length === 0) return [];

      // Get all task run IDs
      const taskRuns = await ctx.db.workflowTaskRun.findMany({
        where: {
          workflowRunId: { in: runs.map(r => r.id) },
        },
        select: { id: true },
      });

      if (taskRuns.length === 0) return [];

      // Find recent Jira-linked external links
      const links = await ctx.db.externalLink.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: 'WORKFLOW_TASK_RUN',
          entityId: { in: taskRuns.map(t => t.id) },
          externalType: 'JIRA_ISSUE',
        },
        orderBy: { updatedAt: 'desc' },
        take: input.limit,
        select: {
          id: true,
          externalId: true,
          externalUrl: true,
          metadataJson: true,
          updatedAt: true,
        },
      });

      return links;
    }),

  // =========================================================================
  // Config mutations
  // =========================================================================

  /**
   * Save a status mapping for a Jira project.
   * After saving, registers/updates webhooks for all projects with mappings.
   */
  saveStatusMapping: integrationProcedure({
    permission: { settings: ['update'] },
    tier: 'PRO',
  })
    .input(saveJiraStatusMappingInputSchema)
    .mutation(async ({ ctx, input }) => {
      await loadConnection(ctx.db, input.connectionId, ctx.organizationId);

      await saveStatusMapping(
        ctx.db,
        ctx.organizationId,
        input.connectionId,
        input.projectId,
        input.mappings,
      );

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'INTEGRATION_JIRA_STATUS_MAPPING_SAVE',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        newValues: { projectId: input.projectId, mappingCount: input.mappings.length },
        metadata: { connectionId: input.connectionId, projectId: input.projectId },
      });

      // Re-register webhooks for all projects that have status mappings
      const refreshedConnection = await loadConnection(
        ctx.db,
        input.connectionId,
        ctx.organizationId,
      );
      const config = (refreshedConnection.configJson as JiraConnectionConfig) ?? {};
      const statusMappings = config.statusMappings ?? {};

      const projectKeys = Object.keys(statusMappings);
      let webhooksRegistered = true;
      if (projectKeys.length > 0) {
        try {
          await registerJiraWebhooks(ctx.db, input.connectionId, projectKeys);
        } catch (error) {
          webhooksRegistered = false;
          log.error({ err: error }, 'failed to register webhooks');
        }
      }

      return { success: true, webhooksRegistered };
    }),

  /**
   * Save Jira configuration for a workflow task template.
   */
  saveTaskConfig: integrationProcedure({
    permission: { workflow: ['update'] },
    tier: 'PRO',
  })
    .input(saveJiraTaskConfigInputSchema)
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

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'INTEGRATION_JIRA_TASK_CONFIG_SAVE',
        resourceType: 'WORKFLOW_TASK_TEMPLATE',
        resourceId: input.taskTemplateId,
        newValues: { config: input.config },
      });

      return { success: true };
    }),

  /**
   * Disconnect Jira integration.
   * Deregisters webhooks and sets connection status to DISCONNECTED.
   */
  disconnect: integrationProcedure({
    permission: { settings: ['update'] },
    tier: 'PRO',
  })
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await loadIntegrationConnection(
        ctx.db,
        input.connectionId,
        ctx.organizationId,
        {
          provider: 'JIRA',
          requireConnected: false,
          notFoundMessage: E.INTEGRATION_NOT_FOUND,
        },
      );

      // Deregister webhooks first (best effort)
      try {
        await deregisterJiraWebhooks(ctx.db, input.connectionId);
      } catch (error) {
        log.error({ err: error }, 'failed to deregister webhooks');
      }

      await ctx.db.$transaction(async tx => {
        await tx.integrationConnection.update({
          where: { id: connection.id },
          data: { status: 'DISCONNECTED' },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'INTEGRATION_DISCONNECT',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          oldValues: { provider: 'JIRA', status: connection.status },
          newValues: { status: 'DISCONNECTED' },
          metadata: { connectionId: connection.id },
        });
      });

      return { success: true };
    }),
});
