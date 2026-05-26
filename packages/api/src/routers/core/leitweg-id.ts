// packages/api/src/routers/leitweg-id.ts
//
// Phase 61 · Plan 61-04 · EINV-05 — Leitweg-ID CRUD + default-flip router.
//
// Seven procedures (CONTEXT D-16):
// - list                  — query, all rows for the org
// - listByContractor      — query, rows scoped to a contractor
// - listByContract        — query, rows scoped to a contract
// - create                — mutation, with default-flip transaction
// - update                — mutation, with default-flip transaction
// - setDefault            — mutation, atomic toggle
// - delete                — mutation, tenant-scoped hard delete
//
// Invariants:
// - Every procedure runs through `tenantProcedure`; every `where` clause
//   carries `organizationId: ctx.organizationId`. Cross-tenant ids resolve to
//   NOT_FOUND (never FORBIDDEN) to avoid a response-code oracle (T-61-04-06).
// - Input validation uses `leitwegIdSchema` (structure + MOD-11-10 check
//   digit) at the tRPC boundary so malformed IDs never hit the DB.
// - `setDefault` and default-flipping writes live inside `$transaction` so
//   two concurrent callers cannot produce two "isDefaultForContractor=true"
//   rows for the same contractor (T-61-04-05).
// - The (organizationId, value) unique constraint surfaces as a clean
//   CONFLICT; all other unknown errors rethrow unchanged.

import { TRPCError } from '@trpc/server';

import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import {
  createLeitwegIdInput,
  deleteLeitwegIdInput,
  listByContractInput,
  listByContractorInput,
  setDefaultInput,
  updateLeitwegIdInput,
} from '../../schemas/leitweg-id';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Prisma's known unique-constraint error code. Using the string literal
 * avoids pulling the runtime type from `@prisma/client` into this module.
 */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === PRISMA_UNIQUE_VIOLATION
  );
}

// Shared permission gate for every Leitweg-ID mutation — Leitweg-IDs are a
// property of Contractor records, so `contractor:update` is the right scope.
const leitwegIdWriteProcedure = tenantProcedure.use(requirePermission({ contractor: ['update'] }));

// Shared select projection for list queries (includes contractor + contract
// relations for the UI's dropdown + chip rendering).
const listSelect = {
  id: true,
  value: true,
  description: true,
  contractorId: true,
  contractId: true,
  isDefaultForContractor: true,
  validFrom: true,
  validTo: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  contractor: { select: { id: true, displayName: true } },
  contract: { select: { id: true, title: true } },
} as const;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const leitwegIdRouter = router({
  /**
   * List every Leitweg-ID row for the caller's organization, newest first.
   * Includes contractor + contract relations for UI display.
   */
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db.leitwegId.findMany({
      where: { organizationId: ctx.organizationId },
      select: listSelect,
      orderBy: { createdAt: 'desc' },
    });
  }),

  /**
   * List Leitweg-IDs attached to a specific contractor. Used by the Settings
   * + Contractor profile "default Leitweg-ID" selector (Plan 07).
   */
  listByContractor: tenantProcedure.input(listByContractorInput).query(async ({ ctx, input }) => {
    return ctx.db.leitwegId.findMany({
      where: { organizationId: ctx.organizationId, contractorId: input.contractorId },
      select: listSelect,
      orderBy: [{ isDefaultForContractor: 'desc' }, { createdAt: 'desc' }],
    });
  }),

  /**
   * List Leitweg-IDs attached to a specific contract (per-contract override).
   */
  listByContract: tenantProcedure.input(listByContractInput).query(async ({ ctx, input }) => {
    return ctx.db.leitwegId.findMany({
      where: { organizationId: ctx.organizationId, contractId: input.contractId },
      select: listSelect,
      orderBy: { createdAt: 'desc' },
    });
  }),

  /**
   * Create a new Leitweg-ID. When `isDefaultForContractor=true` and a
   * contractorId is provided, all other rows for that contractor are flipped
   * to `false` inside the same transaction (serializable under Postgres via
   * Prisma's `$transaction` default).
   */
  create: leitwegIdWriteProcedure.input(createLeitwegIdInput).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.db.$transaction(async tx => {
        if (input.isDefaultForContractor && input.contractorId) {
          await tx.leitwegId.updateMany({
            where: {
              organizationId: ctx.organizationId,
              contractorId: input.contractorId,
              isDefaultForContractor: true,
            },
            data: { isDefaultForContractor: false },
          });
        }

        return tx.leitwegId.create({
          data: {
            organizationId: ctx.organizationId,
            value: input.value,
            description: input.description ?? null,
            contractorId: input.contractorId ?? null,
            contractId: input.contractId ?? null,
            isDefaultForContractor: input.isDefaultForContractor,
            validFrom: input.validFrom ?? null,
            validTo: input.validTo ?? null,
            notes: input.notes ?? null,
          },
          select: listSelect,
        });
      });
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Leitweg-ID already exists for this organization',
        });
      }
      throw err;
    }
  }),

  /**
   * Update an existing Leitweg-ID. Cross-tenant ids surface as NOT_FOUND
   * (never FORBIDDEN — prevents a response-code oracle). When the caller
   * flips `isDefaultForContractor=true`, other default rows for the same
   * contractor are cleared in the same transaction.
   */
  update: leitwegIdWriteProcedure.input(updateLeitwegIdInput).mutation(async ({ ctx, input }) => {
    const { id, ...patch } = input;

    try {
      return await ctx.db.$transaction(async tx => {
        const existing = await tx.leitwegId.findFirst({
          where: { id, organizationId: ctx.organizationId },
          select: { id: true, contractorId: true },
        });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.UNKNOWN_ERROR });
        }

        const targetContractorId = patch.contractorId ?? existing.contractorId;

        if (patch.isDefaultForContractor === true && targetContractorId) {
          await tx.leitwegId.updateMany({
            where: {
              organizationId: ctx.organizationId,
              contractorId: targetContractorId,
              isDefaultForContractor: true,
              NOT: { id },
            },
            data: { isDefaultForContractor: false },
          });
        }

        return tx.leitwegId.update({
          where: { id },
          data: {
            ...(patch.value === undefined ? {} : { value: patch.value }),
            ...(patch.description === undefined ? {} : { description: patch.description ?? null }),
            ...(patch.contractorId === undefined
              ? {}
              : { contractorId: patch.contractorId ?? null }),
            ...(patch.contractId === undefined ? {} : { contractId: patch.contractId ?? null }),
            ...(patch.isDefaultForContractor === undefined
              ? {}
              : { isDefaultForContractor: patch.isDefaultForContractor }),
            ...(patch.validFrom === undefined ? {} : { validFrom: patch.validFrom ?? null }),
            ...(patch.validTo === undefined ? {} : { validTo: patch.validTo ?? null }),
            ...(patch.notes === undefined ? {} : { notes: patch.notes ?? null }),
          },
          select: listSelect,
        });
      });
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      if (isPrismaUniqueViolation(err)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Leitweg-ID already exists for this organization',
        });
      }
      throw err;
    }
  }),

  /**
   * Atomically promote a Leitweg-ID row to the contractor's default. All
   * other `isDefaultForContractor=true` rows for the same contractor are
   * cleared inside the same transaction (T-61-04-05 race guard).
   */
  setDefault: leitwegIdWriteProcedure.input(setDefaultInput).mutation(async ({ ctx, input }) => {
    return ctx.db.$transaction(async tx => {
      const row = await tx.leitwegId.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: { id: true, contractorId: true },
      });
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.UNKNOWN_ERROR });
      }
      if (!row.contractorId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot set a non-contractor-scoped Leitweg-ID as a contractor default',
        });
      }

      await tx.leitwegId.updateMany({
        where: {
          organizationId: ctx.organizationId,
          contractorId: row.contractorId,
          isDefaultForContractor: true,
          NOT: { id: row.id },
        },
        data: { isDefaultForContractor: false },
      });

      return tx.leitwegId.update({
        where: { id: row.id },
        data: { isDefaultForContractor: true },
        select: listSelect,
      });
    });
  }),

  /**
   * Delete a Leitweg-ID. Cross-tenant ids surface as NOT_FOUND. No automatic
   * default promotion when the deleted row was the contractor's default —
   * the UI shows a "no default" chip and the user re-selects explicitly.
   */
  delete: leitwegIdWriteProcedure.input(deleteLeitwegIdInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.leitwegId.findFirst({
      where: { id: input.id, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: E.UNKNOWN_ERROR });
    }
    await ctx.db.leitwegId.delete({ where: { id: existing.id } });
    return { id: existing.id };
  }),
});
