import type { Prisma } from '@contractor-ops/db';
import type { TinType } from '@contractor-ops/integrations';
import { MockTinMatchClient } from '@contractor-ops/integrations';
import { createLogger } from '@contractor-ops/logger';
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
  createBackupWithholdingFlagWriter,
  createDbTinMatchPersistence,
  createTinMismatchEscalationWriter,
  matchRecipientTin,
} from '../../services/tin-match.service';
import {
  applyUspsAdvisory,
  buildUsCountryFields,
  validateContractorVatId,
} from './contractor-shared.js';

const log = createLogger({ service: 'contractor-tax-router' });

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

      const updated = await ctx.db.contractor.update({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        data,
        omit: { ssnEncrypted: true },
      });

      // Intake TIN-match: when a full TIN is (re)captured, verify it against IRS
      // records and set the backup-withholding flag on a mismatch — advisory,
      // never blocks the profile save. The flag + escalation + audit commit in one
      // transaction; a match leaves the recipient untouched. Runs only when a TIN
      // was supplied this call (both SSN and EIN already passed format validation).
      const verifyTin: { tin: string; tinType: TinType } | null = input.ssn
        ? { tin: input.ssn.replace(/[\s-]/g, ''), tinType: 'SSN' }
        : input.ein
          ? { tin: input.ein, tinType: 'EIN' }
          : null;

      if (verifyTin) {
        try {
          await ctx.db.$transaction(async tx => {
            await matchRecipientTin({
              organizationId: ctx.organizationId,
              recipientId: input.contractorId,
              name: updated.legalName,
              tin: verifyTin.tin,
              tinType: verifyTin.tinType,
              client: new MockTinMatchClient(),
              persistence: createDbTinMatchPersistence(
                {
                  setBackupWithholdingFlag: createBackupWithholdingFlagWriter(tx),
                  createEscalation: createTinMismatchEscalationWriter(tx, ctx.user?.id ?? null),
                },
                tx,
              ),
            });
          });
        } catch (err) {
          log.warn(
            { err, contractorId: input.contractorId },
            'intake TIN-match failed; TIN saved, backup-withholding flag not refreshed (advisory, non-blocking)',
          );
        }
      }

      return updated;
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
