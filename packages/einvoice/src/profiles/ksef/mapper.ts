import type { EInvoice, EInvoiceTaxSubtotal } from '../../types/invoice.js';
import type { KsefParsedInvoice } from './schemas.js';

// ---------------------------------------------------------------------------
// KSeF → Prisma Invoice Model Mapper
// ---------------------------------------------------------------------------

/**
 * Maps a parsed KSeF invoice to fields matching the Invoice/InvoiceLine
 * Prisma models for database insertion.
 */
export function mapKsefToInvoiceFields(parsed: KsefParsedInvoice) {
  // Derive primary VAT rate from lines (most common rate)
  const vatRateCounts = new Map<string, number>();
  for (const line of parsed.lines) {
    if (line.vatRate) {
      vatRateCounts.set(line.vatRate, (vatRateCounts.get(line.vatRate) ?? 0) + 1);
    }
  }
  let primaryVatRate: string | null = null;
  let maxCount = 0;
  for (const [rate, count] of vatRateCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryVatRate = rate;
    }
  }

  const invoice = {
    invoiceNumber: parsed.invoiceNumber,
    externalInvoiceId: parsed.ksefReferenceNumber,
    source: 'KSEF' as const,
    sourceReference: parsed.upoNumber ?? null,
    issueDate: new Date(parsed.issueDate),
    dueDate: parsed.payment?.dueDate ? new Date(parsed.payment.dueDate) : null,
    currency: parsed.currency,
    subtotalMinor: parsed.totals.netMinor,
    vatRate: primaryVatRate,
    vatAmountMinor: parsed.totals.vatMinor,
    totalMinor: parsed.totals.grossMinor,
    amountToPayMinor: parsed.totals.grossMinor,
    sellerTaxId: parsed.seller.nip,
    sellerName: parsed.seller.name,
    sellerBankAccount: parsed.payment?.bankAccount ?? null,
    buyerTaxId: parsed.buyer.nip,
  };

  const lines = parsed.lines.map(line => ({
    lineNumber: line.lineNumber,
    description: line.description,
    quantity: line.quantity ?? null,
    unit: line.unit ?? null,
    unitPriceMinor: line.unitPriceMinor ?? null,
    netAmountMinor: line.netAmountMinor ?? null,
    vatRate: line.vatRate ?? null,
    vatAmountMinor: line.vatAmountMinor ?? null,
    grossAmountMinor: line.grossAmountMinor ?? null,
  }));

  return { invoice, lines };
}

// ---------------------------------------------------------------------------
// KSeF → Canonical EInvoice Mapper
// ---------------------------------------------------------------------------

/**
 * Map KSeF invoice type string to UBL invoice type code.
 */
function mapInvoiceTypeCode(ksefType: string): string {
  switch (ksefType.toUpperCase()) {
    case 'VAT':
      return '380';
    case 'CORRECTIVE':
    case 'KOR':
      return '381';
    default:
      return '380';
  }
}

/**
 * Map KSeF payment method to UNCL 4461 code.
 */
function mapPaymentMethodCode(method: string | undefined): string | undefined {
  if (!method) return;
  const upper = method.toUpperCase();
  if (upper.includes('PRZELEW') || upper.includes('TRANSFER')) return '30'; // Credit transfer
  if (upper.includes('GOTOWKA') || upper.includes('CASH')) return '10'; // Cash
  if (upper.includes('KARTA') || upper.includes('CARD')) return '48'; // Bank card
  return;
}

/**
 * Converts a parsed KSeF invoice (KsefParsedInvoice) to the canonical
 * EInvoice type. This bridges KSeF's FA(3) structure to the engine's
 * country-agnostic model.
 */
export function ksefToEInvoice(parsed: KsefParsedInvoice): EInvoice {
  // Build tax breakdown by grouping lines on a (vatRate, taxCategory) tuple.
  // Today the FA(3) parser does not yet extract an explicit category; we
  // derive it from the rate (>0 = 'S', 0 = 'Z'). Keying on the full tuple
  // means once a future parser change starts surfacing a distinct category
  // for exempt vs. zero-rated lines, this aggregator will not silently merge
  // them (bug-hunt 2026-04-27 [MEDIUM]).
  interface TaxGroup {
    taxable: number;
    tax: number;
    rate: number;
    category: string;
  }
  const taxGroups = new Map<string, TaxGroup>();
  for (const line of parsed.lines) {
    const rateKey = line.vatRate ?? '0';
    const rate = rateKey === '0' ? 0 : parseFloat(rateKey) || 0;
    const category = rate > 0 ? 'S' : 'Z';
    const key = `${rateKey}|${category}`;
    const existing = taxGroups.get(key) ?? {
      taxable: 0,
      tax: 0,
      rate,
      category,
    };
    existing.taxable += line.netAmountMinor ?? 0;
    existing.tax += line.vatAmountMinor ?? 0;
    taxGroups.set(key, existing);
  }

  const taxBreakdown: EInvoiceTaxSubtotal[] = Array.from(taxGroups.values()).map(group => ({
    taxableAmountMinor: group.taxable,
    taxAmountMinor: group.tax,
    taxCategory: group.category,
    percent: group.rate,
  }));

  return {
    id: parsed.invoiceNumber,
    issueDate: parsed.issueDate,
    dueDate: parsed.payment?.dueDate,
    invoiceTypeCode: mapInvoiceTypeCode(parsed.invoiceType),
    currencyCode: parsed.currency,
    supplier: {
      id: parsed.seller.nip,
      name: parsed.seller.name,
      address: parsed.seller.address,
      country: 'PL',
    },
    customer: {
      id: parsed.buyer.nip,
      name: parsed.buyer.name,
      country: 'PL',
    },
    lines: parsed.lines.map(line => ({
      lineNumber: line.lineNumber,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPriceMinor: line.unitPriceMinor,
      netAmountMinor: line.netAmountMinor,
      vatRate: line.vatRate,
      vatAmountMinor: line.vatAmountMinor,
      grossAmountMinor: line.grossAmountMinor,
    })),
    taxExclusiveAmount: parsed.totals.netMinor,
    taxInclusiveAmount: parsed.totals.grossMinor,
    payableAmount: parsed.totals.grossMinor,
    taxBreakdown,
    paymentMeans: parsed.payment
      ? {
          dueDate: parsed.payment.dueDate,
          bankAccount: parsed.payment.bankAccount,
          code: mapPaymentMethodCode(parsed.payment.method),
        }
      : undefined,
    profileId: 'ksef',
    externalReference: parsed.ksefReferenceNumber,
  };
}
