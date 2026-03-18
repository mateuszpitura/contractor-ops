import { auth } from "@contractor-ops/auth";
import { updateOrganizationSettingsSchema } from "@contractor-ops/validators";
import { router } from "../init";
import { tenantProcedure } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { sensitiveActionProcedure } from "../middleware/sensitive";

export const settingsRouter = router({
  /**
   * Get organization settings.
   * Returns fiscal year, branding, notification defaults, and language.
   */
  get: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .query(async ({ ctx }) => {
      const org = await auth.api.getFullOrganization({
        headers: ctx.headers,
        query: { organizationId: ctx.organizationId },
      });

      return {
        id: org?.id,
        name: org?.name,
        metadata: org?.metadata,
      };
    }),

  /**
   * Update organization settings.
   * Sensitive action: requires re-authentication if session > 5 minutes old.
   */
  update: sensitiveActionProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(updateOrganizationSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const metadataUpdates: Record<string, unknown> = {};

      if (input.legalName !== undefined)
        metadataUpdates.legalName = input.legalName;
      if (input.fiscalYearStartMonth !== undefined)
        metadataUpdates.fiscalYearStartMonth = input.fiscalYearStartMonth;
      if (input.billingEmail !== undefined)
        metadataUpdates.billingEmail = input.billingEmail;
      if (input.language !== undefined)
        metadataUpdates.language = input.language;

      const data: {
        name?: string;
        slug?: string;
        logo?: string;
        metadata?: Record<string, unknown>;
      } = {};

      if (input.name !== undefined) {
        data.name = input.name;
      }

      if (Object.keys(metadataUpdates).length > 0) {
        data.metadata = metadataUpdates;
      }

      const updated = await auth.api.updateOrganization({
        headers: ctx.headers,
        body: {
          organizationId: ctx.organizationId,
          data,
        },
      });

      return updated;
    }),
});
