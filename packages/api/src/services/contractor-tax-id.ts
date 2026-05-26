import { isValidNip } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { CONTRACTOR_INVALID_NIP } from '../errors';

export function normalizeContractorTaxId(
  countryCode: string | null | undefined,
  taxId: string | null | undefined,
): string | null | undefined {
  if (taxId == null) return taxId;

  const trimmed = taxId.trim();
  if (!trimmed) return trimmed;

  return countryCode === 'PL' ? trimmed.replace(/[\s-]/g, '') : trimmed;
}

export function assertValidContractorTaxId(
  countryCode: string | null | undefined,
  taxId: string | null | undefined,
): void {
  if (!isValidContractorTaxId(countryCode, taxId)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: CONTRACTOR_INVALID_NIP,
    });
  }
}

export function isValidContractorTaxId(
  countryCode: string | null | undefined,
  taxId: string | null | undefined,
): boolean {
  return !(countryCode === 'PL' && taxId && !isValidNip(taxId));
}
