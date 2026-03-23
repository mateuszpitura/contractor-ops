import { z } from "zod";
import { auth } from "@contractor-ops/auth";
import { prisma } from "@contractor-ops/db";
import {
  updateOrganizationSettingsSchema,
  orgExpiryReminderDefaultsSchema,
} from "@contractor-ops/validators";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import { sensitiveActionProcedure } from "../middleware/sensitive.js";

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
        slug: org?.slug,
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
      if (input.onboardingCompletedSteps !== undefined)
        metadataUpdates.onboardingCompletedSteps =
          input.onboardingCompletedSteps;
      if (input.onboardingDismissed !== undefined)
        metadataUpdates.onboardingDismissed = input.onboardingDismissed;

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

  /**
   * Get org-level default expiry reminder intervals for contracts.
   * Falls back to [30, 60, 90] if not configured.
   */
  getExpiryReminderDefaults: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .query(async ({ ctx }) => {
      const org = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true },
      });

      const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
      const reminderDaysBefore =
        (settings.contractExpiryReminderDaysBefore as number[]) ?? [30, 60, 90];

      return { reminderDaysBefore };
    }),

  /**
   * Update org-level default expiry reminder intervals for contracts.
   */
  updateExpiryReminderDefaults: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(orgExpiryReminderDefaultsSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true },
      });

      const currentSettings =
        (org?.settingsJson as Record<string, unknown>) ?? {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newSettings: any = {
        ...currentSettings,
        contractExpiryReminderDaysBefore: input.reminderDaysBefore,
      };

      await prisma.organization.update({
        where: { id: ctx.organizationId },
        data: {
          settingsJson: newSettings,
        },
      });

      return { reminderDaysBefore: input.reminderDaysBefore };
    }),

  /**
   * Get invoice matching settings (deviation threshold).
   * Falls back to 10% if not configured.
   */
  getInvoiceSettings: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .query(async ({ ctx }) => {
      const org = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true },
      });

      const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
      const invoiceDeviationThresholdPercent =
        (settings.invoiceDeviationThresholdPercent as number) ?? 10;

      return { invoiceDeviationThresholdPercent };
    }),

  /**
   * Update invoice matching settings (deviation threshold).
   */
  updateInvoiceSettings: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(
      z.object({
        invoiceDeviationThresholdPercent: z.number().int().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true },
      });

      const currentSettings =
        (org?.settingsJson as Record<string, unknown>) ?? {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newSettings: any = {
        ...currentSettings,
        invoiceDeviationThresholdPercent:
          input.invoiceDeviationThresholdPercent,
      };

      await prisma.organization.update({
        where: { id: ctx.organizationId },
        data: {
          settingsJson: newSettings,
        },
      });

      return {
        invoiceDeviationThresholdPercent:
          input.invoiceDeviationThresholdPercent,
      };
    }),
});
