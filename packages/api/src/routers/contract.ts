import type { ContractType, Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import {
  amendmentCreateSchema,
  contractCreateSchema,
  contractExpiryReminderSchema,
  contractListSchema,
  contractStatusTransitionSchema,
  contractUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../errors.js';
import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { writeAuditLog } from '../services/audit-writer.js';
import { syncContractExpiryDeadline } from '../services/calendar-deadline-sync.js';
import { deleteCalendarEvent } from '../services/calendar-event-service.js';

const log = createLogger({ service: 'contract-router' });

/**
 * Phase 60 CLASS-08 — contract fields the reassessment scan treats as
 * material (per D-07 allowlist + identity fields). Only diffs are emitted
 * to keep the audit payload focused.
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
  existing: Record<string, unknown>,
  updateData: Record<string, unknown>,
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};
  for (const field of CONTRACT_AUDIT_FIELDS) {
    if (field in updateData && existing[field] !== updateData[field]) {
      oldValues[field] = serialiseForAudit(existing[field]);
      newValues[field] = serialiseForAudit(updateData[field]);
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

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Contract list helpers
// ---------------------------------------------------------------------------

/**
 * Builds Prisma WHERE clause for contract list queries from input filters.
 */
function buildContractListWhere(
  organizationId: string,
  input: {
    contractorId?: string | null;
    filters?: {
      status?: string[];
      type?: string[];
      billingModel?: string[];
      ownerUserId?: string[];
      complianceRiskLevel?: string[];
      endDateFrom?: string;
      endDateTo?: string;
    } | null;
  },
) {
  // biome-ignore lint/suspicious/noExplicitAny: dynamically built Prisma where clause requires flexible property assignment for nested filter operators (e.g. { gte, lte })
  const where: Record<string, any> = {
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
    where.internalOwnerUserId = { in: filters.ownerUserId };
  }
  if (filters?.complianceRiskLevel?.length) {
    where.complianceRiskLevel = { in: filters.complianceRiskLevel };
  }

  if (filters?.endDateFrom || filters?.endDateTo) {
    where.endDate = {};
    if (filters?.endDateFrom) {
      where.endDate.gte = new Date(filters.endDateFrom);
    }
    if (filters?.endDateTo) {
      where.endDate.lte = new Date(filters.endDateTo);
    }
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

function validateDateOrder(updateData: Record<string, unknown>) {
  if (updateData.endDate && updateData.startDate) {
    if (updateData.endDate <= updateData.startDate) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: E.CONTRACT_END_DATE_BEFORE_START,
      });
    }
  }
}

/**
 * Builds the Prisma `data` payload for contract creation from validated input.
 */
function buildContractCreateData(
  organizationId: string,
  input: {
    contractorId: string;
    title: string;
    type: string;
    startDate: string;
    endDate?: string | null;
    noticePeriodDays?: number | null;
    autoRenewal: boolean;
    renewalTerms?: string | null;
    currency: string;
    billingModel: string;
    rateType: string;
    rateValueMinor?: number | null;
    retainerAmountMinor?: number | null;
    expectedHoursPerPeriod?: number | null;
    paymentTermsDays?: number | null;
    invoiceCycle?: string | null;
    internalOwnerUserId?: string | null;
    teamId?: string | null;
    projectId?: string | null;
    costCenterId?: string | null;
    notes?: string | null;
  },
) {
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
      const contract = await ctx.db.contract.create({
        data: buildContractCreateData(ctx.organizationId, input),
        include: {
          contractor: {
            select: { id: true, legalName: true, displayName: true, status: true },
          },
        },
      });

      // Phase 60 CLASS-08 — audit contract creation so the reassessment-
      // trigger scan can walk the AuditLog.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'CREATE',
        resourceType: 'CONTRACT',
        resourceId: contract.id,
        resourceName: contract.title,
        oldValues: null,
        newValues: {
          status: contract.status,
          startDate:
            contract.startDate instanceof Date
              ? contract.startDate.toISOString()
              : contract.startDate,
          endDate:
            contract.endDate instanceof Date ? contract.endDate.toISOString() : contract.endDate,
          rateValueMinor: contract.rateValueMinor,
          rateType: contract.rateType,
          billingModel: contract.billingModel,
        },
      });

      // Calendar auto-push: sync contract expiry deadline (D-06)
      if (contract.endDate) {
        void syncContractExpiryDeadline(ctx.db, {
          organizationId: ctx.organizationId,
          contractId: contract.id,
          contractName: contract.title ?? input.title,
          contractorName:
            (contract as { contractor?: { displayName: string } }).contractor?.displayName ??
            'Unknown',
          expiryDate: contract.endDate,
          userId: ctx.user!.id,
        }).catch(err => log.error({ err }, 'calendar sync on create failed'));
      }

      return plain(contract);
    }),

  /**
   * Get a contract by ID with full relations.
   */
  getById: tenantProcedure
    .use(requirePermission({ contract: ['read'] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const contract = await ctx.db.contract.findFirst({
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
      });

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      // Count linked documents
      const documentCount = await ctx.db.documentLink.count({
        where: {
          organizationId: ctx.organizationId,
          entityType: 'CONTRACT',
          entityId: contract.id,
        },
      });

      return plain({ ...contract, documentCount });
    }),

  /**
   * Update a contract (PATCH semantics).
   */
  update: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(z.object({ id: z.string(), data: contractUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.contract.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      const updateData: Record<string, unknown> = { ...input.data };

      coerceDateFields(updateData);
      validateDateOrder(updateData);

      const updated = await ctx.db.contract.update({
        where: { id: input.id },
        data: updateData,
      });

      // Phase 60 CLASS-08 — audit contract update; scan reads the diff.
      const diff = diffContractFields(
        existing as unknown as Record<string, unknown>,
        updateData as Record<string, unknown>,
      );
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'UPDATE',
        resourceType: 'CONTRACT',
        resourceId: updated.id,
        resourceName: updated.title,
        oldValues: diff.oldValues,
        newValues: diff.newValues,
      });

      // Calendar auto-push: sync or cleanup contract expiry deadline (D-06, D-08)
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
        // endDate was cleared -- delete calendar event (D-08)
        void deleteCalendarEvent(ctx.db, {
          organizationId: ctx.organizationId,
          entityType: 'CONTRACT',
          entityId: updated.id,
        }).catch(err => log.error({ err }, 'calendar event cleanup failed'));
      }

      return plain(updated);
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
              totalCount: 0,
              page,
              pageSize,
            };
          }

          where.id = { in: matchingIds.map(r => r.id) };
        }
      }

      const [contracts, totalCount] = await Promise.all([
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

      return { items: plain(contracts), totalCount, page, pageSize };
    }),

  /**
   * Transition contract status with state machine validation.
   */
  transitionStatus: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(contractStatusTransitionSchema)
    .mutation(async ({ ctx, input }) => {
      const contract = await ctx.db.contract.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      const allowedTargets = CONTRACT_TRANSITIONS[contract.status] ?? [];
      if (!allowedTargets.includes(input.targetStatus)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.CONTRACT_INVALID_TRANSITION,
        });
      }

      const updateData: Record<string, unknown> = {
        status: input.targetStatus,
      };

      if (input.targetStatus === 'TERMINATED') {
        updateData.terminatedAt = new Date();
      }

      const updated = await ctx.db.contract.update({
        where: { id: input.id },
        data: updateData,
      });

      // Phase 60 CLASS-08 — audit status transition so the reassessment scan
      // can detect ACTIVE → TERMINATED and similar IR35-relevant events.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'STATUS_TRANSITION',
        resourceType: 'CONTRACT',
        resourceId: updated.id,
        resourceName: updated.title,
        oldValues: { status: contract.status },
        newValues: { status: updated.status },
      });

      return plain(updated);
    }),

  /**
   * Create a contract amendment.
   */
  createAmendment: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(amendmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const contract = await ctx.db.contract.findFirst({
        where: {
          id: input.contractId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      // Auto-generate amendment number
      const existingCount = await ctx.db.contractAmendment.count({
        where: {
          contractId: input.contractId,
          organizationId: ctx.organizationId,
        },
      });

      const amendment = await ctx.db.contractAmendment.create({
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

      return plain(amendment);
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

      return plain(amendments);
    }),

  /**
   * Update per-contract expiry reminder intervals in metadataJson.
   */
  updateExpiryReminders: tenantProcedure
    .use(requirePermission({ contract: ['update'] }))
    .input(contractExpiryReminderSchema)
    .mutation(async ({ ctx, input }) => {
      const contract = await ctx.db.contract.findFirst({
        where: {
          id: input.contractId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      const currentMetadata = (contract.metadataJson as Record<string, unknown>) ?? {};

      const newMetadata: Record<string, unknown> = {
        ...currentMetadata,
        reminderDaysBefore: input.reminderDaysBefore,
      };

      const updated = await ctx.db.contract.update({
        where: { id: input.contractId },
        data: {
          metadataJson: newMetadata as Prisma.InputJsonValue,
        },
      });

      return plain(updated);
    }),

  /**
   * Delete a contract (soft-delete, only if DRAFT status).
   */
  delete: tenantProcedure
    .use(requirePermission({ contract: ['delete'] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const contract = await ctx.db.contract.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      if (contract.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only draft contracts can be deleted. Use status transitions instead.',
        });
      }

      await ctx.db.contract.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });

      // Phase 60 CLASS-08 — audit contract soft-delete.
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'DELETE',
        resourceType: 'CONTRACT',
        resourceId: input.id,
        resourceName: contract.title,
        oldValues: { status: contract.status, deletedAt: null },
        newValues: { deletedAt: new Date().toISOString() },
      });

      // Calendar cleanup: remove contract expiry event (D-08)
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

          // Phase 60 CLASS-08 — emit one audit row per transitioned contract so
          // the reassessment scan can detect each status change individually.
          const auditWriterTx =
            tx as unknown as import('../services/audit-writer.js').AuditWriterClient;
          for (const id of valid) {
            const prev = oldStatusById.get(id);
            await writeAuditLog({
              organizationId: ctx.organizationId,
              actorType: 'USER',
              actorId: ctx.user?.id ?? null,
              action: 'STATUS_TRANSITION',
              resourceType: 'CONTRACT',
              resourceId: id,
              resourceName: prev?.title ?? null,
              oldValues: { status: prev?.status ?? null },
              newValues: { status: input.targetStatus },
              tx: auditWriterTx,
            });
          }
        });
      }

      return { updated: valid.length, failed };
    }),
});
