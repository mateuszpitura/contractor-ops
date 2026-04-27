import type { Prisma } from '@contractor-ops/db';

/**
 * Shared Prisma types for approval router procedures.
 *
 * Extracted from inline declarations to give the TypeScript compiler a stable
 * type cache key — Prisma's `GetPayload<{include: typeof X}>` instantiations
 * are expensive (each procedure was re-resolving the same generic).
 */

export const approvalStepQueueInclude = {
  approvalFlow: {
    select: {
      id: true,
      resourceId: true,
      resourceType: true,
      status: true,
      startedAt: true,
      chainConfigId: true,
    },
  },
  approver: {
    select: { id: true, name: true, email: true, image: true },
  },
} as const satisfies Prisma.ApprovalStepInclude;

export type ApprovalQueueStepRow = Prisma.ApprovalStepGetPayload<{
  include: typeof approvalStepQueueInclude;
}>;
