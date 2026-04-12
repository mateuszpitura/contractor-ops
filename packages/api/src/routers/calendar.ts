import { calendarTaskConfigSchema } from "@contractor-ops/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../init.js";
import { requirePermission } from "../middleware/rbac.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requireTier } from "../middleware/tier.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CALENDAR_PROVIDERS = ["GOOGLE_CALENDAR", "OUTLOOK_CALENDAR"] as const;
const CALENDAR_EVENT_TYPES = ["GOOGLE_CALENDAR_EVENT", "OUTLOOK_CALENDAR_EVENT"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Calendar Router
// ---------------------------------------------------------------------------

export const calendarRouter = router({
  // =========================================================================
  // Connection queries
  // =========================================================================

  /**
   * List all calendar connections for the organization.
   * Includes both org-level (userId null) and personal (userId = current user) connections.
   */
  listConnections: tenantProcedure.query(async ({ ctx }) => {
    const connections = await ctx.db.integrationConnection.findMany({
      where: {
        organizationId: ctx.organizationId,
        provider: { in: [...CALENDAR_PROVIDERS] },
        OR: [{ userId: ctx.user?.id }, { userId: null }],
      },
      select: {
        id: true,
        provider: true,
        status: true,
        displayName: true,
        connectedAt: true,
        userId: true,
        tokenExpiresAt: true,
      },
      orderBy: { connectedAt: "desc" },
    });

    return plain(connections);
  }),

  /**
   * List only personal calendar connections for the current user.
   */
  listPersonalConnections: tenantProcedure.query(async ({ ctx }) => {
    const connections = await ctx.db.integrationConnection.findMany({
      where: {
        organizationId: ctx.organizationId,
        userId: ctx.user?.id,
        provider: { in: [...CALENDAR_PROVIDERS] },
      },
      select: {
        id: true,
        provider: true,
        status: true,
        displayName: true,
        connectedAt: true,
        userId: true,
        tokenExpiresAt: true,
      },
      orderBy: { connectedAt: "desc" },
    });

    return plain(connections);
  }),

  /**
   * Disconnect a calendar connection.
   *
   * Users can disconnect their own personal connections.
   * Org-level connections require admin permission.
   * Existing calendar events are NOT removed (per UI spec).
   */
  disconnect: tenantProcedure
    .use(requireTier("PRO"))
    .input(z.object({ connectionId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.integrationConnection.findFirst({
        where: {
          id: input.connectionId,
          organizationId: ctx.organizationId,
          provider: { in: [...CALENDAR_PROVIDERS] },
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "INTEGRATION_NOT_FOUND",
        });
      }

      // Users can only disconnect their own personal connections
      // Org-level connections (userId = null) require settings:update permission
      if (connection.userId !== null && connection.userId !== ctx.user?.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "PERMISSION_DENIED",
        });
      }

      await ctx.db.integrationConnection.update({
        where: { id: connection.id },
        data: { status: "DISCONNECTED" },
      });

      return { success: true };
    }),

  // =========================================================================
  // Event queries
  // =========================================================================

  /**
   * Count calendar events created by the system for this organization.
   */
  listEvents: tenantProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.externalLink.count({
      where: {
        organizationId: ctx.organizationId,
        externalType: { in: [...CALENDAR_EVENT_TYPES] },
      },
    });

    return { count };
  }),

  // =========================================================================
  // Deadline sync mutations
  // =========================================================================

  // =========================================================================
  // Task config CRUD
  // =========================================================================

  /**
   * Get calendar configuration for a workflow task template.
   * Parses calendarTaskConfigSchema from the template's configJson.
   */
  getTaskConfig: tenantProcedure
    .input(z.object({ taskTemplateId: z.string().cuid() }))
    .query(async ({ input }) => {
      const template = await ctx.db.workflowTaskTemplate.findUnique({
        where: { id: input.taskTemplateId },
        select: { configJson: true },
      });

      if (!template?.configJson) {
        return { calendarEnabled: false, duration: "1h" as const, attendees: [] };
      }

      const config = template.configJson as Record<string, unknown>;
      const parsed = calendarTaskConfigSchema.safeParse(config);
      return parsed.success
        ? parsed.data
        : { calendarEnabled: false, duration: "1h" as const, attendees: [] };
    }),

  /**
   * Save calendar configuration for a workflow task template.
   * Merges with existing configJson to preserve Jira and other config fields.
   */
  saveTaskConfig: tenantProcedure
    .use(requirePermission({ workflow: ["update"] }))
    .use(requireTier("PRO"))
    .input(
      z.object({
        taskTemplateId: z.string().cuid(),
        config: calendarTaskConfigSchema,
      }),
    )
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
          code: "NOT_FOUND",
          message: "WORKFLOW_TEMPLATE_NOT_FOUND",
        });
      }

      // Merge: preserve existing fields (e.g., Jira config) while updating calendar fields
      const existingConfig = (template.configJson as Record<string, unknown>) ?? {};

      await ctx.db.workflowTaskTemplate.update({
        where: { id: input.taskTemplateId },
        data: {
          configJson: {
            ...existingConfig,
            calendarEnabled: input.config.calendarEnabled,
            titleTemplate: input.config.titleTemplate,
            duration: input.config.duration,
            attendees: input.config.attendees,
          },
        },
      });

      return { success: true };
    }),
});
