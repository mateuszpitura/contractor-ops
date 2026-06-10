import type { Prisma } from '@contractor-ops/db';
import { Prisma as PrismaSql } from '@contractor-ops/db/generated/prisma/client';
import type { ApprovalQueue } from '@contractor-ops/validators';

export type ApprovalQueueFilterStatus = ApprovalQueue['status'];

/**
 * Map approval queue filter status to Prisma where constraints.
 * Single source for router SQL and Prisma list paths.
 */
export function approvalStatusToPrismaWhere(
  status: ApprovalQueueFilterStatus,
  now: Date = new Date(),
): Prisma.ApprovalStepWhereInput {
  if (status === 'ALL') return {};
  if (status === 'PENDING') return { status: 'PENDING' };
  if (status === 'APPROVED') return { status: 'APPROVED' };
  if (status === 'REJECTED') return { status: 'REJECTED' };
  if (status === 'OVERDUE') {
    return { status: 'PENDING', slaDeadline: { lt: now } };
  }
  return {};
}

/**
 * SQL condition fragments for raw approval queue queries.
 */
export function approvalStatusToSqlConditions(
  status: ApprovalQueueFilterStatus,
  now: Date = new Date(),
): PrismaSql.Sql[] {
  if (status === 'ALL') return [];
  if (status === 'PENDING') {
    return [PrismaSql.sql`s."status" = 'PENDING'::"ApprovalStatus"`];
  }
  if (status === 'OVERDUE') {
    return [
      PrismaSql.sql`s."status" = 'PENDING'::"ApprovalStatus"`,
      PrismaSql.sql`s."slaDeadline" < ${now}`,
    ];
  }
  if (status === 'APPROVED') {
    return [PrismaSql.sql`s."status" = 'APPROVED'::"ApprovalStatus"`];
  }
  if (status === 'REJECTED') {
    return [PrismaSql.sql`s."status" = 'REJECTED'::"ApprovalStatus"`];
  }
  return [];
}
