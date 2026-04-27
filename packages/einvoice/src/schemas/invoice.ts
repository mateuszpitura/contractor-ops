import { z } from 'zod';

// ---------------------------------------------------------------------------
// E-Invoice Zod Schemas (runtime validation at boundaries)
// ---------------------------------------------------------------------------

export const eInvoicePartySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  country: z.string().length(2).optional(),
  additionalIds: z.record(z.string(), z.string()).optional(),
});

export const eInvoiceLineSchema = z.object({
  lineNumber: z.number().int(),
  description: z.string(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  unitPriceMinor: z.number().int().optional(),
  netAmountMinor: z.number().int().optional(),
  vatRate: z.string().optional(),
  vatAmountMinor: z.number().int().optional(),
  grossAmountMinor: z.number().int().optional(),
});

export const eInvoiceTaxSubtotalSchema = z.object({
  taxableAmountMinor: z.number().int(),
  taxAmountMinor: z.number().int(),
  taxCategory: z.string(),
  percent: z.number().optional(),
});

export const eInvoicePaymentMeansSchema = z.object({
  code: z.string().optional(),
  dueDate: z.string().optional(),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  paymentReference: z.string().optional(),
});

export const eInvoiceSchema = z.object({
  id: z.string().min(1),
  issueDate: z.string().min(1),
  dueDate: z.string().optional(),
  invoiceTypeCode: z.string().min(1),
  currencyCode: z.string().length(3),
  supplier: eInvoicePartySchema,
  customer: eInvoicePartySchema,
  lines: z.array(eInvoiceLineSchema),
  taxExclusiveAmount: z.number().int(),
  taxInclusiveAmount: z.number().int(),
  payableAmount: z.number().int(),
  taxBreakdown: z.array(eInvoiceTaxSubtotalSchema),
  paymentMeans: eInvoicePaymentMeansSchema.optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
  profileId: z.string().min(1),
  externalReference: z.string().optional(),
});

export type EInvoiceSchemaType = z.infer<typeof eInvoiceSchema>;
