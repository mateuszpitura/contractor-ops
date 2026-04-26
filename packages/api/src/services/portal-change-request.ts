import { prisma } from '@contractor-ops/db';
import type { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { TRPCError } from '@trpc/server';
import * as E from '../errors.js';

type InputJsonValue = Prisma.InputJsonValue;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields that can be changed via a financial change request */
export interface FinancialChangeFields {
  bankAccountMasked?: string | null;
  bankAccountEncrypted?: string | null;
  bankName?: string | null;
  swiftBic?: string | null;
  taxId?: string | null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new contractor financial change request.
 * Only one PENDING request per contractor+org is allowed at a time.
 */
export async function createChangeRequest(
  contractorId: string,
  organizationId: string,
  requestedChanges: Record<string, unknown>,
  previousValues: Record<string, unknown>,
) {
  // Check for existing PENDING request (duplicate guard)
  const existing = await prisma.contractorChangeRequest.findFirst({
    where: { contractorId, organizationId, status: 'PENDING' },
  });

  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: E.PORTAL_PENDING_CHANGE_EXISTS,
    });
  }

  const changeRequest = await prisma.contractorChangeRequest.create({
    data: {
      organizationId,
      contractorId,
      requestedChanges: requestedChanges as InputJsonValue,
      previousValues: previousValues as InputJsonValue,
    },
  });

  return changeRequest;
}

// ---------------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------------

/**
 * Approve a pending change request and apply the changes to the contractor's
 * default billing profile in a single transaction.
 *
 * Re-reads current billing profile values before applying to avoid
 * stale-state overwrites (research pitfall 3).
 */
export async function approveChangeRequest(
  requestId: string,
  organizationId: string,
  reviewerId: string,
  comment?: string,
) {
  const request = await prisma.contractorChangeRequest.findFirst({
    where: { id: requestId, organizationId, status: 'PENDING' },
  });

  if (!request) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: E.PORTAL_CHANGE_REQUEST_NOT_FOUND,
    });
  }

  const changes = request.requestedChanges as FinancialChangeFields;

  await prisma.$transaction(async tx => {
    // Re-read current billing profile to avoid stale-state overwrites
    const billingProfile = await tx.contractorBillingProfile.findFirst({
      where: {
        contractorId: request.contractorId,
        organizationId,
        isDefault: true,
      },
    });

    if (!billingProfile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: E.PORTAL_BILLING_PROFILE_NOT_FOUND,
      });
    }

    // Build update data from requested changes
    const profileUpdate: Record<string, unknown> = {};
    if (changes.bankName !== undefined) profileUpdate.bankName = changes.bankName;
    if (changes.swiftBic !== undefined) profileUpdate.swiftBic = changes.swiftBic;
    if (changes.taxId !== undefined) profileUpdate.taxId = changes.taxId;
    if (changes.bankAccountMasked !== undefined)
      profileUpdate.bankAccountMasked = changes.bankAccountMasked;
    if (changes.bankAccountEncrypted !== undefined)
      profileUpdate.bankAccountEncrypted = changes.bankAccountEncrypted;

    // Apply changes to billing profile
    if (Object.keys(profileUpdate).length > 0) {
      await tx.contractorBillingProfile.update({
        where: { id: billingProfile.id },
        data: profileUpdate,
      });
    }

    if (changes.taxId !== undefined) {
      await tx.contractor.update({
        where: { id: request.contractorId },
        data: { taxId: changes.taxId },
      });
    }

    // Mark change request as approved
    await tx.contractorChangeRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewComment: comment ?? null,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Reject
// ---------------------------------------------------------------------------

/**
 * Reject a pending change request with an optional comment.
 */
export async function rejectChangeRequest(
  requestId: string,
  organizationId: string,
  reviewerId: string,
  comment?: string,
) {
  const request = await prisma.contractorChangeRequest.findFirst({
    where: { id: requestId, organizationId, status: 'PENDING' },
  });

  if (!request) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: E.PORTAL_CHANGE_REQUEST_NOT_FOUND,
    });
  }

  await prisma.contractorChangeRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewComment: comment ?? null,
    },
  });
}
