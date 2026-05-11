import { authApi } from '@contractor-ops/auth';
import { getRegionalClient } from '@contractor-ops/db';
import {
  createOrganizationSchema,
  updateOrganizationSettingsSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init';
import { authedProcedure } from '../../middleware/auth';
import { orgCreateRateLimitMiddleware } from '../../middleware/org-create-rate-limit';
import { adminProcedure, requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { getOrgMeta } from '../../services/org-cache';
import { runPostOrganizationCreateHooks } from '../../services/post-org-create-hook';

export const organizationRouter = router({
  /**
   * Create a new organization (used during sign-up flow and from the
   * org-switcher when an existing user spins up an additional workspace).
   *
   * Authenticated, but NOT tenant-scoped — `authedProcedure` requires a
   * Better Auth session yet does not require an active organization on the
   * caller's session, since this mutation is precisely how a brand-new user
   * acquires their first org. Better Auth's `authApi.createOrganization`
   * also enforces the same session requirement defensively.
   *
   * Rate-limited (NEW-SEC-05): 5 organizations per 24h per user. Closes the
   * abuse vector where a single signed-in user spams org creation to fill
   * the slug namespace and trigger expensive post-create hooks.
   *
   * After creation, sets the new org as active in the session.
   */
  create: authedProcedure
    .use(orgCreateRateLimitMiddleware)
    .input(createOrganizationSchema)
    .mutation(async ({ ctx, input }) => {
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
      //
      // `authedProcedure` does not provide a tenant-scoped `ctx.db` (the
      // caller may not yet have an active org), so we resolve a region-aware
      // Prisma client directly from the freshly-created Organization row.
      // The hook itself only needs raw Prisma access to upsert seed rows
      // keyed by `organizationId`; it does not benefit from the tenant
      // extension layered on top of `ctx.db`.
      const meta = await getOrgMeta(org.id);
      const regionalPrisma = getRegionalClient(meta?.dataRegion ?? 'EU');
      await runPostOrganizationCreateHooks(regionalPrisma, org.id);

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

      // F-OBS-05 — org name / billing email / fiscal year changes affect
      // billing, branding and legal contracts. Audit is required.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'ORGANIZATION_UPDATE',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        newValues: updateData,
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

      // F-OBS-05 — Kleinunternehmer toggle changes invoice generation
      // (forced KU rate, suppressed VAT, § 19 UStG footer). Tax-relevant
      // changes are audit-worthy.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'ORGANIZATION_KLEINUNTERNEHMER_TOGGLE',
        resourceType: 'ORGANIZATION',
        resourceId: ctx.organizationId,
        newValues: { isKleinunternehmer: updated.isKleinunternehmer },
      });

      return { isKleinunternehmer: updated.isKleinunternehmer };
    }),
});
