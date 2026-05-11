// Phase 57 · Plan 03 — Service-layer barrel exports.
//
// This barrel is a *partial* index. Many Phase ≤56 services are consumed via
// direct deep-imports (`@contractor-ops/api/services/<name>` paths declared
// in package.json#exports). The barrel exists to group the Phase 57 tax-ID
// orchestration services for tRPC-router consumption in Plan 57-04.

export {
  applyKleinunternehmerOverride,
  type KleinunternehmerOverrideResult,
  shouldSuppressVatBreakdown,
} from './kleinunternehmer.service';
export {
  applyReverseCharge,
  DE_13B_SERVICE_TYPES,
  type DE13bServiceType,
  detectReverseCharge,
  type ReverseChargeResult,
} from './reverse-charge.service';
export { maskTaxId } from './tax-id-pii';
export {
  getLatestValidation,
  isValidationFresh,
  type LatestValidationRow,
  NINETY_DAYS_MS,
  type TaxIdValidationDeps,
  type TaxIdValidationInput,
  type TaxIdValidationResult,
  validateTaxId,
} from './tax-id-validation.service';
