// Phase 57 · Plan 03 — Service-layer barrel exports.
//
// This barrel is a *partial* index. Many Phase ≤56 services are consumed via
// direct deep-imports (`@contractor-ops/api/services/<name>` paths declared
// in package.json#exports). The barrel exists to group the Phase 57 tax-ID
// orchestration services for tRPC-router consumption in Plan 57-04.

export {
  getLatestValidation,
  isValidationFresh,
  NINETY_DAYS_MS,
  validateTaxId,
  type LatestValidationRow,
  type TaxIdValidationDeps,
  type TaxIdValidationInput,
  type TaxIdValidationResult,
} from './tax-id-validation.service.js';

export { maskTaxId } from './tax-id-pii.js';

export {
  applyReverseCharge,
  detectReverseCharge,
  DE_13B_SERVICE_TYPES,
  type DE13bServiceType,
  type ReverseChargeResult,
} from './reverse-charge.service.js';

export {
  applyKleinunternehmerOverride,
  shouldSuppressVatBreakdown,
  type KleinunternehmerOverrideResult,
} from './kleinunternehmer.service.js';
