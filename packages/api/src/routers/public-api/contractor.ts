import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiContractorCreateInputSchema,
  publicApiContractorListInputSchema,
  publicApiContractorUpdateInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';
import { writePublicApiAudit } from './write-shared';

// ---------------------------------------------------------------------------
// Input schemas (simplified for public API)
// ---------------------------------------------------------------------------

const listInput = publicApiContractorListInputSchema;

// ---------------------------------------------------------------------------
// Public API contractor router
// ---------------------------------------------------------------------------

export const publicContractorRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const where: Prisma.ContractorWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      if (input.filter?.status) where.status = input.filter.status;
      if (input.filter?.lifecycleStage) where.lifecycleStage = input.filter.lifecycleStage;

      const rows = await ctx.db.contractor.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
        select: {
          id: true,
          legalName: true,
          displayName: true,
          type: true,
          taxId: true,
          vatId: true,
          email: true,
          phone: true,
          countryCode: true,
          currency: true,
          status: true,
          lifecycleStage: true,
          createdAt: true,
          updatedAt: true,
        },
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });

      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const contractor = await ctx.db.contractor.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          legalName: true,
          displayName: true,
          type: true,
          taxId: true,
          vatId: true,
          registrationNumber: true,
          email: true,
          phone: true,
          countryCode: true,
          currency: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postalCode: true,
          status: true,
          lifecycleStage: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACTOR_NOT_FOUND,
        });
      }

      return contractor;
    }),

  create: apiKeyTenantProcedure
    .use(requirePermission({ contractor: ['create'] }))
    .input(publicApiContractorCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Mirror the internal create invariant: a Contractor requires a backing
      // Worker and a default ContractorBillingProfile. Tenant + owner come from
      // the key context; the owner attribution is the acting user.
      const displayName = input.displayName ?? input.legalName;

      return ctx.db.$transaction(async tx => {
        const worker = await tx.worker.create({
          data: {
            organizationId: ctx.organizationId,
            workerType: 'CONTRACTOR',
            displayName,
            email: input.email ?? null,
          },
        });

        const created = await tx.contractor.create({
          data: {
            organizationId: ctx.organizationId,
            workerId: worker.id,
            legalName: input.legalName,
            displayName,
            type: input.type,
            taxId: input.taxId ?? null,
            vatId: input.vatId ?? null,
            registrationNumber: input.registrationNumber ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            countryCode: input.countryCode,
            currency: input.currency,
            addressLine1: input.addressLine1 ?? null,
            addressLine2: input.addressLine2 ?? null,
            city: input.city ?? null,
            postalCode: input.postalCode ?? null,
            status: 'ACTIVE',
            lifecycleStage: 'DRAFT',
            ownerUserId: ctx.apiKeyActingUserId ?? null,
          },
          select: {
            id: true,
            legalName: true,
            displayName: true,
            type: true,
            status: true,
            lifecycleStage: true,
            createdAt: true,
          },
        });

        await tx.contractorBillingProfile.create({
          data: {
            organizationId: ctx.organizationId,
            contractorId: created.id,
            legalEntityName: input.legalName,
            preferredCurrency: input.currency,
            countryCode: input.countryCode,
            validFrom: new Date(),
            isDefault: true,
          },
        });

        await writePublicApiAudit({
          tx,
          ctx,
          action: 'contractor.create',
          resourceType: 'CONTRACTOR',
          resourceId: created.id,
          resourceName: created.displayName,
          newValues: { legalName: created.legalName, status: created.status },
        });

        return created;
      });
    }),

  update: apiKeyTenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(publicApiContractorUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;

      return ctx.db.$transaction(async tx => {
        const existing = await tx.contractor.findFirst({
          where: { id, organizationId: ctx.organizationId, deletedAt: null },
          select: { id: true, legalName: true, status: true },
        });
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
        }

        const updated = await tx.contractor.update({
          where: { id: existing.id },
          data: {
            ...(changes.legalName !== undefined && { legalName: changes.legalName }),
            ...(changes.displayName !== undefined && { displayName: changes.displayName }),
            ...(changes.email !== undefined && { email: changes.email }),
            ...(changes.phone !== undefined && { phone: changes.phone }),
            ...(changes.addressLine1 !== undefined && { addressLine1: changes.addressLine1 }),
            ...(changes.addressLine2 !== undefined && { addressLine2: changes.addressLine2 }),
            ...(changes.city !== undefined && { city: changes.city }),
            ...(changes.postalCode !== undefined && { postalCode: changes.postalCode }),
            ...(changes.status !== undefined && { status: changes.status }),
          },
          select: {
            id: true,
            legalName: true,
            displayName: true,
            status: true,
            updatedAt: true,
          },
        });

        await writePublicApiAudit({
          tx,
          ctx,
          action: 'contractor.update',
          resourceType: 'CONTRACTOR',
          resourceId: updated.id,
          resourceName: updated.displayName,
          oldValues: { legalName: existing.legalName, status: existing.status },
          newValues: { legalName: updated.legalName, status: updated.status },
        });

        return updated;
      });
    }),
});
