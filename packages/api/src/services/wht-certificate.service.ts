import { prisma } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import {
  PAYMENT_RUN_ITEM_NOT_FOUND,
  WHT_CERTIFICATE_ISSUE_FAILED,
  WHT_CERTIFICATE_NUMBER_CONFLICT,
  WHT_NOT_APPLICABLE,
} from '../errors';
import type { TenantDbTx } from '../lib/tenant-db';
import { writeAuditLog } from './audit-writer';
import type { DbClient } from './types';

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';
}

async function nextCertificateNumber(
  tx: TenantDbTx,
  organizationId: string,
  year: number,
): Promise<string> {
  const count = await tx.whtCertificate.count({
    where: {
      organizationId,
      generatedAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  });
  return `WHT-${organizationId.slice(-6).toUpperCase()}-${year}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Create a WhtCertificate record for a payment run item.
 */
export async function createWhtCertificate(params: {
  db?: DbClient;
  organizationId: string;
  paymentRunItemId: string;
  generatedByUserId: string;
}): Promise<{ certificateId: string; certificateNumber: string }> {
  const { organizationId, paymentRunItemId, generatedByUserId } = params;
  const client = params.db ?? prisma;

  return (client as typeof prisma).$transaction(async tx => {
    const item = await tx.paymentRunItem.findUnique({
      where: { id: paymentRunItemId },
      include: {
        contractor: { select: { legalName: true, taxId: true, countryCode: true } },
        paymentRun: { select: { createdAt: true, id: true } },
      },
    });

    if (!item || item.organizationId !== organizationId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: PAYMENT_RUN_ITEM_NOT_FOUND });
    }

    if (!item.whtAmountMinor || item.whtAmountMinor === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: WHT_NOT_APPLICABLE });
    }

    const existingCert = await tx.whtCertificate.findFirst({
      where: { organizationId, paymentRunItemId },
      select: { id: true, certificateNumber: true },
    });
    if (existingCert) {
      return {
        certificateId: existingCert.id,
        certificateNumber: existingCert.certificateNumber,
      };
    }

    const year = new Date().getFullYear();
    const certData = {
      organizationId,
      paymentRunItemId,
      grossAmountMinor: item.grossAmountMinor ?? item.amountMinor,
      whtRate: item.whtRate ?? 0,
      whtAmountMinor: item.whtAmountMinor,
      netAmountMinor: item.amountMinor,
      currency: item.currency,
      contractorName: item.contractor.legalName,
      contractorTaxId: item.contractor.taxId,
      contractorCountry: item.contractor.countryCode,
      treatyApplied: item.whtTreatyApplied ?? false,
      treatyReference: item.whtTreatyReference,
      paymentDate: item.paymentRun.createdAt,
      generatedByUserId,
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      const certificateNumber = await nextCertificateNumber(tx as TenantDbTx, organizationId, year);
      try {
        const certificate = await tx.whtCertificate.create({
          data: { ...certData, certificateNumber },
        });

        await writeAuditLog({
          tx,
          organizationId,
          actorType: 'USER',
          actorId: generatedByUserId,
          action: 'wht_certificate.issued',
          resourceType: 'PAYMENT_RUN',
          resourceId: item.paymentRun.id,
          metadata: {
            certificateId: certificate.id,
            certificateNumber,
            paymentRunItemId,
            whtAmountMinor: item.whtAmountMinor,
            currency: item.currency,
          },
        });

        return { certificateId: certificate.id, certificateNumber: certificate.certificateNumber };
      } catch (err) {
        if (!isUniqueViolation(err)) {
          throw err;
        }

        const raced = await tx.whtCertificate.findFirst({
          where: { organizationId, paymentRunItemId },
          select: { id: true, certificateNumber: true },
        });
        if (raced) {
          return {
            certificateId: raced.id,
            certificateNumber: raced.certificateNumber,
          };
        }

        if (attempt === 2) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: WHT_CERTIFICATE_NUMBER_CONFLICT,
          });
        }
      }
    }

    throw new TRPCError({ code: 'CONFLICT', message: WHT_CERTIFICATE_ISSUE_FAILED });
  });
}

/**
 * List WHT certificates for an organization.
 */
export async function listWhtCertificates(organizationId: string, db: DbClient) {
  return db.whtCertificate.findMany({
    where: { organizationId },
    orderBy: { generatedAt: 'desc' },
    take: 100,
  });
}
