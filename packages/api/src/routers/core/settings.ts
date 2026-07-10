import { authApi } from '@contractor-ops/auth';
import type { Prisma } from '@contractor-ops/db/generated/prisma/client';
import {
  getServerEnv,
  orgBankInfoSchema,
  orgExpiryReminderDefaultsSchema,
  updateOrganizationSettingsSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { auditedMutation, auditMutationCtx } from '../../lib/audited-mutation';
import { requirePermission } from '../../middleware/rbac';
import { sensitiveActionProcedure } from '../../middleware/sensitive';
import { tenantProcedure } from '../../middleware/tenant';
import { CacheKeys, CacheTTL, cached, invalidateByPrefix } from '../../services/cache';
import { approveChangeRequest, rejectChangeRequest } from '../../services/portal-change-request';
import { createRegionalPresignedUploadUrl } from '../../services/regional-storage';

export const settingsRouter = router({
  /**
   * Get organization settings.
   * Returns fiscal year, branding, notification defaults, and language.
   */
  get: tenantProcedure.use(requirePermission({ settings: ['read'] })).query(async ({ ctx }) => {
    return cached(CacheKeys.orgSettings(ctx.organizationId), CacheTTL.ORG_SETTINGS, async () => {
      const org = await authApi.getFullOrganization({
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
      if (input.dateFormat !== undefined) metadataUpdates.dateFormat = input.dateFormat;
      if (input.timeFormat !== undefined) metadataUpdates.timeFormat = input.timeFormat;
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

      const updated = await authApi.updateOrganization({
        headers: ctx.headers,
        body: {
          organizationId: ctx.organizationId,
          data,
        },
      });

      // Invalidate all settings caches for this org
      void invalidateByPrefix(CacheKeys.settingsPrefix(ctx.organizationId));

      // settings.update changes org name/legal name/billing email and other
      // tenant-wide settings; audited for the same reasons as organization.update.
      await auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'SETTINGS_UPDATE',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          newValues: data,
        },
        async () => updated,
      );

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

      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'SETTINGS_EXPIRY_REMINDERS_UPDATE',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          oldValues: {
            reminderDaysBefore: (currentSettings.contractExpiryReminderDaysBefore as number[]) ?? [
              30, 60, 90,
            ],
          },
          newValues: { reminderDaysBefore: input.reminderDaysBefore },
        },
        async tx => {
          await tx.organization.update({
            where: { id: ctx.organizationId },
            data: {
              settingsJson: newSettings as Prisma.InputJsonValue,
            },
          });
          void invalidateByPrefix(CacheKeys.settingsPrefix(ctx.organizationId));
          return { reminderDaysBefore: input.reminderDaysBefore };
        },
      );
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

      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'SETTINGS_INVOICE_THRESHOLD_UPDATE',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          oldValues: {
            invoiceDeviationThresholdPercent:
              (currentSettings.invoiceDeviationThresholdPercent as number) ?? 10,
          },
          newValues: { invoiceDeviationThresholdPercent: input.invoiceDeviationThresholdPercent },
        },
        async tx => {
          await tx.organization.update({
            where: { id: ctx.organizationId },
            data: {
              settingsJson: newSettings as Prisma.InputJsonValue,
            },
          });
          void invalidateByPrefix(CacheKeys.settingsPrefix(ctx.organizationId));
          return {
            invoiceDeviationThresholdPercent: input.invoiceDeviationThresholdPercent,
          };
        },
      );
    }),

  /**
   * Get organization debtor bank details for SEPA/SWIFT exports.
   */
  getOrgBankAccount: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      return cached(
        CacheKeys.orgSettingsJson(ctx.organizationId, 'bank'),
        CacheTTL.ORG_SETTINGS_JSON,
        async () => {
          const org = await ctx.db.organization.findUnique({
            where: { id: ctx.organizationId },
            select: { settingsJson: true },
          });

          const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
          const parsed = orgBankInfoSchema.safeParse(settings.bankAccount ?? {});
          return parsed.success ? parsed.data : { iban: undefined, bic: undefined };
        },
      );
    }),

  /**
   * Update organization debtor IBAN/BIC used as the SEPA debtor account.
   */
  updateOrgBankAccount: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(orgBankInfoSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true },
      });

      const currentSettings = (org?.settingsJson as Record<string, unknown>) ?? {};
      const previousBank =
        (currentSettings.bankAccount as Record<string, unknown> | undefined) ?? {};

      const newSettings: Record<string, unknown> = {
        ...currentSettings,
        bankAccount: {
          ...previousBank,
          ...(input.iban === undefined ? {} : { iban: input.iban }),
          ...(input.bic === undefined ? {} : { bic: input.bic }),
        },
      };

      // Record only the NAMES of the fields that changed — never the IBAN/BIC
      // values themselves. Audit rows are not encrypted at rest, so persisting
      // the plaintext debtor IBAN there would re-leak it outside the org's
      // settings blob.
      const fieldsUpdated = [
        ...(input.iban === undefined ? [] : ['iban']),
        ...(input.bic === undefined ? [] : ['bic']),
      ];

      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'SETTINGS_ORG_BANK_ACCOUNT_UPDATE',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          metadata: { fieldsUpdated },
        },
        async tx => {
          await tx.organization.update({
            where: { id: ctx.organizationId },
            data: {
              settingsJson: newSettings as Prisma.InputJsonValue,
            },
          });
          void invalidateByPrefix(CacheKeys.settingsPrefix(ctx.organizationId));
          const parsed = orgBankInfoSchema.safeParse(newSettings.bankAccount);
          return parsed.success ? parsed.data : { iban: undefined, bic: undefined };
        },
      );
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
   *
   * Accepts image/png, image/jpeg, image/webp. Max 2MB enforced client-side.
   *
   * `image/svg+xml` is deliberately NOT in this allow-list. SVG is an XML
   * document type and can carry `<script>` / `<foreignObject>` payloads —
   * uploading a malicious SVG into the public R2 bucket would yield a
   * stored XSS on `*.r2.cloudflarestorage.com` (the bucket's serving
   * origin) whenever someone opens the logo URL directly in a tab. The
   * SPA only ever renders the logo inside `<img src>` where the browser
   * disables scripting, but a direct fetch by any link share would
   * execute. The presigned-PUT upload flow never gives the server a
   * chance to sanitize before publish, so the only safe path is to
   * exclude SVG entirely. Re-enabling SVG support requires a server-side
   * sanitization step (DOMPurify with SVG profile) on a non-presigned
   * upload path.
   */
  getLogoUploadUrl: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(
      z.object({
        filename: z.string(),
        contentType: z
          .string()
          .refine(
            ct => ['image/png', 'image/jpeg', 'image/webp'].includes(ct),
            'Must be PNG, JPEG, or WEBP',
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ext = input.filename.split('.').pop() ?? 'png';
      const key = `orgs/${ctx.organizationId}/branding/logo.${ext}`;
      const uploadUrl = await createRegionalPresignedUploadUrl(key, input.contentType);
      // Public URL for R2 (bucket public access)
      const publicUrl = `${getServerEnv().R2_PUBLIC_URL ?? ''}/${key}`;
      return { uploadUrl, publicUrl, storageKey: key };
    }),

  /**
   * Update organization brand color and logo URL.
   * Merges brandColor into settingsJson, updates logo field.
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
        logoUrl: z.url().optional().nullable(),
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
        updateData.settingsJson = newSettings as Prisma.InputJsonValue;
      }
      if (input.logoUrl !== undefined) {
        updateData.logo = input.logoUrl;
      }

      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'SETTINGS_BRANDING_UPDATE',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          oldValues: {
            brandColor: (currentSettings.brandColor as string) ?? null,
            logo: org?.logo ?? null,
          },
          newValues: {
            brandColor: (newSettings.brandColor as string) ?? null,
            logo: input.logoUrl === undefined ? (org?.logo ?? null) : input.logoUrl,
          },
        },
        async tx => {
          await tx.organization.update({
            where: { id: ctx.organizationId },
            data: updateData,
          });
          void invalidateByPrefix(CacheKeys.settingsPrefix(ctx.organizationId));
          return {
            brandColor: (newSettings.brandColor as string) ?? null,
            logo: input.logoUrl === undefined ? (org?.logo ?? null) : input.logoUrl,
          };
        },
      );
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

      const previous = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { portalSubdomain: true },
      });

      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'SETTINGS_PORTAL_DOMAIN_UPDATE',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          oldValues: { portalSubdomain: previous?.portalSubdomain ?? null },
          newValues: { portalSubdomain: input.portalSubdomain ?? null },
        },
        async tx => {
          await tx.organization.update({
            where: { id: ctx.organizationId },
            data: { portalSubdomain: input.portalSubdomain ?? null },
          });
          return { success: true as const };
        },
      );
    }),

  // =========================================================================
  // CHANGE REQUEST REVIEW (admin)
  // =========================================================================

  /**
   * List contractor change requests for the organization.
   * Optionally filter by status. Includes contractor display info.
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
      const reviewerId = ctx.user.id;

      if (input.action === 'approve') {
        await approveChangeRequest(input.requestId, ctx.organizationId, reviewerId, input.comment);
      } else {
        await rejectChangeRequest(input.requestId, ctx.organizationId, reviewerId, input.comment);
      }

      // Change-request review is a tenant-data approval/rejection step
      // that admins must be able to retrace.
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: input.action === 'approve' ? 'CHANGE_REQUEST_APPROVE' : 'CHANGE_REQUEST_REJECT',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          metadata: {
            changeRequestId: input.requestId,
            ...(input.comment ? { comment: input.comment } : {}),
          },
        },
        async () => ({ success: true as const }),
      );
    }),
});
