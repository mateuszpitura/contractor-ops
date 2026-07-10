// Marketplace listing-status router — the internal dashboard over the product's
// three marketplace listings (Zapier / n8n / Make). Global platform resource,
// gated on the platform-operator `admin:marketplace` permission. Submission to
// each marketplace is a manual external step; this router tracks its review
// state through a validated state machine, auditing every advance.

import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';

const log = createLogger({ service: 'marketplace-listing-router' });

export const MARKETPLACE_PLATFORMS = ['ZAPIER', 'N8N', 'MAKE'] as const;
export type MarketplacePlatform = (typeof MARKETPLACE_PLATFORMS)[number];

export const MARKETPLACE_LISTING_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'LIVE',
  'REJECTED',
  'NEEDS_CHANGES',
] as const;
export type MarketplaceListingStatus = (typeof MARKETPLACE_LISTING_STATUSES)[number];

/** The API version the listings pin to when first seeded. */
const DEFAULT_VERSION_PIN = '1.0.0';

/**
 * The review-state machine. A listing advances DRAFT -> SUBMITTED -> IN_REVIEW,
 * then IN_REVIEW resolves to LIVE / REJECTED / NEEDS_CHANGES; NEEDS_CHANGES and
 * REJECTED re-submit; a LIVE listing can regress to NEEDS_CHANGES on a later
 * review. Any jump outside this map is rejected so a listing can never be
 * mismarked LIVE without passing review.
 */
const LISTING_TRANSITIONS: Record<MarketplaceListingStatus, readonly MarketplaceListingStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['IN_REVIEW'],
  IN_REVIEW: ['LIVE', 'REJECTED', 'NEEDS_CHANGES'],
  NEEDS_CHANGES: ['SUBMITTED'],
  REJECTED: ['SUBMITTED'],
  LIVE: ['NEEDS_CHANGES'],
};

export function isValidListingTransition(
  from: MarketplaceListingStatus,
  to: MarketplaceListingStatus,
): boolean {
  return LISTING_TRANSITIONS[from]?.includes(to) ?? false;
}

const platformSchema = z.enum(MARKETPLACE_PLATFORMS);
const statusSchema = z.enum(MARKETPLACE_LISTING_STATUSES);

const updateInput = z.object({
  platform: platformSchema,
  status: statusSchema.optional(),
  versionPin: z.string().min(1).max(50).optional(),
  lastReviewFeedback: z.string().max(4000).nullish(),
  listingUrl: z.string().url().max(500).nullish(),
});

export const marketplaceListingRouter = router({
  /**
   * List all three marketplace listings, seeding any missing platform lazily so
   * the dashboard always renders one card per marketplace.
   */
  list: tenantProcedure
    .use(requirePermission({ 'admin:marketplace': ['read'] }))
    .query(async ({ ctx }) => {
      const existing = await ctx.db.marketplaceListing.findMany();
      const seen = new Set(existing.map(row => row.platform));
      const missing = MARKETPLACE_PLATFORMS.filter(p => !seen.has(p));

      if (missing.length > 0) {
        await ctx.db.marketplaceListing.createMany({
          data: missing.map(platform => ({ platform, versionPin: DEFAULT_VERSION_PIN })),
          skipDuplicates: true,
        });
      }

      return ctx.db.marketplaceListing.findMany({ orderBy: { platform: 'asc' } });
    }),

  /**
   * Advance a listing's review state and/or edit its version pin, review
   * feedback, or listing URL. A status change must be a legal transition; every
   * mutation is audited.
   */
  update: tenantProcedure
    .use(requirePermission({ 'admin:marketplace': ['write'] }))
    .input(updateInput)
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.marketplaceListing.upsert({
        where: { platform: input.platform },
        create: { platform: input.platform, versionPin: input.versionPin ?? DEFAULT_VERSION_PIN },
        update: {},
      });

      if (input.status && input.status !== current.status) {
        if (!isValidListingTransition(current.status, input.status)) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Illegal listing transition ${current.status} -> ${input.status}`,
          });
        }
      }

      const now = new Date();
      const nextStatus = input.status ?? current.status;

      const updated = await ctx.db.$transaction(async tx => {
        const row = await tx.marketplaceListing.update({
          where: { platform: input.platform },
          data: {
            ...(input.status !== undefined && { status: input.status }),
            ...(input.versionPin !== undefined && { versionPin: input.versionPin }),
            ...(input.lastReviewFeedback !== undefined && {
              lastReviewFeedback: input.lastReviewFeedback,
            }),
            ...(input.listingUrl !== undefined && { listingUrl: input.listingUrl }),
            ...(input.status === 'SUBMITTED' && { submittedAt: now }),
            ...(input.status === 'LIVE' && { wentLiveAt: now }),
            updatedByUserId: ctx.user?.id ?? null,
          },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id ?? null,
          actorName: ctx.user?.name ?? null,
          action: 'marketplace_listing.update',
          resourceType: 'MARKETPLACE_LISTING',
          resourceId: row.id,
          resourceName: row.platform,
          oldValues: { status: current.status, versionPin: current.versionPin },
          newValues: {
            status: nextStatus,
            versionPin: row.versionPin,
            listingUrl: row.listingUrl,
          },
        });

        return row;
      });

      log.info(
        { platform: input.platform, from: current.status, to: nextStatus },
        'marketplace listing updated',
      );

      return updated;
    }),
});
