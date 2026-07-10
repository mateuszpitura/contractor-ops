import type { ContractType, Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import type { ContractCreateInput, ContractListInput } from '@contractor-ops/validators';
import {
  amendmentCreateSchema,
  contractCreateSchema,
  contractExpiryReminderSchema,
  contractListSchema,
  contractStatusTransitionSchema,
  contractUpdateSchema,
  entityIdSchema,
  entityWithDataSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { auditedMutation, auditMutationCtx } from '../../lib/audited-mutation';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog, writeAuditLogMany } from '../../services/audit-writer';
import { syncContractExpiryDeadline } from '../../services/calendar-deadline-sync';
import { deleteCalendarEvent } from '../../services/calendar-event-service';
import type { PermittedActivityClient } from '../../services/permitted-activity-check';
import { checkPermittedActivityScope } from '../../services/permitted-activity-check';

const log = createLogger({ service: 'contract-router' });

/**
 * Contract fields the reassessment scan treats as material. Only diffs are
 * emitted to keep the audit payload focused.
 */
const CONTRACT_AUDIT_FIELDS = [
  'rateValueMinor',
  'rateType',
  'billingModel',
  'startDate',
  'endDate',
  'scope',
  'description',
  'status',
  'title',
  'contractNumber',
] as const;

function diffContractFields(
  existing: object,
  updateData: object,
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const e = existing as Record<string, unknown>;
  const u = updateData as Record<string, unknown>;
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const field of CONTRACT_AUDIT_FIELDS) {
    if (field in u && e[field] !== u[field]) {
      oldValues[field] = serialiseForAudit(e[field]);
      newValues[field] = serialiseForAudit(u[field]);
    }
  }
  return { oldValues, newValues };
}

function serialiseForAudit(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  return v ?? null;
}

// ---------------------------------------------------------------------------
// Contract status transition map
// ---------------------------------------------------------------------------

const CONTRACT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ACTIVE', 'PENDING_SIGNATURE', 'TERMINATED'],
  PENDING_SIGNATURE: ['ACTIVE', 'SIGNATURE_DECLINED', 'SIGNATURE_EXPIRED', 'TERMINATED'],
  SIGNATURE_DECLINED: ['PENDING_SIGNATURE', 'TERMINATED'],
  SIGNATURE_EXPIRED: ['PENDING_SIGNATURE', 'TERMINATED'],
  ACTIVE: ['EXPIRING', 'TERMINATED', 'SUPERSEDED'],
  EXPIRING: ['ACTIVE', 'EXPIRED', 'TERMINATED', 'SUPERSEDED'],
  EXPIRED: ['TERMINATED', 'SUPERSEDED'],
  TERMINATED: [],
  SUPERSEDED: [],
  ARCHIVED: [],
};

// ---------------------------------------------------------------------------
// Contract list helpers
// ---------------------------------------------------------------------------

/**
 * Builds Prisma WHERE clause for contract list queries from input filters.
 */
function buildContractListWhere(
  organizationId: string,
  input: Pick<ContractListInput, 'contractorId' | 'filters'>,
) {
  const where: Prisma.ContractWhereInput = {
    organizationId,
    deletedAt: null,
  };

  if (input.contractorId) {
    where.contractorId = input.contractorId;
  }

  const filters = input.filters;
  if (filters?.status?.length) {
    where.status = { in: filters.status };
  }
  if (filters?.type?.length) {
    where.type = { in: filters.type };
  }
  if (filters?.billingModel?.length) {
    where.billingModel = { in: filters.billingModel };
  }
  if (filters?.ownerUserId?.length) {
    where.OR = [
      { internalOwnerUserId: { in: filters.ownerUserId } },
      { internalOwnerUserId: null, contractor: { ownerUserId: { in: filters.ownerUserId } } },
    ];
  }
  if (filters?.complianceRiskLevel?.length) {
    where.complianceRiskLevel = { in: filters.complianceRiskLevel };
  }

  if (filters?.startDateFrom || filters?.startDateTo) {
    where.startDate = {
      ...(filters?.startDateFrom && { gte: new Date(filters.startDateFrom) }),
      ...(filters?.startDateTo && { lte: new Date(filters.startDateTo) }),
    };
  }

  if (filters?.endDateFrom || filters?.endDateTo) {
    where.endDate = {
      ...(filters?.endDateFrom && { gte: new Date(filters.endDateFrom) }),
      ...(filters?.endDateTo && { lte: new Date(filters.endDateTo) }),
    };
  }

  return where;
}

/**
 * Converts a search string into a PostgreSQL tsquery compatible terms string.
 */
function buildSearchTerms(search: string): string | null {
  const terms = search
    .trim()
    .split(/\s+/)
    .map(t => t.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, ''))
    .filter(Boolean)
    .map(t => `${t}:*`)
    .join(' & ');

  return terms || null;
}

// ---------------------------------------------------------------------------
// Contract update helpers
// ---------------------------------------------------------------------------

function coerceDateFields(updateData: Record<string, unknown>) {
  if (updateData.startDate) {
    updateData.startDate = new Date(updateData.startDate as string);
  }
  if (updateData.endDate) {
    updateData.endDate = new Date(updateData.endDate as string);
  }
}

function validateDateOrder(
  updateData: Record<string, unknown>,
  existing?: { startDate: Date; endDate: Date | null },
) {
  const effectiveStart = (updateData.startDate as Date | undefined) ?? existing?.startDate;
  const effectiveEnd =
    updateData.endDate === null
      ? null
      : ((updateData.endDate as Date | undefined) ?? existing?.endDate ?? null);

  if (effectiveStart && effectiveEnd && effectiveEnd <= effectiveStart) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.CONTRACT_END_DATE_BEFORE_START,
    });
  }
}

/**
 * Builds the Prisma `data` payload for contract creation from validated input.
 */
function buildContractCreateData(
  organizationId: string,
  input: ContractCreateInput,
): Prisma.ContractUncheckedCreateInput {
  return {
    organizationId,
    contractorId: input.contractorId,
    title: input.title,
    type: input.type as ContractType,
    startDate: new Date(input.startDate),
    endDate: input.endDate ? new Date(input.endDate) : null,
    noticePeriodDays: input.noticePeriodDays ?? null,
    autoRenewal: input.autoRenewal,
    renewalTerms: input.renewalTerms ?? null,
    currency: input.currency,
    billingModel: input.billingModel as Prisma.ContractCreateInput['billingModel'],
    rateType: input.rateType as Prisma.ContractCreateInput['rateType'],
    rateValueMinor: input.rateValueMinor ?? null,
    retainerAmountMinor: input.retainerAmountMinor ?? null,
    expectedHoursPerPeriod: input.expectedHoursPerPeriod ?? null,
    paymentTermsDays: input.paymentTermsDays ?? null,
    invoiceCycle: (input.invoiceCycle ?? null) as Prisma.ContractCreateInput['invoiceCycle'],
    internalOwnerUserId: input.internalOwnerUserId ?? null,
    teamId: input.teamId ?? null,
    projectId: input.projectId ?? null,
    costCenterId: input.costCenterId ?? null,
    notes: input.notes ?? null,
    // engagement activity ISIC codes for permitted-activity scope check
    activityIsicCodes: input.activityIsicCodes ?? [],
    status: 'DRAFT' as const,
  };
}

// ---------------------------------------------------------------------------
// Contract router
// ---------------------------------------------------------------------------

export const contractRouter = router({
  /**
   * Create a new contract with all metadata fields.
   */
  create: tenantProcedure
    .use(requirePermission({ contract: ['create'] }))
    .input(contractCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // contract create + permitted-activity scope check compose in one
      // transaction so an auto-NOC item + its audit row commit atomically with
      // the contract. The check is NON-BLOCKING: it never throws on a mismatch,
      // so contract creation always proceeds.
      const { contract, scopeCheck } = await ctx.db.$transaction(async tx => {
        const created = await tx.contract.create({
          data: buildContractCreateData(ctx.organizationId, input),
          include: {
            contractor: {
              select: {
                id: true,
                legalName: true,
                displayName: true,
                status: true,
                freeZoneAssignment: { select: { permittedActivityIsicCodes: true } },
              },
            },
          },
        });

        // Only run the scope check for a free-zone contractor with a coded
        // permitted set AND a coded contract; the service skips symmetrically on
        // either side uncoded. Mismatch fires a non-blocking advisory NOC.
        let scopeResult: Awaited<ReturnType<typeof checkPermittedActivityScope>> | null = null;
        const permittedCodes = created.contractor?.freeZoneAssignment?.permittedActivityIsicCodes;
        if (permittedCodes && created.activityIsicCodes.length > 0) {
          scopeResult = await checkPermittedActivityScope(tx as PermittedActivityClient, {
            organizationId: ctx.organizationId,
            contractorId: created.contractorId,
            contractId: created.id,
            permittedActivityIsicCodes: permittedCodes,
            contractActivityIsicCodes: created.activityIsicCodes,
            actorType: 'USER',
            actorId: ctx.user?.id ?? null,
          });
        }

        await auditedMutation(
          auditMutationCtx(ctx),
          {
            action: 'CREATE',
            resourceType: 'CONTRACT',
            resourceId: created.id,
            resourceName: created.title,
            oldValues: null,
            newValues: {
              status: created.status,
              startDate:
                created.startDate instanceof Date
                  ? created.startDate.toISOString()
                  : created.startDate,
              endDate:
                created.endDate instanceof Date ? created.endDate.toISOString() : created.endDate,
              rateValueMinor: created.rateValueMinor,
              rateType: created.rateType,
              billingModel: created.billingModel,
            },
          },
          async () => created,
          tx,
        );

        return { contract: created, scopeCheck: scopeResult };
      });

      // Fire-and-forget contract health-check QStash job.
      // Non-fatal: contract creation succeeded; admin can manually re-run from UI.
      try {
        const [{ publishJSONWithContext }, { getServerEnv }] = await Promise.all([
          import('@contractor-ops/integrations/services/qstash-client'),
          import('@contractor-ops/validators'),
        ]);
        await publishJSONWithContext({
          url: `${getServerEnv().API_URL}/contract-health/_run`,
          body: {
            organizationId: ctx.organizationId,
            contractId: contract.id,
            triggeredBy: 'UPLOAD',
            triggeredByUserId: ctx.user?.id ?? null,
          },
          retries: 3,
        });
      } catch (queueError) {
        log.warn(
          { err: queueError, contractId: contract.id },
          'failed to enqueue contract-health-check',
        );
      }

      // Calendar auto-push: sync contract expiry deadline.
      if (contract.endDate) {
        void syncContractExpiryDeadline(ctx.db, {
          organizationId: ctx.organizationId,
          contractId: contract.id,
          contractName: contract.title ?? input.title,
          contractorName:
            (contract as { contractor?: { displayName: string } }).contractor?.displayName ??
            'Unknown',
          expiryDate: contract.endDate,
          userId: ctx.user?.id,
        }).catch(err => log.error({ err }, 'calendar sync on create failed'));
      }

      // Surface the permitted-activity scope result so the UI can render the
      // advisory banner. `null` when the check did not run (non-free-zone
      // contractor or uncoded activity); `{ mismatch }` otherwise.
      return { ...contract, permittedActivityScope: scopeCheck };
    }),

  /**
   * Get a contract by ID with full relations.
   */
  getById: tenantProcedure
    .use(requirePermission({ contract: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const contract = await findOrThrow(
        () =>
          ctx.db.contract.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
            include: {
              contractor: {
                select: { id: true, legalName: true, displayName: true, status: true },
              },
              amendments: {
                orderBy: { effectiveDate: 'desc' },
              },
              internalOwner: {
                select: { id: true, name: true },
              },
              _count: {
                select: {
                  invoices: true,
                },
              },
            },
          }),
        E.CONTRACT_NOT_FOUND,
      );

      // Count linked documents
      const documentCount = await ctx.db.documentLink.count({
        where: {
          organizationId: ctx.organizationId,
          entityType: 'CONTRACT',
          entityId: contract.id,
        },
      });

      return { ...contract, documentCount };
    }),

  /**
   * Update a contract (PATCH semantics).
   */
  update: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(entityWithDataSchema(contractUpdateSchema))
    .mutation(async ({ ctx, input }) => {
      const existing = await findOrThrow(
        () =>
          ctx.db.contract.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.CONTRACT_NOT_FOUND,
      );

      const updateData: Record<string, unknown> = { ...input.data };

      coerceDateFields(updateData);
      validateDateOrder(updateData, existing);

      // Audit contract update; reassessment scan reads the diff.
      const diff = diffContractFields(existing, updateData);
      const updated = await auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'UPDATE',
          resourceType: 'CONTRACT',
          resourceId: input.id,
          resourceName: (updateData.title as string | undefined) ?? existing.title,
          oldValues: diff.oldValues,
          newValues: diff.newValues,
        },
        async tx =>
          tx.contract.update({
            where: { id: input.id },
            data: updateData,
          }),
      );

      // Calendar auto-push: sync or cleanup contract expiry deadline.
      if (updated.endDate) {
        const contractor = await ctx.db.contractor.findUnique({
          where: { id: updated.contractorId },
          select: { displayName: true },
        });
        void syncContractExpiryDeadline(ctx.db, {
          organizationId: ctx.organizationId,
          contractId: updated.id,
          contractName: updated.title ?? 'Untitled',
          contractorName: contractor?.displayName ?? 'Unknown',
          expiryDate: updated.endDate,
          userId: ctx.user?.id,
        }).catch(err => log.error({ err }, 'calendar sync on update failed'));
      } else if (!updated.endDate && existing.endDate) {
        // endDate was cleared — delete calendar event
        void deleteCalendarEvent(ctx.db, {
          organizationId: ctx.organizationId,
          entityType: 'CONTRACT',
          entityId: updated.id,
        }).catch(err => log.error({ err }, 'calendar event cleanup failed'));
      }

      return updated;
    }),

  /**
   * List contracts with pagination, sorting, filtering, and full-text search.
   */
  list: tenantProcedure
    .use(requirePermission({ contract: ['read'] }))
    .input(contractListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, sortBy, sortOrder, contractorId, filters } = input;

      const where = buildContractListWhere(ctx.organizationId, { contractorId, filters });

      // Full-text search via PostgreSQL tsvector
      if (search && search.length >= 2) {
        const terms = buildSearchTerms(search);

        if (terms) {
          const matchingIds: Array<{ id: string }> = await ctx.db.$queryRaw`
            SELECT id FROM "Contract"
            WHERE "organizationId" = ${ctx.organizationId}
              AND "deletedAt" IS NULL
              AND "searchVector" @@ to_tsquery('simple', ${terms})
          `;

          if (matchingIds.length === 0) {
            return {
              items: [] as Record<string, unknown>[],
              total: 0,
              page,
              pageSize,
            };
          }

          where.id = { in: matchingIds.map(r => r.id) };
        }
      }

      const [contracts, total] = await Promise.all([
        ctx.db.contract.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            contractor: {
              select: { id: true, legalName: true, displayName: true },
            },
            internalOwner: {
              select: { id: true, name: true },
            },
          },
        }),
        ctx.db.contract.count({ where }),
      ]);

      return { items: contracts, total, page, pageSize };
    }),

  /**
   * Transition contract status with state machine validation.
   */
  transitionStatus: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(contractStatusTransitionSchema)
    .mutation(async ({ ctx, input }) => {
      const contract = await findOrThrow(
        () =>
          ctx.db.contract.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.CONTRACT_NOT_FOUND,
      );

      const allowedTargets = CONTRACT_TRANSITIONS[contract.status] ?? [];
      if (!allowedTargets.includes(input.targetStatus)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.CONTRACT_INVALID_TRANSITION,
        });
      }

      // Audit status transition so the reassessment scan can detect
      // ACTIVE → TERMINATED and similar IR35-relevant events.
      const updated = await auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'STATUS_TRANSITION',
          resourceType: 'CONTRACT',
          resourceId: input.id,
          resourceName: contract.title,
          oldValues: { status: contract.status },
          newValues: { status: input.targetStatus },
        },
        async tx => {
          const updateData: Record<string, unknown> = {
            status: input.targetStatus,
          };

          if (input.targetStatus === 'TERMINATED') {
            updateData.terminatedAt = new Date();
          }

          const cas = await tx.contract.updateMany({
            where: { id: input.id, status: contract.status },
            data: updateData,
          });
          if (cas.count === 0) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: E.CONTRACT_INVALID_TRANSITION,
            });
          }

          return tx.contract.findUniqueOrThrow({
            where: { id: input.id },
          });
        },
      );

      return updated;
    }),

  /**
   * Create a contract amendment.
   */
  createAmendment: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(amendmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      await findOrThrow(
        () =>
          ctx.db.contract.findFirst({
            where: {
              id: input.contractId,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.CONTRACT_NOT_FOUND,
      );

      const amendment = await ctx.db.$transaction(async tx => {
        const existingCount = await tx.contractAmendment.count({
          where: {
            contractId: input.contractId,
            organizationId: ctx.organizationId,
          },
        });

        const created = await tx.contractAmendment.create({
          data: {
            organizationId: ctx.organizationId,
            contractId: input.contractId,
            amendmentNumber: `AME-${existingCount + 1}`,
            title: input.title,
            effectiveDate: new Date(input.effectiveDate),
            description: input.description ?? null,
            changesSummaryJson: input.changesSummaryJson as Prisma.InputJsonValue,
          },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: 'contract.amendment.create',
          resourceType: 'CONTRACT',
          resourceId: input.contractId,
          resourceName: created.amendmentNumber,
          metadata: {
            amendmentId: created.id,
            title: input.title,
            effectiveDate: input.effectiveDate,
          },
        });

        return created;
      });

      return amendment;
    }),

  /**
   * List amendments for a contract.
   */
  listAmendments: tenantProcedure
    .use(requirePermission({ contract: ['read'] }))
    .input(z.object({ contractId: z.string() }))
    .query(async ({ ctx, input }) => {
      const amendments = await ctx.db.contractAmendment.findMany({
        where: {
          contractId: input.contractId,
          organizationId: ctx.organizationId,
        },
        orderBy: { effectiveDate: 'desc' },
      });

      return amendments;
    }),

  /**
   * Update per-contract expiry reminder intervals in metadataJson.
   */
  updateExpiryReminders: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(contractExpiryReminderSchema)
    .mutation(async ({ ctx, input }) => {
      const contract = await findOrThrow(
        () =>
          ctx.db.contract.findFirst({
            where: {
              id: input.contractId,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.CONTRACT_NOT_FOUND,
      );

      const currentMetadata = (contract.metadataJson as Record<string, unknown>) ?? {};

      const newMetadata: Record<string, unknown> = {
        ...currentMetadata,
        reminderDaysBefore: input.reminderDaysBefore,
      };

      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'contract.expiry_reminders.update',
          resourceType: 'CONTRACT',
          resourceId: input.contractId,
          resourceName: contract.title,
          oldValues: {
            reminderDaysBefore:
              (currentMetadata.reminderDaysBefore as number[] | undefined) ?? null,
          },
          newValues: { reminderDaysBefore: input.reminderDaysBefore },
        },
        async tx =>
          tx.contract.update({
            where: { id: input.contractId },
            data: {
              metadataJson: newMetadata as Prisma.InputJsonValue,
            },
          }),
      );
    }),

  /**
   * Delete a contract (soft-delete, only if DRAFT status).
   */
  delete: tenantProcedure
    .use(requirePermission({ contract: ['delete'] }))
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const contract = await findOrThrow(
        () =>
          ctx.db.contract.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.CONTRACT_NOT_FOUND,
      );

      if (contract.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.CONTRACT_ONLY_DRAFT_CAN_BE_DELETED,
        });
      }

      const deletedAt = new Date();

      // Audit contract soft-delete.
      await auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'DELETE',
          resourceType: 'CONTRACT',
          resourceId: input.id,
          resourceName: contract.title,
          oldValues: { status: contract.status, deletedAt: null },
          newValues: { deletedAt: deletedAt.toISOString() },
        },
        async tx => {
          await tx.contract.update({
            where: { id: input.id },
            data: { deletedAt },
          });
          return { success: true as const };
        },
      );

      // Calendar cleanup: remove contract expiry event.
      void deleteCalendarEvent(ctx.db, {
        organizationId: ctx.organizationId,
        entityType: 'CONTRACT',
        entityId: input.id,
      }).catch(err => log.error({ err }, 'calendar event cleanup on delete failed'));

      return { success: true };
    }),

  /**
   * Bulk transition multiple contracts to a target status.
   */
  bulkTransition: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(100),
        targetStatus: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const contracts = await ctx.db.contract.findMany({
        where: {
          id: { in: input.ids },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: { id: true, status: true, title: true },
      });

      const valid: string[] = [];
      const failed: string[] = [];

      for (const contract of contracts) {
        const allowedTargets = CONTRACT_TRANSITIONS[contract.status] ?? [];
        if (allowedTargets.includes(input.targetStatus)) {
          valid.push(contract.id);
        } else {
          failed.push(contract.id);
        }
      }

      // Also track IDs not found
      const foundIds = new Set(contracts.map(c => c.id));
      for (const id of input.ids) {
        if (!foundIds.has(id)) {
          failed.push(id);
        }
      }

      if (valid.length > 0) {
        // Build a lookup of old status by id for audit log entries.
        const oldStatusById = new Map(contracts.map(c => [c.id, c]));

        await ctx.db.$transaction(async tx => {
          const updateData: Record<string, unknown> = {
            status: input.targetStatus,
          };

          if (input.targetStatus === 'TERMINATED') {
            updateData.terminatedAt = new Date();
          }

          await tx.contract.updateMany({
            where: { id: { in: valid } },
            data: updateData,
          });

          // Batch the per-row audit inserts into a single `auditLog.createMany`
          // via the shared writer. One audit row per transitioned contract so
          // the reassessment scan can detect each status change individually;
          // `writeAuditLogMany` writes them all in one round-trip while
          // applying the same before/after JSON discipline as the single-row
          // helper.
          await writeAuditLogMany({
            tx,
            rows: valid.map(id => {
              const prev = oldStatusById.get(id);
              return {
                organizationId: ctx.organizationId,
                actorType: 'USER',
                actorId: ctx.user?.id ?? null,
                actorName: ctx.user?.name ?? null,
                action: 'STATUS_TRANSITION',
                resourceType: 'CONTRACT',
                resourceId: id,
                resourceName: prev?.title ?? null,
                oldValues: { status: prev?.status ?? null },
                newValues: { status: input.targetStatus },
              };
            }),
          });
        });
      }

      return { updated: valid.length, failed };
    }),

  /**
   * Admin per-contract / bulk health-check re-run. Enqueues one fire-and-forget
   * QStash job per contract; emits a single audit row per invocation.
   * Anthropic Tier-2 headroom via 2s QStash delay.
   */
  rerunHealthCheck: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(
      z.object({
        contractIds: z.array(z.string().min(1)).min(1).max(1000),
        force: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [{ publishJSONWithContext }, { getServerEnv }] = await Promise.all([
        import('@contractor-ops/integrations/services/qstash-client'),
        import('@contractor-ops/validators'),
      ]);

      // Pre-filter to IDs that actually belong to this org — mirrors
      // bulkTransition's found-ID discipline (contract.ts ~689). Prevents a
      // caller from wasting up to 1000 Anthropic-bound QStash jobs on
      // arbitrary/foreign contract IDs (cost-abuse, not a data-leak — the
      // downstream run is already org-scoped).
      const owned = await ctx.db.contract.findMany({
        where: {
          id: { in: input.contractIds },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      const ownedIds = new Set(owned.map(c => c.id));
      const skippedCount = input.contractIds.length - ownedIds.size;

      const url = `${getServerEnv().API_URL}/contract-health/_run`;
      const enqueued: string[] = [];
      for (const contractId of input.contractIds) {
        if (!ownedIds.has(contractId)) continue;
        try {
          await publishJSONWithContext({
            url,
            body: {
              organizationId: ctx.organizationId,
              contractId,
              triggeredBy: 'MANUAL',
              triggeredByUserId: ctx.user?.id ?? null,
              force: input.force,
            },
            retries: 3,
            delay: 2,
          });
          enqueued.push(contractId);
        } catch (error) {
          log.warn({ err: error, contractId }, 'failed to enqueue manual health-check rerun');
        }
      }
      const isBulk = input.contractIds.length > 1;
      await auditedMutation(
        auditMutationCtx(ctx),
        {
          action: isBulk
            ? 'compliance.ip_clause.bulk_rerun_started'
            : 'compliance.ip_clause.manual_rerun',
          resourceType: isBulk ? 'ORGANIZATION' : 'CONTRACT',
          resourceId: isBulk ? ctx.organizationId : (input.contractIds[0] ?? ''),
          newValues: {
            contractIds: input.contractIds,
            force: input.force,
            enqueuedCount: enqueued.length,
            skippedCount,
          },
        },
        async () => ({
          enqueuedCount: enqueued.length,
          requestedCount: input.contractIds.length,
          skippedCount,
        }),
      );
      return {
        enqueuedCount: enqueued.length,
        requestedCount: input.contractIds.length,
        skippedCount,
      };
    }),
});
