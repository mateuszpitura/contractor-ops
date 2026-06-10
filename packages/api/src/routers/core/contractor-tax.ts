import type { Prisma } from '@contractor-ops/db';
import { isValidEin, isValidSsn } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { decryptSsn, encryptSsn } from '../../services/ssn-crypto';
import {
  applyUspsAdvisory,
  buildUsCountryFields,
  validateContractorVatId,
} from './contractor-shared.js';

export const contractorTaxRouter = router({
  revalidateVat: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(z.object({ contractorId: z.string().min(1) }))
    .mutation(({ ctx, input }) => validateContractorVatId(ctx, input.contractorId)),

  updateUsProfile: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(
      z.object({
        contractorId: z.string().min(1),
        entityType: z.string().optional(),
        ein: z.string().optional(),
        ssn: z.string().optional(),
        addressLine1: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.ein && !isValidEin(input.ein)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.CONTRACTOR_INVALID_EIN });
      }
      if (input.ssn && !isValidSsn(input.ssn)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.CONTRACTOR_INVALID_SSN });
      }

      const existing = await ctx.db.contractor.findUnique({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        select: { id: true, countryFields: true },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      const prevFields = (existing.countryFields ?? {}) as Record<string, unknown>;
      const countryFields = buildUsCountryFields(prevFields, input);

      const data: Prisma.ContractorUpdateInput = {
        countryFields: countryFields as Prisma.InputJsonValue,
      };

      if (input.ssn) {
        const cleaned = input.ssn.replace(/[\s-]/g, '');
        data.ssnEncrypted = encryptSsn(cleaned);
        data.ssnLast4 = cleaned.slice(-4);
      }

      if (input.addressLine1 && input.city && input.state && input.zipCode) {
        await applyUspsAdvisory(data, countryFields, {
          addressLine1: input.addressLine1,
          city: input.city,
          state: input.state,
          zipCode: input.zipCode,
        });
      }

      return ctx.db.contractor.update({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        data,
        omit: { ssnEncrypted: true },
      });
    }),

  revealSsn: tenantProcedure
    .use(requirePermission({ contractorPii: ['read'] }))
    .input(z.object({ contractorId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const contractor = await ctx.db.contractor.findUnique({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        select: { id: true, ssnEncrypted: true },
      });
      if (!contractor?.ssnEncrypted) throw new TRPCError({ code: 'NOT_FOUND' });

      const ssn = decryptSsn(contractor.ssnEncrypted);

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id,
        action: 'contractor.ssn.revealed',
        resourceType: 'CONTRACTOR',
        resourceId: contractor.id,
        metadata: { field: 'ssn' },
      });

      return { ssn };
    }),
});
