import type { Prisma } from '@contractor-ops/db';
import {
  NOTIFICATION_TYPES,
  notificationListSchema,
  notificationMarkReadSchema,
  notificationPreferenceUpdateSchema,
} from '@contractor-ops/validators';
import { router } from '../init.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { getOrCreatePreferences } from '../services/notification-service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
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
    const where: Prisma.NotificationWhereInput = {
      organizationId: ctx.organizationId,
      userId: ctx.user?.id,
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

    const [items, total] = await Promise.all([
      ctx.db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      ctx.db.notification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / input.pageSize);

    return plain({
      items,
      total,
      page: input.page,
      totalPages,
    });
  }),

  /**
   * Get unread notification count for the current user.
   */
  unreadCount: tenantProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.notification.count({
      where: {
        userId: ctx.user?.id,
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
    await ctx.db.notification.updateMany({
      where: {
        id: input.notificationId,
        userId: ctx.user?.id,
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
    await ctx.db.notification.updateMany({
      where: {
        userId: ctx.user?.id,
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
    const preferences = await Promise.all(
      NOTIFICATION_TYPES.map(type =>
        getOrCreatePreferences(ctx.user?.id, ctx.organizationId, type),
      ),
    );

    return plain(preferences);
  }),

  /**
   * Update notification preferences.
   * channelInApp is always forced to true regardless of input.
   */
  updatePreferences: tenantProcedure
    .input(notificationPreferenceUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const results = await Promise.all(
        input.preferences.map(pref =>
          ctx.db.userNotificationPreference.upsert({
            where: {
              userId_notificationType: {
                userId: ctx.user?.id,
                notificationType: pref.notificationType,
              },
            },
            create: {
              userId: ctx.user?.id,
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

      return plain(results);
    }),
});
