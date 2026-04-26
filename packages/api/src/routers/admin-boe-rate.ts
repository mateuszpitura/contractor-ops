// packages/api/src/routers/admin-boe-rate.ts
//
// Phase 63 · Plan 05 · D-10 — Admin BoE base rate CRUD router.
// All procedures gated on `admin:boe-rate:write` (super-admin only).

import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../init.js';
import { plain } from '../lib/plain.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { invalidateBoeRateCache } from '../services/boe-rate-cache.js';

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
    .use(requirePermission({ 'admin:boe-rate': ['write'] }))
    .query(async ({ ctx }) => {
      const entries = await ctx.db.boEBaseRateHistory.findMany({
        orderBy: { effectiveFrom: 'desc' },
      });

      return plain(entries);
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
          recordedByUserId: ctx.user!.id,
          notes: input.notes ?? null,
        },
      });

      invalidateBoeRateCache();

      log.info(
        {
          entryId: entry.id,
          effectiveFrom: input.effectiveFrom,
          ratePercent: input.ratePercent,
        },
        'BoE rate entry inserted manually',
      );

      return plain(entry);
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
      const existing = await ctx.db.boEBaseRateHistory.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Rate entry not found' });
      }

      const updated = await ctx.db.boEBaseRateHistory.update({
        where: { id: input.id },
        data: {
          ratePercent: input.ratePercent,
          notes: input.notes ?? existing.notes,
          recordedByUserId: ctx.user!.id,
        },
      });

      invalidateBoeRateCache();

      log.info(
        {
          entryId: input.id,
          oldRate: Number(existing.ratePercent),
          newRate: input.ratePercent,
        },
        'BoE rate entry updated',
      );

      return plain(updated);
    }),

  /**
   * Delete a BoE base rate entry.
   */
  delete: tenantProcedure
    .use(requirePermission({ 'admin:boe-rate': ['write'] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.boEBaseRateHistory.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Rate entry not found' });
      }

      await ctx.db.boEBaseRateHistory.delete({
        where: { id: input.id },
      });

      invalidateBoeRateCache();

      log.info(
        {
          entryId: input.id,
          effectiveFrom: existing.effectiveFrom,
          ratePercent: Number(existing.ratePercent),
        },
        'BoE rate entry deleted',
      );

      return plain({ deleted: true });
    }),
});
