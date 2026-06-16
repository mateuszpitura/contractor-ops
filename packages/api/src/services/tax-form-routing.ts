// ---------------------------------------------------------------------------
// US tax-form routing.
//
// Pure determination of which IRS form a contractor must complete, from their
// existing profile axes. No DB access — the wizard shows the result with a
// confirm/override step that is the human safety net for edge cases (US person
// abroad, dual-status, foreign single-member LLC).
//
// The decisive axis for W-9 vs W-8 is countryCode === 'US'. Among foreign
// contractors the W-8BEN vs W-8BEN-E split routes on the coarse Contractor.type
// column (COMPANY -> entity form W-8BEN-E; everything else -> individual form
// W-8BEN) — NOT the fine-grained US entity type, which only describes the W-9
// line-3a classification for US persons.
// ---------------------------------------------------------------------------

/** Mirrors the Prisma TaxFormType enum values. */
export type TaxFormTypeLiteral = 'W9' | 'W8BEN' | 'W8BENE';

/** Mirrors the Prisma ContractorType enum values. */
export type ContractorTypeLiteral = 'SOLE_TRADER' | 'COMPANY' | 'INDIVIDUAL_FREELANCER' | 'OTHER';

export interface DetermineFormTypeInput {
  /** Contractor's country (ISO-2). 'US' is the decisive W-9 axis. */
  countryCode: string;
  /** Coarse contractor entity type — drives the foreign W-8BEN vs W-8BEN-E split. */
  contractorType: ContractorTypeLiteral;
}

/**
 * Determine the W-form a contractor must complete.
 *
 * - US contractor -> W-9 (regardless of entity type).
 * - Foreign company -> W-8BEN-E (entity beneficial owner).
 * - Foreign individual / sole trader / other -> W-8BEN (individual default;
 *   the wizard's confirm/override step covers ambiguous foreign entities).
 */
export function determineFormType(input: DetermineFormTypeInput): TaxFormTypeLiteral {
  if (input.countryCode === 'US') {
    return 'W9';
  }
  return input.contractorType === 'COMPANY' ? 'W8BENE' : 'W8BEN';
}
