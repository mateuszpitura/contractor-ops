import { TRPCError } from '@trpc/server';
import * as E from '../errors';
import type { TxClient } from './approval-engine';

/**
 * Resolves a valid User.id for ApprovalFlow.createdByUserId.
 * Portal/employee submits have no staff session — fall back to org owner/admin.
 */
export async function resolveApprovalFlowCreatorUserId(
  tx: TxClient,
  organizationId: string,
  preferredUserId?: string | null,
): Promise<string> {
  if (preferredUserId) {
    const preferred = await tx.member.findFirst({
      where: {
        organizationId,
        userId: preferredUserId,
        disabledAt: null,
      },
      select: { userId: true },
    });
    if (preferred) return preferred.userId;
  }

  const fallback = await tx.member.findFirst({
    where: {
      organizationId,
      role: { in: ['owner', 'admin'] },
      disabledAt: null,
    },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  });

  if (!fallback) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: E.APPROVAL_NO_CHAIN_CONFIGURED,
    });
  }

  return fallback.userId;
}
