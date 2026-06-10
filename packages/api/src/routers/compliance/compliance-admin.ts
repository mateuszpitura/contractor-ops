// ---------------------------------------------------------------------------
// Compliance admin tRPC router
// ---------------------------------------------------------------------------
//
// Always-mounted router (no classification-engine flag required). Admin
// compliance procedures apply to ALL orgs — gating them behind the
// classification kill-switch was an unintended coupling (CF-H1). Extracted
// from classificationRouter to fix that coupling.
//
// Security contract:
// - Every procedure chains through `tenantProcedure` — Prisma tenant extension
//   auto-scopes all reads/writes by organizationId.
// - Read procedures require `compliance:read` RBAC.
// - Mutation procedures require `compliance:override` RBAC.
// - approveUploadReplacement + rejectUploadReplacement assert document org-scope,
//   PENDING_REVIEW status, and DocumentLink contractor ownership before mutating
//   (defence-in-depth).

import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  COMPLIANCE_DOCUMENT_NOT_PENDING_REVIEW,
  COMPLIANCE_ITEM_ALREADY_WAIVED,
  COMPLIANCE_ITEM_NOT_FOUND,
} from '../../errors';
import { router } from '../../init';
import { auditedMutation, auditMutationCtx } from '../../lib/audited-mutation';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import {
  countAtRiskContractors,
  countUpcomingRenewals,
  listAtRiskItems,
  listBlockedPayments,
  listUpcomingRenewals,
} from '../../services/compliance-dashboard';
import { onComplianceItemSatisfied } from '../../services/compliance-recovery';
import { dispatch } from '../../services/notification-service';
import { resolveRbacRecipients } from '../../services/rbac-recipients';

const logger = createLogger({ service: 'compliance-admin-router' });

// Shared cuid validator — mirrors the idiom in sibling compliance routers.
const cuid = z.string().min(1);

// Closed enum mirrors Prisma `WaivedReasonCategory`.
const overrideItemInput = z.object({
  itemId: cuid,
  reasonCategory: z.enum([
    'CONTRACTOR_OFFBOARDED',
    'ENGAGEMENT_CHANGED',
    'REGULATORY_EXEMPTION',
    'TEMPORARY_GRACE_PERIOD',
    'ADMIN_CORRECTION',
    'OTHER',
  ]),
  reasonNote: z.string().min(20).max(1000),
});

/**
 * Best-effort contractor-upload-outcome notification. Contractors authenticate
 * via portal sessions (email-based), not the platform `User` table, so there
 * is no direct contractor `recipientUserId`; we notify the org's compliance
 * admins (the actors who review uploads) and the contractor sees the outcome
 * in their portal list. Wrapped so a dispatch failure never rolls back or
 * surfaces from the approve/reject mutation.
 */
async function dispatchComplianceUploadOutcome(
  organizationId: string,
  contractorId: string,
  payload: {
    type: 'compliance.upload.approved' | 'compliance.upload.rejected';
    itemId: string;
    policyRuleId?: string | null;
    reasonCategory?: string;
  },
): Promise<void> {
  try {
    const recipientUserIds = await resolveRbacRecipients(organizationId, 'contractor:read');
    if (recipientUserIds.length === 0) return;
    const reuploadPath =
      payload.type === 'compliance.upload.rejected'
        ? `/portal/compliance/upload-replacement?itemId=${payload.itemId}&policyRuleId=${payload.policyRuleId ?? ''}`
        : undefined;
    await dispatch({
      organizationId,
      type: payload.type,
      recipientUserIds,
      title: `Compliance.notifications.${payload.type === 'compliance.upload.approved' ? 'uploadApproved' : 'uploadRejected'}.title`,
      body: `Compliance.notifications.${payload.type === 'compliance.upload.approved' ? 'uploadApproved' : 'uploadRejected'}.body`,
      entityType: 'CONTRACTOR',
      entityId: contractorId,
      metadata: {
        itemId: payload.itemId,
        reasonCategory: payload.reasonCategory,
        reuploadPath,
      },
    });
  } catch (err) {
    logger.warn(
      { event: 'compliance.upload.notification_failed', err: String(err) },
      'best-effort compliance upload-outcome notification failed',
    );
  }
}

export const complianceAdminRouter = router({
  // -------------------------------------------------------------------------
  // overrideItem — admin manual override of a single compliance item.
  //
  // Flips status → WAIVED, records the admin-chosen closed-enum subcategory +
  // free-text note, and emits a forensic AuditLog row INSIDE the same
  // transaction so the item update and the audit row commit atomically.
  // `previousStatus` is read before the update.
  // -------------------------------------------------------------------------
  overrideItem: tenantProcedure
    .use(requirePermission({ compliance: ['override'] }))
    .input(overrideItemInput)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.$transaction(async tx => {
        const before = await findOrThrow(
          () =>
            tx.contractorComplianceItem.findFirst({
              where: { id: input.itemId, organizationId: ctx.organizationId },
            }),
          COMPLIANCE_ITEM_NOT_FOUND,
        );
        if (before.status === 'WAIVED') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: COMPLIANCE_ITEM_ALREADY_WAIVED,
          });
        }
        const updated = await tx.contractorComplianceItem.update({
          where: { id: input.itemId },
          data: {
            status: 'WAIVED',
            waivedReason: 'ADMIN_MANUAL_WAIVE',
            waivedReasonCategory: input.reasonCategory,
            waivedReasonNote: input.reasonNote,
          },
        });
        await auditedMutation(
          auditMutationCtx(ctx),
          {
            action: 'compliance.item.overridden',
            resourceType: 'CONTRACTOR',
            resourceId: before.contractorId,
            metadata: {
              itemId: input.itemId,
              reasonCategory: input.reasonCategory,
              reasonNote: input.reasonNote,
              previousStatus: before.status,
              actorRoleSnapshot:
                (ctx.session as unknown as { role?: string } | undefined)?.role ?? null,
            },
          },
          async () => updated,
          tx,
        );
        return updated;
      });
    }),

  // -------------------------------------------------------------------------
  // itemAuditTrail — History timeline for a single compliance item.
  //
  // Org-scoped (tenantProcedure) + defence-in-depth item-org assertion before
  // the audit lookup. The typed JSON filter `metadataJson.itemId` uses a
  // path-equality predicate; the GIN index accelerates containment (`@>`)
  // queries, not path-equality — the btree index on
  // (organizationId, resourceType, resourceId) covers this query in practice.
  // -------------------------------------------------------------------------
  itemAuditTrail: tenantProcedure
    .use(requirePermission({ compliance: ['read'] }))
    .input(z.object({ itemId: cuid, limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const item = await findOrThrow(
        () =>
          ctx.db.contractorComplianceItem.findFirst({
            where: { id: input.itemId, organizationId: ctx.organizationId },
            select: { id: true, contractorId: true },
          }),
        COMPLIANCE_ITEM_NOT_FOUND,
      );
      return await ctx.db.auditLog.findMany({
        where: {
          organizationId: ctx.organizationId,
          resourceType: 'CONTRACTOR',
          resourceId: item.contractorId,
          metadataJson: { path: ['itemId'], equals: input.itemId } as Prisma.JsonFilter,
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
      });
    }),

  // -------------------------------------------------------------------------
  // Admin compliance dashboard. All read-gated. KPI counts run in a single
  // Promise.all; the three list endpoints back the dashboard tables.
  // -------------------------------------------------------------------------
  dashboardKpis: tenantProcedure
    .use(requirePermission({ compliance: ['read'] }))
    .query(async ({ ctx }) => {
      const [atRisk, upcomingRenewals, blockedPayments] = await Promise.all([
        countAtRiskContractors(ctx.db, ctx.organizationId),
        countUpcomingRenewals(ctx.db, ctx.organizationId),
        listBlockedPayments(ctx.db, ctx.organizationId).then(rows => rows.length),
      ]);
      return {
        atRisk: { value: atRisk },
        upcomingRenewals: { value: upcomingRenewals },
        blockedPayments: { value: blockedPayments },
      };
    }),

  dashboardAtRisk: tenantProcedure
    .use(requirePermission({ compliance: ['read'] }))
    .query(async ({ ctx }) => listAtRiskItems(ctx.db, ctx.organizationId)),

  dashboardUpcomingRenewals: tenantProcedure
    .use(requirePermission({ compliance: ['read'] }))
    .query(async ({ ctx }) => listUpcomingRenewals(ctx.db, ctx.organizationId)),

  dashboardBlockedPayments: tenantProcedure
    .use(requirePermission({ compliance: ['read'] }))
    .query(async ({ ctx }) => listBlockedPayments(ctx.db, ctx.organizationId)),

  // -------------------------------------------------------------------------
  // approveUploadReplacement — admin approve of a contractor PENDING_REVIEW
  // upload. One $transaction: item -> SATISFIED + satisfiedByDocumentId
  // + admin-confirmed expiresAt; Document -> ACTIVE; forensic audit row. The
  // contractor notification is best-effort (post-tx) so a dispatch failure
  // never rolls back the approval.
  // -------------------------------------------------------------------------
  approveUploadReplacement: tenantProcedure
    .use(requirePermission({ compliance: ['override'] }))
    .input(
      z.object({
        itemId: cuid,
        documentId: cuid,
        expiresAt: z.string().date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const before = await findOrThrow(
          () =>
            tx.contractorComplianceItem.findFirst({
              where: { id: input.itemId, organizationId: ctx.organizationId },
              select: { id: true, contractorId: true, status: true },
            }),
          COMPLIANCE_ITEM_NOT_FOUND,
        );

        // Verify the document is PENDING_REVIEW, belongs to this org, and is
        // linked to the item's contractor — prevents an admin from corrupting
        // satisfiedByDocumentId with an arbitrary same-org document.
        const doc = await tx.document.findFirst({
          where: { id: input.documentId, organizationId: ctx.organizationId },
          select: { id: true, status: true },
        });
        if (!doc || doc.status !== 'PENDING_REVIEW') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: COMPLIANCE_DOCUMENT_NOT_PENDING_REVIEW,
          });
        }
        const ownerLink = await tx.documentLink.findFirst({
          where: {
            documentId: input.documentId,
            organizationId: ctx.organizationId,
            entityType: 'CONTRACTOR',
            entityId: before.contractorId,
          },
          select: { id: true },
        });
        if (!ownerLink) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: COMPLIANCE_DOCUMENT_NOT_PENDING_REVIEW,
          });
        }

        const updated = await tx.contractorComplianceItem.update({
          where: { id: input.itemId },
          data: {
            status: 'SATISFIED',
            satisfiedByDocumentId: input.documentId,
            expiresAt: new Date(input.expiresAt),
          },
        });
        await tx.document.update({
          where: { id: input.documentId },
          data: { status: 'ACTIVE' },
        });
        await auditedMutation(
          auditMutationCtx(ctx),
          {
            action: 'compliance.upload.approved',
            resourceType: 'CONTRACTOR',
            resourceId: before.contractorId,
            metadata: {
              itemId: input.itemId,
              documentId: input.documentId,
              expiresAt: input.expiresAt,
            },
          },
          async () => updated,
          tx,
        );

        // Re-assert contractor eligibility for the approved item so any
        // PENDING_COMPLIANCE ApprovalFlow holding it resumes to PENDING and the
        // contractor's payment unblocks. Per-item (exactly one item flips per
        // approval — not the all-BLOCKING supersession loop). In-tx so the
        // resume is atomic with the SATISFIED flip; the post-tx contractor
        // notification below stays best-effort.
        await onComplianceItemSatisfied(tx as Parameters<typeof onComplianceItemSatisfied>[0], {
          itemId: input.itemId,
          contractorId: before.contractorId,
          organizationId: ctx.organizationId,
        });

        return { item: updated, contractorId: before.contractorId };
      });

      await dispatchComplianceUploadOutcome(ctx.organizationId, result.contractorId, {
        type: 'compliance.upload.approved',
        itemId: input.itemId,
      });
      return result.item;
    }),

  // -------------------------------------------------------------------------
  // rejectUploadReplacement — admin reject of a PENDING_REVIEW upload.
  // One $transaction: Document -> ARCHIVED; item status UNCHANGED; forensic
  // audit row with closed-enum reason + free text. Best-effort contractor
  // notification carries a re-upload deep link. `Document.rejectionReason`
  // schema column is DEFERRED — the reason is captured in the audit log only.
  // -------------------------------------------------------------------------
  rejectUploadReplacement: tenantProcedure
    .use(requirePermission({ compliance: ['override'] }))
    .input(
      z.object({
        itemId: cuid,
        documentId: cuid,
        reasonCategory: z.enum([
          'wrong_document_type',
          'illegible',
          'already_expired',
          'forged_or_altered',
          'other',
        ]),
        freeText: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const item = await findOrThrow(
          () =>
            tx.contractorComplianceItem.findFirst({
              where: { id: input.itemId, organizationId: ctx.organizationId },
              select: { id: true, contractorId: true, policyRuleId: true, status: true },
            }),
          COMPLIANCE_ITEM_NOT_FOUND,
        );

        // Same ownership + status guard as approveUploadReplacement.
        const doc = await tx.document.findFirst({
          where: { id: input.documentId, organizationId: ctx.organizationId },
          select: { id: true, status: true },
        });
        if (!doc || doc.status !== 'PENDING_REVIEW') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: COMPLIANCE_DOCUMENT_NOT_PENDING_REVIEW,
          });
        }
        const ownerLink = await tx.documentLink.findFirst({
          where: {
            documentId: input.documentId,
            organizationId: ctx.organizationId,
            entityType: 'CONTRACTOR',
            entityId: item.contractorId,
          },
          select: { id: true },
        });
        if (!ownerLink) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: COMPLIANCE_DOCUMENT_NOT_PENDING_REVIEW,
          });
        }

        await tx.document.update({
          where: { id: input.documentId },
          data: { status: 'ARCHIVED' },
        });
        // Clear the candidate doc from the item so it no longer appears as
        // awaiting review in the admin tab.
        await tx.contractorComplianceItem.update({
          where: { id: input.itemId },
          data: { satisfiedByDocumentId: null },
        });
        await auditedMutation(
          auditMutationCtx(ctx),
          {
            action: 'compliance.upload.rejected',
            resourceType: 'CONTRACTOR',
            resourceId: item.contractorId,
            metadata: {
              itemId: input.itemId,
              documentId: input.documentId,
              reasonCategory: input.reasonCategory,
              freeText: input.freeText ?? null,
            },
          },
          async () => item,
          tx,
        );
        // Item status intentionally unchanged — stays MISSING/EXPIRED.
        return { item, contractorId: item.contractorId, policyRuleId: item.policyRuleId };
      });

      await dispatchComplianceUploadOutcome(ctx.organizationId, result.contractorId, {
        type: 'compliance.upload.rejected',
        itemId: input.itemId,
        policyRuleId: result.policyRuleId,
        reasonCategory: input.reasonCategory,
      });
      return { itemId: result.item.id, status: result.item.status };
    }),
});
