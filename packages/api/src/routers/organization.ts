import { authApi } from '@contractor-ops/auth';
import {
  createOrganizationSchema,
  updateOrganizationSettingsSchema,
} from '@contractor-ops/validators';
import { publicProcedure, router } from '../init.js';
import { adminProcedure } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';

export const organizationRouter = router({
  /**
   * Create a new organization (used during sign-up flow).
   * Public procedure because the user may not have an active org yet.
   * After creation, sets the new org as active in the session.
   */
  create: publicProcedure.input(createOrganizationSchema).mutation(async ({ ctx, input }) => {
    // Default language by countryCode — DE orgs get German UI by default (Phase 56 D-11).
    // User can switch via language selector at any time.
    const defaultLanguage =
      input.countryCode === 'DE' ? 'de' : input.countryCode === 'GB' ? 'en' : undefined;

    const org = await authApi.createOrganization({
      headers: ctx.headers,
      body: {
        name: input.name,
        slug: input.name.toLowerCase().replace(/\s+/g, '-'),
        metadata: {
          countryCode: input.countryCode,
          defaultCurrency: input.defaultCurrency,
          timezone: input.timezone,
          ...(defaultLanguage && { language: defaultLanguage }),
        },
      },
    });

    // Set the new organization as active
    await authApi.setActiveOrganization({
      headers: ctx.headers,
      body: { organizationId: org.id },
    });

    return org;
  }),

  /**
   * Get the current active organization details.
   * Requires authenticated user with an active organization.
   */
  getCurrent: tenantProcedure.query(async ({ ctx }) => {
    const org = await authApi.getFullOrganization({
      headers: ctx.headers,
      query: { organizationId: ctx.organizationId },
    });

    return org;
  }),

  /**
   * Update organization settings.
   * Requires admin-level organization permissions.
   */
  update: adminProcedure
    .input(updateOrganizationSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }

      // Store extended settings in metadata
      const metadataUpdates: Record<string, unknown> = {};
      if (input.legalName !== undefined) metadataUpdates.legalName = input.legalName;
      if (input.fiscalYearStartMonth !== undefined)
        metadataUpdates.fiscalYearStartMonth = input.fiscalYearStartMonth;
      if (input.billingEmail !== undefined) metadataUpdates.billingEmail = input.billingEmail;
      if (input.language !== undefined) metadataUpdates.language = input.language;

      if (Object.keys(metadataUpdates).length > 0) {
        updateData.metadata = metadataUpdates;
      }

      const updated = await authApi.updateOrganization({
        headers: ctx.headers,
        body: {
          organizationId: ctx.organizationId,
          data: updateData,
        },
      });

      return updated;
    }),
});
