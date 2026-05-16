import { prisma } from '@contractor-ops/db';
import { z } from 'zod';
import { router } from '../../init';
import { authedProcedure } from '../../middleware/auth';

const KIND = 'settings-tab' as const;

const kindSchema = z.literal(KIND);
const keySchema = z.string().min(1).max(64);

const toggleInput = z.object({
  kind: kindSchema,
  key: keySchema,
});

const listInput = z
  .object({
    kind: kindSchema,
  })
  .optional();

export const userPinsRouter = router({
  /**
   * Return the current user's pinned views. Optional `kind` filter narrows the
   * query (currently only `settings-tab` is supported, but the model is
   * future-proof for other pinnable surfaces). Ordered by `pinnedAt` ascending
   * so the UI can render entries in insertion order.
   */
  list: authedProcedure.input(listInput).query(async ({ ctx, input }) => {
    return prisma.userPinnedView.findMany({
      where: {
        userId: ctx.user.id,
        ...(input?.kind ? { kind: input.kind } : {}),
      },
      orderBy: { pinnedAt: 'asc' },
      select: { kind: true, key: true, pinnedAt: true },
    });
  }),

  /**
   * Idempotent toggle: creates the pin if missing, removes it if present.
   * Resolves to `{ pinned: boolean }` reflecting the resulting state.
   */
  toggle: authedProcedure.input(toggleInput).mutation(async ({ ctx, input }) => {
    const existing = await prisma.userPinnedView.findUnique({
      where: {
        userId_kind_key: {
          userId: ctx.user.id,
          kind: input.kind,
          key: input.key,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.userPinnedView.delete({ where: { id: existing.id } });
      return { pinned: false };
    }

    await prisma.userPinnedView.create({
      data: {
        userId: ctx.user.id,
        kind: input.kind,
        key: input.key,
      },
    });
    return { pinned: true };
  }),
});
