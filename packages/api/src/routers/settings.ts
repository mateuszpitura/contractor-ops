import { auth } from '@contractor-ops/auth';
import type { Prisma } from '@contractor-ops/db/generated/prisma/client';
import {
  orgExpiryReminderDefaultsSchema,
  updateOrganizationSettingsSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../errors.js';
import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { sensitiveActionProcedure } from '../middleware/sensitive.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { CacheKeys, CacheTTL, cached, invalidateByPrefix } from '../services/cache.js';
import { approveChangeRequest, rejectChangeRequest } from '../services/portal-change-request.js';
import { createRegionalPresignedUploadUrl } from '../services/regional-storage.js';

export const settingsRouter = router({
  /**
   * Get organization settings.
   * Returns fiscal year, branding, notification defaults, and language.
   */
  get: tenantProcedure.use(requirePermission({ settings: ['read'] })).query(async ({ ctx }) => {
    return cached(CacheKeys.orgSettings(ctx.organizationId), CacheTTL.ORG_SETTINGS, async () => {
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
    });
  }),

  /**
   * Update organization settings.
   * Sensitive action: requires re-authentication if session > 5 minutes old.
   */
  update: sensitiveActionProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(updateOrganizationSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const metadataUpdates: Record<string, unknown> = {};

      if (input.legalName !== undefined) metadataUpdates.legalName = input.legalName;
      if (input.fiscalYearStartMonth !== undefined)
        metadataUpdates.fiscalYearStartMonth = input.fiscalYearStartMonth;
      if (input.billingEmail !== undefined) metadataUpdates.billingEmail = input.billingEmail;
      if (input.language !== undefined) metadataUpdates.language = input.language;
      if (input.onboardingCompletedSteps !== undefined)
        metadataUpdates.onboardingCompletedSteps = input.onboardingCompletedSteps;
      if (input.onboardingDismissed !== undefined)
        metadataUpdates.onboardingDismissed = input.onboardingDismissed;
      if (input.defaultReturnCarrier !== undefined)
        metadataUpdates.defaultReturnCarrier = input.defaultReturnCarrier;

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

      // Invalidate all settings caches for this org
      void invalidateByPrefix(CacheKeys.settingsPrefix(ctx.organizationId));

      return updated;
    }),

  /**
   * Get org-level default expiry reminder intervals for contracts.
   * Falls back to [30, 60, 90] if not configured.
   */
  getExpiryReminderDefaults: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      return cached(
        CacheKeys.orgSettingsJson(ctx.organizationId, 'expiry'),
        CacheTTL.ORG_SETTINGS_JSON,
        async () => {
          const org = await ctx.db.organization.findUnique({
            where: { id: ctx.organizationId },
            select: { settingsJson: true },
          });

          const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
          const reminderDaysBefore = (settings.contractExpiryReminderDaysBefore as number[]) ?? [
            30, 60, 90,
          ];

          return { reminderDaysBefore };
        },
      );
    }),

  /**
   * Update org-level default expiry reminder intervals for contracts.
   */
  updateExpiryReminderDefaults: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(orgExpiryReminderDefaultsSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true },
      });

      const currentSettings = (org?.settingsJson as Record<string, unknown>) ?? {};

      const newSettings: Record<string, unknown> = {
        ...currentSettings,
        contractExpiryReminderDaysBefore: input.reminderDaysBefore,
      };

      await ctx.db.organization.update({
        where: { id: ctx.organizationId },
        data: {
          settingsJson: newSettings as Prisma.InputJsonValue,
        },
      });

      void invalidateByPrefix(CacheKeys.settingsPrefix(ctx.organizationId));

      return { reminderDaysBefore: input.reminderDaysBefore };
    }),

  /**
   * Get invoice matching settings (deviation threshold).
   * Falls back to 10% if not configured.
   */
  getInvoiceSettings: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      return cached(
        CacheKeys.orgSettingsJson(ctx.organizationId, 'invoice'),
        CacheTTL.ORG_SETTINGS_JSON,
        async () => {
          const org = await ctx.db.organization.findUnique({
            where: { id: ctx.organizationId },
            select: { settingsJson: true },
          });

          const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
          const invoiceDeviationThresholdPercent =
            (settings.invoiceDeviationThresholdPercent as number) ?? 10;

          return { invoiceDeviationThresholdPercent };
        },
      );
    }),

  /**
   * Update invoice matching settings (deviation threshold).
   */
  updateInvoiceSettings: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(
      z.object({
        invoiceDeviationThresholdPercent: z.number().int().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true },
      });

      const currentSettings = (org?.settingsJson as Record<string, unknown>) ?? {};

      const newSettings: Record<string, unknown> = {
        ...currentSettings,
        invoiceDeviationThresholdPercent: input.invoiceDeviationThresholdPercent,
      };

      await ctx.db.organization.update({
        where: { id: ctx.organizationId },
        data: {
          settingsJson: newSettings as Prisma.InputJsonValue,
        },
      });

      void invalidateByPrefix(CacheKeys.settingsPrefix(ctx.organizationId));

      return {
        invoiceDeviationThresholdPercent: input.invoiceDeviationThresholdPercent,
      };
    }),

  // =========================================================================
  // BRANDING (admin)
  // =========================================================================

  /**
   * Get current organization branding (brand color + logo URL).
   * Used by admin branding section to populate form.
   */
  getBranding: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      return cached(CacheKeys.orgBranding(ctx.organizationId), CacheTTL.ORG_BRANDING, async () => {
        const org = await ctx.db.organization.findUnique({
          where: { id: ctx.organizationId },
          select: { logo: true, settingsJson: true },
        });

        const settings = (org?.settingsJson as Record<string, unknown>) ?? {};

        return {
          brandColor: (settings.brandColor as string) ?? null,
          logo: org?.logo ?? null,
        };
      });
    }),

  /**
   * Get a presigned upload URL for organization logo.
   * Accepts image/png, image/jpeg, image/svg+xml. Max 2MB enforced client-side.
   */
  getLogoUploadUrl: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(
      z.object({
        filename: z.string(),
        contentType: z
          .string()
          .refine(
            ct => ['image/png', 'image/jpeg', 'image/svg+xml'].includes(ct),
            'Must be PNG, JPEG, or SVG',
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ext = input.filename.split('.').pop() ?? 'png';
      const key = `orgs/${ctx.organizationId}/branding/logo.${ext}`;
      const uploadUrl = await createRegionalPresignedUploadUrl(key, input.contentType);
      // Public URL for R2 (bucket public access)
      const publicUrl = `${process.env.R2_PUBLIC_URL ?? ''}/${key}`;
      return { uploadUrl, publicUrl, storageKey: key };
    }),

  /**
   * Update organization brand color and logo URL.
   * Merges brandColor into settingsJson, updates logo field.
   * Per D-09, D-11.
   */
  updateBranding: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(
      z.object({
        brandColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color')
          .optional()
          .nullable(),
        logoUrl: z.string().url().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true, logo: true },
      });

      const currentSettings = (org?.settingsJson as Record<string, unknown>) ?? {};

      // Merge brandColor into settingsJson
      const newSettings: Record<string, unknown> = { ...currentSettings };
      if (input.brandColor !== undefined) {
        if (input.brandColor === null) {
          delete newSettings.brandColor;
        } else {
          newSettings.brandColor = input.brandColor;
        }
      }

      // Build update data
      const updateData: { settingsJson?: Prisma.InputJsonValue; logo?: string | null } = {};

      if (input.brandColor !== undefined) {
        updateData.settingsJson = newSettings;
      }
      if (input.logoUrl !== undefined) {
        updateData.logo = input.logoUrl;
      }

      await ctx.db.organization.update({
        where: { id: ctx.organizationId },
        data: updateData,
      });

      void invalidateByPrefix(CacheKeys.settingsPrefix(ctx.organizationId));

      return {
        brandColor: (newSettings.brandColor as string) ?? null,
        logo: input.logoUrl === undefined ? (org?.logo ?? null) : input.logoUrl,
      };
    }),

  // =========================================================================
  // PORTAL DOMAIN (admin)
  // =========================================================================

  /**
   * Get the current portal subdomain and custom domain for the organization.
   */
  getPortalDomain: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { slug: true, portalSubdomain: true, portalCustomDomain: true },
      });
      return {
        slug: org?.slug ?? null,
        portalSubdomain: org?.portalSubdomain ?? null,
        portalCustomDomain: org?.portalCustomDomain ?? null,
      };
    }),

  /**
   * Update the portal subdomain for the organization.
   * Validates subdomain format (3-63 chars, lowercase alphanumeric + hyphens)
   * and checks uniqueness across all organizations.
   * Per D-10, PORT-08.
   */
  updatePortalDomain: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(
      z.object({
        portalSubdomain: z
          .string()
          .min(3, 'Subdomain must be at least 3 characters')
          .max(63, 'Subdomain must be at most 63 characters')
          .regex(
            /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
            'Subdomain must contain only lowercase letters, numbers, and hyphens, and must start/end with alphanumeric',
          )
          .optional()
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.portalSubdomain) {
        // Check uniqueness across all orgs
        const existing = await ctx.db.organization.findFirst({
          where: {
            portalSubdomain: input.portalSubdomain,
            id: { not: ctx.organizationId },
          },
        });
        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: E.SETTINGS_SUBDOMAIN_TAKEN,
          });
        }
      }

      await ctx.db.organization.update({
        where: { id: ctx.organizationId },
        data: { portalSubdomain: input.portalSubdomain ?? null },
      });

      return { success: true as const };
    }),

  // =========================================================================
  // CHANGE REQUEST REVIEW (admin)
  // =========================================================================

  /**
   * List contractor change requests for the organization.
   * Optionally filter by status. Includes contractor display info.
   * Per D-03.
   */
  listChangeRequests: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .input(
      z
        .object({
          status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        organizationId: ctx.organizationId,
      };
      if (input?.status) {
        where.status = input.status;
      }

      const requests = await ctx.db.contractorChangeRequest.findMany({
        where,
        include: {
          contractor: {
            select: { displayName: true, email: true },
          },
          reviewedBy: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return requests.map(r => ({
        id: r.id,
        contractorId: r.contractorId,
        contractorName: r.contractor.displayName,
        contractorEmail: r.contractor.email,
        status: r.status,
        requestedChanges: r.requestedChanges,
        previousValues: r.previousValues,
        reviewedBy: r.reviewedBy ? { name: r.reviewedBy.name, email: r.reviewedBy.email } : null,
        reviewedAt: r.reviewedAt,
        reviewComment: r.reviewComment,
        createdAt: r.createdAt,
      }));
    }),

  /**
   * Approve or reject a contractor change request.
   * Delegates to the change request service for transactional approval.
   * Per D-02, D-03.
   */
  reviewChangeRequest: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(
      z.object({
        requestId: z.string(),
        action: z.enum(['approve', 'reject']),
        comment: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // tenantProcedure guarantees user is non-null
      const reviewerId = ctx.user?.id;

      if (input.action === 'approve') {
        await approveChangeRequest(input.requestId, ctx.organizationId, reviewerId, input.comment);
      } else {
        await rejectChangeRequest(input.requestId, ctx.organizationId, reviewerId, input.comment);
      }

      return { success: true as const };
    }),
});
