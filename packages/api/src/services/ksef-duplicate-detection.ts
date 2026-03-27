import type { PrismaClient } from "@contractor-ops/db";

// ---------------------------------------------------------------------------
// Cross-Source Duplicate Detection
// Per D-11: Uses invoiceNumber + sellerTaxId as the cross-source business key
// ---------------------------------------------------------------------------

/**
 * Checks for cross-source duplicate invoices by invoiceNumber + sellerTaxId.
 *
 * This detects when the same invoice was already uploaded manually (or via
 * email/OCR) and is now being fetched from KSeF, or vice versa.
 * Case-insensitive match on invoiceNumber for robustness.
 *
 * @param prisma - Prisma client instance
 * @param organizationId - Organization scope
 * @param invoiceNumber - Invoice number to check
 * @param sellerTaxId - Seller tax ID (NIP)
 * @param excludeInvoiceId - Optional invoice ID to exclude from the search
 * @returns Duplicate check result with existing invoice info if found
 */
export async function checkCrossSourceDuplicate(
  prisma: PrismaClient,
  organizationId: string,
  invoiceNumber: string,
  sellerTaxId: string,
  excludeInvoiceId?: string,
): Promise<{
  isDuplicate: boolean;
  existingInvoiceId: string | null;
  existingSource: string | null;
}> {
  const existing = await prisma.invoice.findFirst({
    where: {
      organizationId,
      invoiceNumber: { equals: invoiceNumber, mode: "insensitive" },
      sellerTaxId,
      deletedAt: null,
      ...(excludeInvoiceId ? { id: { not: excludeInvoiceId } } : {}),
    },
    select: { id: true, source: true },
  });

  return {
    isDuplicate: !!existing,
    existingInvoiceId: existing?.id ?? null,
    existingSource: existing?.source ?? null,
  };
}

// ---------------------------------------------------------------------------
// Duplicate Linking
// Per D-12: Flag both invoices bidirectionally in flagsJson
// ---------------------------------------------------------------------------

/**
 * Links two invoices as duplicates by updating both their flagsJson fields.
 *
 * The KSeF invoice gets a reference to the manual invoice, and vice versa.
 * Preserves any existing flags in flagsJson.
 *
 * @param prisma - Prisma client instance
 * @param ksefInvoiceId - The newly created KSeF invoice ID
 * @param manualInvoiceId - The existing manual/email/OCR invoice ID
 */
export async function linkDuplicateInvoices(
  prisma: PrismaClient,
  ksefInvoiceId: string,
  manualInvoiceId: string,
): Promise<void> {
  // Read existing flags for both invoices
  const [ksefInvoice, manualInvoice] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({
      where: { id: ksefInvoiceId },
      select: { flagsJson: true },
    }),
    prisma.invoice.findUniqueOrThrow({
      where: { id: manualInvoiceId },
      select: { flagsJson: true },
    }),
  ]);

  const ksefFlags =
    (ksefInvoice.flagsJson as Record<string, unknown> | null) ?? {};
  const manualFlags =
    (manualInvoice.flagsJson as Record<string, unknown> | null) ?? {};

  // Update both invoices with cross-references
  await Promise.all([
    prisma.invoice.update({
      where: { id: ksefInvoiceId },
      data: {
        flagsJson: {
          ...ksefFlags,
          duplicateOf: manualInvoiceId,
          duplicateSource: "MANUAL",
        },
      },
    }),
    prisma.invoice.update({
      where: { id: manualInvoiceId },
      data: {
        flagsJson: {
          ...manualFlags,
          duplicateOf: ksefInvoiceId,
          duplicateSource: "KSEF",
        },
      },
    }),
  ]);
}
