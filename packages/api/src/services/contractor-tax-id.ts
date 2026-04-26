import { isValidNip } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';

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
      message: 'Invalid NIP number',
    });
  }
}

export function isValidContractorTaxId(
  countryCode: string | null | undefined,
  taxId: string | null | undefined,
): boolean {
  return !(countryCode === 'PL' && taxId && !isValidNip(taxId));
}
