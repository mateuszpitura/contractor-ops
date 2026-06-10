// Gov-API client barrel exports.

export {
  HmrcApiError,
  HmrcVatClient,
  type HmrcVatClientDeps,
  type HmrcVatLookupResult,
} from './hmrc-vat-client.js';
export {
  USPS_RATE_LIMIT,
  type UspsAddressCache,
  UspsAddressClient,
  type UspsAddressClientDeps,
  type UspsAddressInput,
  type UspsNormalizedResult,
  type UspsRateLimiter,
  type UspsValidationResult,
  type UspsValidationStatus,
} from './usps-client.js';
export {
  ViesApiError,
  ViesClient,
  type ViesClientDeps,
  type ViesLookupResult,
} from './vies-client.js';
