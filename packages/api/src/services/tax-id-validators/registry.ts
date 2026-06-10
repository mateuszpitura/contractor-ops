import type { Prisma, TaxIdType, ValidationStatus } from '@contractor-ops/db';
import type { HmrcVatClient, ViesClient } from '@contractor-ops/gov-api';
import { isValidGbVat, isValidUstIdNr } from '@contractor-ops/validators';

export interface TaxIdValidatorDeps {
  hmrcClient: HmrcVatClient;
  viesClient: ViesClient;
}

// ---------------------------------------------------------------------------
// Tax ID validator registry — Strategy per taxIdType
// ---------------------------------------------------------------------------

export interface TaxIdValidationDispatchInput {
  organizationId: string;
  taxIdValue: string;
}

export interface TaxIdValidationDispatchResult {
  apiProvider: string;
  responseStatus: ValidationStatus;
  confirmationRef: string | null;
  responseBody: Prisma.InputJsonValue;
  /** When status is unavailable without throw (VIES soft path). */
  unavailableMessage?: string;
}

export interface TaxIdValidator {
  readonly taxIdType: TaxIdType;
  runPreflight(value: string): boolean;
  validate(
    input: TaxIdValidationDispatchInput,
    deps: TaxIdValidatorDeps,
  ): Promise<TaxIdValidationDispatchResult>;
}

const validators = new Map<TaxIdType, TaxIdValidator>();

export function registerTaxIdValidator(validator: TaxIdValidator): void {
  validators.set(validator.taxIdType, validator);
}

export function getTaxIdValidator(taxIdType: TaxIdType): TaxIdValidator | undefined {
  return validators.get(taxIdType);
}

export function clearTaxIdValidators(): void {
  validators.clear();
}

function stripCountryPrefix(value: string, country: 'GB' | 'DE'): string {
  const upper = value.trim().toUpperCase().replace(/[\s-]/g, '');
  return upper.startsWith(country) ? upper.slice(2) : upper;
}

const gbVatValidator: TaxIdValidator = {
  taxIdType: 'GB_VAT',
  runPreflight: isValidGbVat,
  async validate(input, deps) {
    const result = await deps.hmrcClient.checkVatNumber(
      stripCountryPrefix(input.taxIdValue, 'GB'),
      { organizationId: input.organizationId, useVerifiedLookup: true },
    );
    return {
      apiProvider: 'hmrc',
      responseStatus: result.status === 'valid' ? 'VALID' : 'INVALID',
      confirmationRef: result.status === 'valid' ? result.confirmationRef : null,
      responseBody:
        result.status === 'valid'
          ? (result.raw as unknown as Prisma.InputJsonValue)
          : ({ status: 'invalid' } as Prisma.InputJsonValue),
    };
  },
};

const deUstIdNrValidator: TaxIdValidator = {
  taxIdType: 'DE_USTIDNR',
  runPreflight: isValidUstIdNr,
  async validate(input, deps) {
    const viesResult = await deps.viesClient.checkVatNumber(
      'DE',
      stripCountryPrefix(input.taxIdValue, 'DE'),
      { organizationId: input.organizationId, qualified: true },
    );

    if (viesResult.status === 'unavailable') {
      return {
        apiProvider: 'vies',
        responseStatus: 'UNAVAILABLE',
        confirmationRef: null,
        responseBody: viesResult.raw as unknown as Prisma.InputJsonValue,
        unavailableMessage: `VIES unavailable: ${viesResult.userError}`,
      };
    }

    return {
      apiProvider: 'vies',
      responseStatus: viesResult.status === 'valid' ? 'VALID' : 'INVALID',
      confirmationRef: viesResult.status === 'valid' ? viesResult.confirmationRef : null,
      responseBody: viesResult.raw as unknown as Prisma.InputJsonValue,
    };
  },
};

registerTaxIdValidator(gbVatValidator);
registerTaxIdValidator(deUstIdNrValidator);
