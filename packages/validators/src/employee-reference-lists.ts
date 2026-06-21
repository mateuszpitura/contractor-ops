// packages/validators/src/employee-reference-lists.ts
//
// Small inline reference enums for the per-market employee registry. Unlike the
// large seeded code lists in ./reference-data/* (ZUS, urzędy skarbowe,
// Krankenkassen), these sets are short and stable enough to live inline as
// `as const` tuples with their Zod schemas. No live government lookup.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// NFZ oddziały wojewódzkie (PL) — 16 regional branches, codes 01-16
// ---------------------------------------------------------------------------
//
// Source: https://www.nfz.gov.pl/o-nfz/struktura-nfz/identyfikatory-oddzialow-wojewodzkich-nfz/
//
// LOCAL-ONLY / adviser-verify: the 16 branch identifiers are stable, but the
// names should be confirmed by a Polish payroll adviser before production.

export const NFZ_ODDZIAL_VERSION = '2026-06' as const;
export const NFZ_ODDZIAL_SOURCE =
  'https://www.nfz.gov.pl/o-nfz/struktura-nfz/identyfikatory-oddzialow-wojewodzkich-nfz/' as const;

export const NFZ_ODDZIALY = [
  { code: '01', name: 'Dolnośląski OW NFZ' },
  { code: '02', name: 'Kujawsko-Pomorski OW NFZ' },
  { code: '03', name: 'Lubelski OW NFZ' },
  { code: '04', name: 'Lubuski OW NFZ' },
  { code: '05', name: 'Łódzki OW NFZ' },
  { code: '06', name: 'Małopolski OW NFZ' },
  { code: '07', name: 'Mazowiecki OW NFZ' },
  { code: '08', name: 'Opolski OW NFZ' },
  { code: '09', name: 'Podkarpacki OW NFZ' },
  { code: '10', name: 'Podlaski OW NFZ' },
  { code: '11', name: 'Pomorski OW NFZ' },
  { code: '12', name: 'Śląski OW NFZ' },
  { code: '13', name: 'Świętokrzyski OW NFZ' },
  { code: '14', name: 'Warmińsko-Mazurski OW NFZ' },
  { code: '15', name: 'Wielkopolski OW NFZ' },
  { code: '16', name: 'Zachodniopomorski OW NFZ' },
] as const;

export const nfzOddzialSchema = z.enum([
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
]);
export type NfzOddzial = z.infer<typeof nfzOddzialSchema>;

// ---------------------------------------------------------------------------
// Lohnsteuerklasse (DE) — income-tax classes I-VI
// ---------------------------------------------------------------------------
//
// Source: https://de.wikipedia.org/wiki/Lohnsteuerklasse

export const LOHNSTEUERKLASSE = ['I', 'II', 'III', 'IV', 'V', 'VI'] as const;
export const lohnsteuerklasseSchema = z.enum(LOHNSTEUERKLASSE);
export type Lohnsteuerklasse = z.infer<typeof lohnsteuerklasseSchema>;

// ---------------------------------------------------------------------------
// Student-loan plan (UK)
// ---------------------------------------------------------------------------
//
// Source: https://www.gov.uk/guidance/special-rules-for-student-loans

export const STUDENT_LOAN_PLAN = [
  'PLAN_1',
  'PLAN_2',
  'PLAN_4',
  'PLAN_5',
  'POSTGRAD',
  'NONE',
] as const;
export const studentLoanPlanSchema = z.enum(STUDENT_LOAN_PLAN);
export type StudentLoanPlan = z.infer<typeof studentLoanPlanSchema>;

// ---------------------------------------------------------------------------
// W-4 step-1c filing status (US)
// ---------------------------------------------------------------------------
//
// Source: https://www.irs.gov/newsroom/faqs-on-the-2020-form-w-4

export const W4_FILING_STATUS = ['SINGLE', 'MARRIED_FILING_JOINTLY', 'HEAD_OF_HOUSEHOLD'] as const;
export const w4FilingStatusSchema = z.enum(W4_FILING_STATUS);
export type W4FilingStatus = z.infer<typeof w4FilingStatusSchema>;

// ---------------------------------------------------------------------------
// US state withholding — 10 highest-population states + OTHER
// ---------------------------------------------------------------------------
//
// The 10 highest-population states carry the bulk of payroll; everything else
// selects OTHER and supplies a free-text `stateOther`. The full 50-state matrix
// is deferred. Source: US Census population ranking (2025/26).

export const US_WITHHOLDING_STATES = [
  'CA',
  'TX',
  'FL',
  'NY',
  'PA',
  'IL',
  'OH',
  'GA',
  'NC',
  'MI',
  'OTHER',
] as const;
export const usWithholdingStateSchema = z.enum(US_WITHHOLDING_STATES);
export type UsWithholdingState = z.infer<typeof usWithholdingStateSchema>;

/**
 * US withholding selection: a state from the curated list, plus a free-text
 * `stateOther` that is required only when `OTHER` is selected.
 */
export const usWithholdingSchema = z
  .object({
    state: usWithholdingStateSchema,
    stateOther: z.string().trim().min(1).max(100).optional(),
  })
  .refine(value => value.state !== 'OTHER' || Boolean(value.stateOther), {
    message: 'stateOther is required when state is OTHER',
    path: ['stateOther'],
  });
export type UsWithholding = z.infer<typeof usWithholdingSchema>;

// ---------------------------------------------------------------------------
// Saudization category (SA) — mirrors the Prisma NitaqatBand enum
// ---------------------------------------------------------------------------
//
// Kept in lockstep with the `NitaqatBand` enum in the Prisma schema so the
// validators package can validate the Saudization category without importing
// the generated Prisma client.

export const SAUDIZATION_CATEGORY = [
  'PLATINUM',
  'HIGH_GREEN',
  'MID_GREEN',
  'LOW_GREEN',
  'YELLOW',
  'RED',
] as const;
export const saudizationCategorySchema = z.enum(SAUDIZATION_CATEGORY);
export type SaudizationCategory = z.infer<typeof saudizationCategorySchema>;
