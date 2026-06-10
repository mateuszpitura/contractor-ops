// packages/api/src/routers/admin-boe-rate.ts
//
// Admin BoE base rate CRUD router.
// All procedures gated on `admin:boe-rate:write` (super-admin only).

import { createLogger } from '@contractor-ops/logger';
import { entityIdSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { invalidateBoeRateCache } from '../../services/boe-rate-cache';

const log = createLogger({ service: 'admin-boe-rate-router' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const adminBoeRateRouter = router({
  /**
   * List all BoE base rate history entries, sorted by effectiveFrom DESC.
   * Global data — not tenant-scoped.
   */
  list: tenantProcedure
    .use(requirePermission({ 'admin:boe-rate': ['read'] }))
    .query(async ({ ctx }) => {
      const entries = await ctx.db.boEBaseRateHistory.findMany({
        orderBy: { effectiveFrom: 'desc' },
      });

      return entries;
    }),

  /**
   * Insert a new BoE base rate entry (manual source).
   */
  insert: tenantProcedure
    .use(requirePermission({ 'admin:boe-rate': ['write'] }))
    .input(
      z.object({
        effectiveFrom: z.date(),
        ratePercent: z.number().min(0).max(99.99),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check for uniqueness on effectiveFrom
      const existing = await ctx.db.boEBaseRateHistory.findFirst({
        where: { effectiveFrom: input.effectiveFrom },
      });

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `A rate entry already exists for ${input.effectiveFrom.toISOString().slice(0, 10)}`,
        });
      }

      const entry = await ctx.db.boEBaseRateHistory.create({
        data: {
          effectiveFrom: input.effectiveFrom,
          ratePercent: input.ratePercent,
          source: 'MANUAL',
          recordedByUserId: ctx.user?.id,
          notes: input.notes ?? null,
        },
      });

      log.info(
        {
          entryId: entry.id,
          effectiveFrom: input.effectiveFrom,
          ratePercent: input.ratePercent,
        },
        'BoE rate entry inserted manually',
      );

      invalidateBoeRateCache();
      return entry;
    }),

  /**
   * Update an existing BoE base rate entry.
   * Allows correcting cron-sourced entries or editing manual entries.
   */
  update: tenantProcedure
    .use(requirePermission({ 'admin:boe-rate': ['write'] }))
    .input(
      z.object({
        id: z.string(),
        ratePercent: z.number().min(0).max(99.99),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await findOrThrow(
        () =>
          ctx.db.boEBaseRateHistory.findUnique({
            where: { id: input.id },
          }),
        'Rate entry not found',
      );

      const updated = await ctx.db.boEBaseRateHistory.update({
        where: { id: input.id },
        data: {
          ratePercent: input.ratePercent,
          notes: input.notes ?? existing.notes,
          recordedByUserId: ctx.user?.id,
        },
      });

      log.info(
        {
          entryId: input.id,
          oldRate: Number(existing.ratePercent),
          newRate: input.ratePercent,
        },
        'BoE rate entry updated',
      );

      invalidateBoeRateCache();
      return updated;
    }),

  /**
   * Delete a BoE base rate entry.
   */
  delete: tenantProcedure
    .use(requirePermission({ 'admin:boe-rate': ['write'] }))
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await findOrThrow(
        () =>
          ctx.db.boEBaseRateHistory.findUnique({
            where: { id: input.id },
          }),
        'Rate entry not found',
      );

      await ctx.db.boEBaseRateHistory.delete({
        where: { id: input.id },
      });

      log.info(
        {
          entryId: input.id,
          effectiveFrom: existing.effectiveFrom,
          ratePercent: Number(existing.ratePercent),
        },
        'BoE rate entry deleted',
      );

      invalidateBoeRateCache();
      return { deleted: true };
    }),
});
