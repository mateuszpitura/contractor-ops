import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import { decryptCredentials } from "@contractor-ops/integrations/services/credential-service";
import {
  jiraTaskConfigSchema,
  saveJiraStatusMappingInputSchema,
  saveJiraTaskConfigInputSchema,
} from "@contractor-ops/validators";
import type { JiraIssueMetadata } from "@contractor-ops/validators";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import { detectScopeExpansionNeeded } from "../services/jira-issue-sync.js";
import {
  getStatusMapping,
  saveStatusMapping,
} from "../services/jira-status-mapping.js";
import {
  registerJiraWebhooks,
  deregisterJiraWebhooks,
} from "../services/jira-webhook-handler.js";
import * as E from "../errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

interface JiraConnectionConfig {
  cloudId?: string;
  statusMappings?: Record<string, unknown[]>;
  [key: string]: unknown;
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
      code: "BAD_REQUEST",
      message:
        "Jira connection is missing cloudId. Please reconnect your Jira integration.",
    });
  }

  const credentials = decryptCredentials(credentialsRef, "jira");

  return {
    baseUrl: `https://api.atlassian.com/ex/jira/${config.cloudId}/rest/api/3`,
    authHeaders: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
}

/**
 * Loads and validates a Jira connection, throwing if not found or disconnected.
 */
async function loadConnection(connectionId: string, organizationId: string) {
  const connection = await prisma.integrationConnection.findFirst({
    where: { id: connectionId, organizationId },
  });

  if (!connection || connection.status !== "CONNECTED") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: E.INTEGRATION_NOT_CONNECTED,
    });
  }

  return connection;
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
  connectionStatus: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .query(async ({ ctx }) => {
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          organizationId: ctx.organizationId,
          provider: "JIRA",
        },
        select: {
          id: true,
          status: true,
          displayName: true,
          configJson: true,
          lastSyncAt: true,
          tokenExpiresAt: true,
          credentialsRef: true,
        },
      });

      if (!connection) return null;

      // Detect whether stored scopes need expansion (Phase 18 -> 19 upgrade)
      let scopeExpansionNeeded = false;
      if (connection.credentialsRef) {
        try {
          const creds = decryptCredentials(connection.credentialsRef, "jira");
          if (creds.scope) {
            scopeExpansionNeeded = detectScopeExpansionNeeded(creds.scope);
          }
        } catch {
          // Cannot decrypt — likely needs reconnection
          scopeExpansionNeeded = true;
        }
      }

      return plain({
        id: connection.id,
        status: connection.status,
        displayName: connection.displayName,
        configJson: connection.configJson,
        lastSyncAt: connection.lastSyncAt,
        tokenExpiresAt: connection.tokenExpiresAt,
        scopeExpansionNeeded,
      });
    }),

  /**
   * List all Jira projects accessible via the connected account.
   */
  listProjects: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .input(z.object({ connectionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const connection = await loadConnection(
        input.connectionId,
        ctx.organizationId,
      );
      const { baseUrl, authHeaders } = buildJiraApiContext(
        connection.configJson,
        connection.credentialsRef,
      );

      const response = await fetch(`${baseUrl}/project`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list Jira projects: ${text}`,
        });
      }

      const projects = (await response.json()) as Array<{
        id: string;
        key: string;
        name: string;
      }>;

      return projects.map((p) => ({ id: p.id, key: p.key, name: p.name }));
    }),

  /**
   * List issue types for a specific Jira project.
   */
  listIssueTypes: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .input(
      z.object({
        connectionId: z.string(),
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const connection = await loadConnection(
        input.connectionId,
        ctx.organizationId,
      );
      const { baseUrl, authHeaders } = buildJiraApiContext(
        connection.configJson,
        connection.credentialsRef,
      );

      const response = await fetch(`${baseUrl}/project/${input.projectId}`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list Jira issue types: ${text}`,
        });
      }

      const project = (await response.json()) as {
        issueTypes?: Array<{ id: string; name: string }>;
      };

      return (project.issueTypes ?? []).map((t) => ({
        id: t.id,
        name: t.name,
      }));
    }),

  /**
   * List project-level statuses with transition info.
   */
  listProjectStatuses: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .input(
      z.object({
        connectionId: z.string(),
        projectId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const connection = await loadConnection(
        input.connectionId,
        ctx.organizationId,
      );
      const { baseUrl, authHeaders } = buildJiraApiContext(
        connection.configJson,
        connection.credentialsRef,
      );

      const response = await fetch(
        `${baseUrl}/status/project/${input.projectId}`,
        { headers: authHeaders },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list Jira project statuses: ${text}`,
        });
      }

      const statuses = (await response.json()) as Array<{
        id: string;
        name: string;
        statusCategory: { key: string; name: string };
      }>;

      return statuses;
    }),

  /**
   * Get saved status mapping for a Jira project.
   */
  getStatusMapping: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .input(
      z.object({
        connectionId: z.string(),
        projectId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const mapping = await getStatusMapping(
        prisma,
        input.connectionId,
        input.projectId,
      );

      return mapping ?? [];
    }),

  /**
   * Get Jira configuration for a workflow task template.
   */
  getTaskConfig: tenantProcedure
    .use(requirePermission({ workflow: ["read"] }))
    .input(z.object({ taskTemplateId: z.string() }))
    .query(async ({ input }) => {
      const template = await prisma.workflowTaskTemplate.findUnique({
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
  linkedIssues: tenantProcedure
    .input(
      z.object({
        entityType: z.enum(["WORKFLOW_TASK_RUN", "WORKFLOW_RUN"]),
        entityId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.entityType === "WORKFLOW_TASK_RUN") {
        const links = await prisma.externalLink.findMany({
          where: {
            organizationId: ctx.organizationId,
            entityType: "WORKFLOW_TASK_RUN",
            entityId: input.entityId,
            externalType: "JIRA_ISSUE",
          },
          select: {
            id: true,
            externalId: true,
            externalUrl: true,
            metadataJson: true,
          },
        });

        return plain(links);
      }

      // WORKFLOW_RUN: find all task runs, then their external links
      const taskRuns = await prisma.workflowTaskRun.findMany({
        where: {
          workflowRunId: input.entityId,
          organizationId: ctx.organizationId,
        },
        select: { id: true },
      });

      if (taskRuns.length === 0) return [];

      const links = await prisma.externalLink.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: "WORKFLOW_TASK_RUN",
          entityId: { in: taskRuns.map((t) => t.id) },
          externalType: "JIRA_ISSUE",
        },
        select: {
          id: true,
          externalId: true,
          externalUrl: true,
          metadataJson: true,
        },
      });

      return plain(links);
    }),

  /**
   * Get recent Jira activity for a contractor.
   */
  recentActivity: tenantProcedure
    .input(
      z.object({
        contractorId: z.string(),
        limit: z.number().min(1).max(20).default(5),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Find all workflow runs for this contractor
      const runs = await prisma.workflowRun.findMany({
        where: {
          contractorId: input.contractorId,
          organizationId: ctx.organizationId,
        },
        select: { id: true },
      });

      if (runs.length === 0) return [];

      // Get all task run IDs
      const taskRuns = await prisma.workflowTaskRun.findMany({
        where: {
          workflowRunId: { in: runs.map((r) => r.id) },
        },
        select: { id: true },
      });

      if (taskRuns.length === 0) return [];

      // Find recent Jira-linked external links
      const links = await prisma.externalLink.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: "WORKFLOW_TASK_RUN",
          entityId: { in: taskRuns.map((t) => t.id) },
          externalType: "JIRA_ISSUE",
        },
        orderBy: { updatedAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          externalId: true,
          externalUrl: true,
          metadataJson: true,
          updatedAt: true,
        },
      });

      return plain(links);
    }),

  // =========================================================================
  // Config mutations
  // =========================================================================

  /**
   * Save a status mapping for a Jira project.
   * After saving, registers/updates webhooks for all projects with mappings.
   */
  saveStatusMapping: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(saveJiraStatusMappingInputSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await loadConnection(
        input.connectionId,
        ctx.organizationId,
      );

      await saveStatusMapping(
        prisma,
        input.connectionId,
        input.projectId,
        input.mappings,
      );

      // Re-register webhooks for all projects that have status mappings
      const config =
        (connection.configJson as JiraConnectionConfig) ?? {};
      const statusMappings = config.statusMappings ?? {};

      // Include the just-saved project
      if (!statusMappings[input.projectId]) {
        statusMappings[input.projectId] = input.mappings;
      }

      const projectKeys = Object.keys(statusMappings);
      if (projectKeys.length > 0) {
        try {
          // Gather project keys from Jira (we need keys, not IDs, for JQL)
          // The project IDs in statusMappings keys need to be resolved to keys
          // For now, use the project IDs directly in JQL (Jira accepts both)
          await registerJiraWebhooks(prisma, input.connectionId, projectKeys);
        } catch (error) {
          console.error(
            "[jira.saveStatusMapping] Failed to register webhooks:",
            error,
          );
          // Don't fail the save — webhooks can be retried
        }
      }

      return { success: true };
    }),

  /**
   * Save Jira configuration for a workflow task template.
   */
  saveTaskConfig: tenantProcedure
    .use(requirePermission({ workflow: ["update"] }))
    .input(saveJiraTaskConfigInputSchema)
    .mutation(async ({ ctx, input }) => {
      const template = await prisma.workflowTaskTemplate.findFirst({
        where: {
          id: input.taskTemplateId,
          organizationId: ctx.organizationId,
        },
        select: { configJson: true },
      });

      if (!template) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.WORKFLOW_TEMPLATE_NOT_FOUND,
        });
      }

      const existingConfig =
        (template.configJson as Record<string, unknown>) ?? {};

      await prisma.workflowTaskTemplate.update({
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
   * Disconnect Jira integration.
   * Deregisters webhooks and sets connection status to DISCONNECTED.
   */
  disconnect: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await prisma.integrationConnection.findFirst({
        where: {
          id: input.connectionId,
          organizationId: ctx.organizationId,
          provider: "JIRA",
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.INTEGRATION_NOT_FOUND,
        });
      }

      // Deregister webhooks first (best effort)
      try {
        await deregisterJiraWebhooks(prisma, input.connectionId);
      } catch (error) {
        console.error(
          "[jira.disconnect] Failed to deregister webhooks:",
          error,
        );
      }

      await prisma.integrationConnection.update({
        where: { id: connection.id },
        data: { status: "DISCONNECTED" },
      });

      return { success: true };
    }),
});
