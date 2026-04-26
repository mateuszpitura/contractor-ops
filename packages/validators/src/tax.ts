import { z } from 'zod';

// ---------------------------------------------------------------------------
// Tax Rate schemas
// ---------------------------------------------------------------------------

export const taxRateCodeSchema = z
  .string()
  .max(10)
  .regex(/^[A-Z0-9-]+$/i, 'Invalid tax rate code format');

export const taxRateResponseSchema = z.object({
  id: z.string(),
  countryCode: z.string().length(2),
  code: z.string().max(10),
  description: z.string(),
  ratePercent: z.number(),
  isDefault: z.boolean(),
  isReverseCharge: z.boolean(),
  isExempt: z.boolean(),
});

export type TaxRateResponse = z.infer<typeof taxRateResponseSchema>;

// ---------------------------------------------------------------------------
// WHT schemas
// ---------------------------------------------------------------------------

export const whtServiceTypeEnum = z.enum([
  'technical_services',
  'management_fees',
  'royalties',
  'rent_equipment',
]);

export type WhtServiceType = z.infer<typeof whtServiceTypeEnum>;

export const whtCalculationSchema = z.object({
  grossAmountMinor: z.number().int().min(0),
  whtRate: z.number().min(0).max(100),
  whtAmountMinor: z.number().int().min(0),
  netAmountMinor: z.number().int().min(0),
  treatyApplied: z.boolean(),
  treatyReference: z.string().nullable(),
  rateSource: z.enum(['treaty', 'standard']),
});

export type WhtCalculation = z.infer<typeof whtCalculationSchema>;
