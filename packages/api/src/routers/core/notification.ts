import type { Prisma } from '@contractor-ops/db';
import {
  NOTIFICATION_TYPES,
  notificationListSchema,
  notificationMarkReadSchema,
  notificationPreferenceUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { router } from '../../init';
import { tenantProcedure } from '../../middleware/tenant';
import { getOrCreatePreferences } from '../../services/notification-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireUserId(ctx: { user?: { id: string } | null }): string {
  const userId = ctx.user?.id;
  if (!userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return userId;
}

// ---------------------------------------------------------------------------
// Notification router
// ---------------------------------------------------------------------------

export const notificationRouter = router({
  /**
   * List notifications for the current user with optional filters.
   * Supports filtering by type, status, unread-only, and pagination.
   */
  list: tenantProcedure.input(notificationListSchema).query(async ({ ctx, input }) => {
    const userId = requireUserId(ctx);
    const where: Prisma.NotificationWhereInput = {
      organizationId: ctx.organizationId,
      userId,
    };

    if (input.type) {
      where.type = input.type;
    }

    if (input.status) {
      where.status = input.status;
    }

    if (input.unreadOnly) {
      where.readAt = null;
      where.status = { in: ['PENDING', 'SENT'] };
    }

    // Bound the count() to a sane upper limit so deep-page requests do not
    // trigger a full table scan on tenants with tens of thousands of
    // notifications. The UI shows "10000+" when capped.
    const COUNT_CAP = 10_000;
    const [items, total] = await Promise.all([
      ctx.db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      ctx.db.notification.count({ where, take: COUNT_CAP }),
    ]);

    const totalPages = Math.ceil(total / input.pageSize);

    return {
      items,
      total,
      page: input.page,
      totalPages,
    };
  }),

  /**
   * Get unread notification count for the current user.
   */
  unreadCount: tenantProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    const count = await ctx.db.notification.count({
      where: {
        userId,
        organizationId: ctx.organizationId,
        status: { in: ['PENDING', 'SENT'] },
      },
    });

    return { count };
  }),

  /**
   * Mark a single notification as read.
   * Only the notification owner can mark it read.
   */
  markRead: tenantProcedure.input(notificationMarkReadSchema).mutation(async ({ ctx, input }) => {
    const userId = requireUserId(ctx);
    await ctx.db.notification.updateMany({
      where: {
        id: input.notificationId,
        userId,
        organizationId: ctx.organizationId,
      },
      data: {
        readAt: new Date(),
        status: 'READ',
      },
    });

    return { success: true };
  }),

  /**
   * Mark all notifications as read for the current user.
   */
  markAllRead: tenantProcedure.mutation(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    await ctx.db.notification.updateMany({
      where: {
        userId,
        organizationId: ctx.organizationId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
        status: 'READ',
      },
    });

    return { success: true };
  }),

  /**
   * Get notification preferences for all 6 notification types.
   * Creates defaults for any missing types via getOrCreatePreferences.
   */
  getPreferences: tenantProcedure.query(async ({ ctx }) => {
    const userId = requireUserId(ctx);
    const preferences = await Promise.all(
      NOTIFICATION_TYPES.map(type => getOrCreatePreferences(userId, ctx.organizationId, type)),
    );

    return preferences;
  }),

  /**
   * Update notification preferences.
   * channelInApp is always forced to true regardless of input.
   */
  updatePreferences: tenantProcedure
    .input(notificationPreferenceUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = requireUserId(ctx);
      const results = await Promise.all(
        input.preferences.map(pref =>
          ctx.db.userNotificationPreference.upsert({
            where: {
              organizationId_userId_notificationType: {
                organizationId: ctx.organizationId,
                userId,
                notificationType: pref.notificationType,
              },
            },
            create: {
              userId,
              organizationId: ctx.organizationId,
              notificationType: pref.notificationType,
              channelEmail: pref.channelEmail,
              channelSlack: pref.channelSlack,
              channelInApp: true,
              digestMode: false,
            },
            update: {
              channelEmail: pref.channelEmail,
              channelSlack: pref.channelSlack,
              channelInApp: true,
            },
          }),
        ),
      );

      return results;
    }),
});
