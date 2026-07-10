// ---------------------------------------------------------------------------
// Saudization config/headcount CRUD + dashboard read-model + drift overrides
// tRPC router.
// ---------------------------------------------------------------------------
//
// Exposes the manual SaudizationConfig + SaudiHeadcount data layer and the
// pure dashboard derivation through tenant-scoped, Zod-validated,
// region-aware procedures. The Nitaqat band is recorded by hand and is NEVER
// auto-computed — `upsertConfig` takes the band verbatim from input. The
// nationalisation rate is derived only from the manual SaudiHeadcount numbers.
//
// Drift overrides (Nitaqat threshold catalogue / permitted-activity catalogue)
// set the `*Custom` flag on SaudizationConfig and writeAuditLog with
// `metadata.custom = true`, recording before/after — this drives the
// "Custom — verify with adviser" badge and gives an adviser-verification trail.
// The audit write joins the same transaction as the flag flip.

import { z } from 'zod';
import { router } from '../../init';
import { requireFeatureFlag, tenantFlaggedProcedure } from '../../middleware/feature-flag';
import { requirePermission } from '../../middleware/rbac';
import { writeAuditLog } from '../../services/audit-writer';
import {
  computeSaudizationDashboard,
  projectOffboardingTrajectory,
} from '../../services/saudization-dashboard';

const ksaIqamaPolicyRuleId = 'ksa.iqama@v1';

const nitaqatBandEnum = z.enum([
  'PLATINUM',
  'HIGH_GREEN',
  'MID_GREEN',
  'LOW_GREEN',
  'YELLOW',
  'RED',
]);

const upsertConfigSchema = z.object({
  /** Manual band entry — verbatim, never auto-derived. Null clears it. */
  band: nitaqatBandEnum.nullish(),
  industrySegment: z.string().trim().max(120).nullish(),
});

const upsertHeadcountSchema = z.object({
  totalHeadcount: z.number().int().nonnegative(),
  saudiHeadcount: z.number().int().nonnegative(),
});

const offboardingTrajectorySchema = z.object({
  offboardingContractorIsSaudi: z.boolean().nullish(),
});

export const saudizationRouter = router({
  /** Read the org's manual Saudization config (band + segment + override flags). */
  getConfig: tenantFlaggedProcedure
    .use(requireFeatureFlag('gulf.saudization-dashboard'))
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) =>
      ctx.db.saudizationConfig.findFirst({
        where: { organizationId: ctx.organizationId },
      }),
    ),

  /**
   * Record the manual Nitaqat band + industry segment. The band is taken from
   * input — there is NO derivation path. `bandLastUpdatedAt` is stamped
   * server-side whenever the band value changes, so the quarterly-reentry window
   * is computed from the real recording instant, never a client clock.
   */
  upsertConfig: tenantFlaggedProcedure
    .use(requireFeatureFlag('gulf.saudization-dashboard'))
    .use(requirePermission({ settings: ['update'] }))
    .input(upsertConfigSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async tx => {
        const existing = await tx.saudizationConfig.findFirst({
          where: { organizationId: ctx.organizationId },
          select: { id: true, band: true },
        });

        const bandChanged = (existing?.band ?? null) !== (input.band ?? null);
        const bandLastUpdatedAt = bandChanged ? new Date() : undefined;

        const config = await tx.saudizationConfig.upsert({
          where: { organizationId: ctx.organizationId },
          create: {
            organizationId: ctx.organizationId,
            band: input.band ?? null,
            industrySegment: input.industrySegment ?? null,
            bandLastUpdatedAt: input.band ? new Date() : null,
          },
          update: {
            band: input.band ?? null,
            industrySegment: input.industrySegment ?? null,
            ...(bandLastUpdatedAt ? { bandLastUpdatedAt } : {}),
          },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'gulf.saudization_config.upsert',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          metadata: {
            configId: config.id,
            band: config.band,
            industrySegment: config.industrySegment,
            bandChanged,
          },
        });

        return config;
      });
    }),

  /**
   * Record a manual org-wide headcount snapshot. The nationalisation rate is
   * derived from these numbers only — never from the platform contractor list.
   */
  upsertHeadcount: tenantFlaggedProcedure
    .use(requireFeatureFlag('gulf.saudization-dashboard'))
    .use(requirePermission({ settings: ['update'] }))
    .input(upsertHeadcountSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async tx => {
        const headcount = await tx.saudiHeadcount.create({
          data: {
            organizationId: ctx.organizationId,
            totalHeadcount: input.totalHeadcount,
            saudiHeadcount: input.saudiHeadcount,
          },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'gulf.saudi_headcount.record',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          metadata: {
            headcountId: headcount.id,
            totalHeadcount: headcount.totalHeadcount,
            saudiHeadcount: headcount.saudiHeadcount,
          },
        });

        return headcount;
      });
    }),

  /**
   * Saudization dashboard read model (GULF-06). Reads the latest manual headcount,
   * the manual config, the per-engagement Qiwa flags, and the reused ksa.iqama F1
   * expiry items via the region-aware ctx.db, then runs the pure Plan 04
   * derivation. Band is surfaced verbatim; rate comes only from manual numbers.
   */
  dashboard: tenantFlaggedProcedure
    .use(requireFeatureFlag('gulf.saudization-dashboard'))
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      const [headcount, config, assignments, iqamaItems] = await Promise.all([
        ctx.db.saudiHeadcount.findFirst({
          where: { organizationId: ctx.organizationId },
          orderBy: { recordedAt: 'desc' },
          select: { totalHeadcount: true, saudiHeadcount: true },
        }),
        ctx.db.saudizationConfig.findFirst({
          where: { organizationId: ctx.organizationId },
          select: { band: true, industrySegment: true, bandLastUpdatedAt: true },
        }),
        ctx.db.contractorAssignment.findMany({
          where: { organizationId: ctx.organizationId, status: 'ACTIVE' },
          select: { isSaudi: true, qiwaContractAuthenticated: true },
        }),
        ctx.db.contractorComplianceItem.findMany({
          where: {
            organizationId: ctx.organizationId,
            policyRuleId: ksaIqamaPolicyRuleId,
          },
          select: { status: true, expiresAt: true },
        }),
      ]);

      return computeSaudizationDashboard({
        headcount: headcount ?? null,
        config: {
          band: config?.band ?? null,
          industrySegment: config?.industrySegment ?? null,
          bandLastUpdatedAt: config?.bandLastUpdatedAt ?? null,
        },
        platformContractors: assignments.map(a => ({
          isSaudi: a.isSaudi,
          qiwaContractAuthenticated: a.qiwaContractAuthenticated,
        })),
        iqamaItems: iqamaItems.map(i => ({ status: i.status, expiresAt: i.expiresAt })),
      });
    }),

  /**
   * Ephemeral offboarding band-trajectory projection. Advisory only — surfaces
   * the recorded band verbatim, never asserts a projected band, never persists,
   * never gates. Reads the latest manual headcount + band.
   */
  offboardingTrajectory: tenantFlaggedProcedure
    .use(requireFeatureFlag('gulf.saudization-dashboard'))
    .use(requirePermission({ settings: ['read'] }))
    .input(offboardingTrajectorySchema)
    .query(async ({ ctx, input }) => {
      const [headcount, config] = await Promise.all([
        ctx.db.saudiHeadcount.findFirst({
          where: { organizationId: ctx.organizationId },
          orderBy: { recordedAt: 'desc' },
          select: { totalHeadcount: true, saudiHeadcount: true },
        }),
        ctx.db.saudizationConfig.findFirst({
          where: { organizationId: ctx.organizationId },
          select: { band: true },
        }),
      ]);

      return projectOffboardingTrajectory({
        headcount: headcount ?? null,
        currentBand: config?.band ?? null,
        offboardingContractorIsSaudi: input.offboardingContractorIsSaudi ?? null,
      });
    }),

  /**
   * GULF-10 — override the seed Nitaqat band thresholds for this org. Flips
   * `thresholdsCustom = true` and writes an audit log with `metadata.custom = true`
   * + before/after, recording the adviser-verification trail (C9). The flag flip
   * + audit write commit atomically in one transaction.
   */
  applyNitaqatThresholdOverride: tenantFlaggedProcedure
    .use(requireFeatureFlag('gulf.saudization-dashboard'))
    .use(requirePermission({ settings: ['update'] }))
    .input(z.object({ custom: z.boolean() }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.$transaction(async tx => {
        const before = await tx.saudizationConfig.findFirst({
          where: { organizationId: ctx.organizationId },
          select: { thresholdsCustom: true },
        });

        const config = await tx.saudizationConfig.upsert({
          where: { organizationId: ctx.organizationId },
          create: {
            organizationId: ctx.organizationId,
            thresholdsCustom: input.custom,
          },
          update: { thresholdsCustom: input.custom },
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'gulf.nitaqat_threshold.override',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          metadata: {
            configId: config.id,
            before: { thresholdsCustom: before?.thresholdsCustom ?? false },
            after: { thresholdsCustom: config.thresholdsCustom },
            custom: true,
          },
          tx,
        });

        return config;
      }),
    ),

  /**
   * GULF-10 — override the seed UAE permitted-activity catalogue for this org.
   * Flips `permittedActivityCatalogueCustom = true` and audit-logs with
   * `metadata.custom = true` + before/after (C9). Atomic with the flag flip.
   */
  applyPermittedActivityOverride: tenantFlaggedProcedure
    .use(requireFeatureFlag('gulf.saudization-dashboard'))
    .use(requirePermission({ settings: ['update'] }))
    .input(z.object({ custom: z.boolean() }))
    .mutation(async ({ ctx, input }) =>
      ctx.db.$transaction(async tx => {
        const before = await tx.saudizationConfig.findFirst({
          where: { organizationId: ctx.organizationId },
          select: { permittedActivityCatalogueCustom: true },
        });

        const config = await tx.saudizationConfig.upsert({
          where: { organizationId: ctx.organizationId },
          create: {
            organizationId: ctx.organizationId,
            permittedActivityCatalogueCustom: input.custom,
          },
          update: { permittedActivityCatalogueCustom: input.custom },
        });

        await writeAuditLog({
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          action: 'gulf.permitted_activity.override',
          resourceType: 'ORGANIZATION',
          resourceId: ctx.organizationId,
          metadata: {
            configId: config.id,
            before: {
              permittedActivityCatalogueCustom: before?.permittedActivityCatalogueCustom ?? false,
            },
            after: { permittedActivityCatalogueCustom: config.permittedActivityCatalogueCustom },
            custom: true,
          },
          tx,
        });

        return config;
      }),
    ),
});
