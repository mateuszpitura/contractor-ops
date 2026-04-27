import { authApi } from '@contractor-ops/auth';
import {
  createOrganizationSchema,
  updateOrganizationSettingsSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { publicProcedure, router } from '../../init.js';
import { adminProcedure, requirePermission } from '../../middleware/rbac.js';
import { tenantProcedure } from '../../middleware/tenant.js';
import { runPostOrganizationCreateHooks } from '../../services/post-org-create-hook.js';

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

    // Phase 74 — Materialise the 4 KT seed templates for the new org.
    // Hook is fire-and-forget at the API boundary — internal failures are
    // logged via createLogger but do NOT re-throw so org creation is robust.
    await runPostOrganizationCreateHooks(ctx.db, org.id);

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

  // ---------------------------------------------------------------------------
  // Phase 57 · Plan 04 — Kleinunternehmerregelung toggle (DE-only; D-11)
  // ---------------------------------------------------------------------------
  //
  // Flipping this flag has material invoice-generation consequences
  // (forced `KU` rate on all lines, suppressed VAT breakdown, `§ 19 UStG`
  // footer notice). The UI wraps this mutation in an AlertDialog.
  //
  // Country gate: DE only. UK / other-country orgs attempting to call this
  // receive FORBIDDEN — Kleinunternehmerregelung is a German-law construct
  // with no analogue in other jurisdictions.
  // ---------------------------------------------------------------------------
  setKleinunternehmer: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { countryCode: true },
      });
      if (org.countryCode !== 'DE') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Kleinunternehmerregelung is only available for German organizations',
        });
      }
      const updated = await ctx.db.organization.update({
        where: { id: ctx.organizationId },
        data: { isKleinunternehmer: input.enabled },
        select: { isKleinunternehmer: true },
      });
      return { isKleinunternehmer: updated.isKleinunternehmer };
    }),
});
