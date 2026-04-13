import { prisma } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';

/**
 * Generate a unique certificate number: WHT-{orgShortId}-{year}-{seq}
 */
async function generateCertificateNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.whtCertificate.count({
    where: {
      organizationId,
      generatedAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  });
  const seq = String(count + 1).padStart(4, '0');
  const orgShort = organizationId.slice(-6).toUpperCase();
  return `WHT-${orgShort}-${year}-${seq}`;
}

/**
 * Create a WhtCertificate record for a payment run item.
 */
export async function createWhtCertificate(params: {
  organizationId: string;
  paymentRunItemId: string;
  generatedByUserId: string;
}): Promise<{ certificateId: string; certificateNumber: string }> {
  const { organizationId, paymentRunItemId, generatedByUserId } = params;

  // Load payment run item with contractor data
  const item = await prisma.paymentRunItem.findUnique({
    where: { id: paymentRunItemId },
    include: {
      contractor: { select: { legalName: true, taxId: true, countryCode: true } },
      paymentRun: { select: { createdAt: true } },
    },
  });

  if (!item || item.organizationId !== organizationId) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment run item not found' });
  }

  if (!item.whtAmountMinor || item.whtAmountMinor === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'No WHT applicable to this payment item' });
  }

  const certificateNumber = await generateCertificateNumber(organizationId);

  const certificate = await prisma.whtCertificate.create({
    data: {
      organizationId,
      paymentRunItemId,
      certificateNumber,
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
    },
  });

  return { certificateId: certificate.id, certificateNumber: certificate.certificateNumber };
}

/**
 * List WHT certificates for an organization.
 */
export async function listWhtCertificates(organizationId: string) {
  return prisma.whtCertificate.findMany({
    where: { organizationId },
    orderBy: { generatedAt: 'desc' },
    take: 100,
  });
}
