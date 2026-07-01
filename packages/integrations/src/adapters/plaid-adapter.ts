// Public entrypoint for the Plaid Identity verification seam.
//
// The seam implementation lives under ./plaid/ (interface + deterministic mock
// default + dark live client). This module re-exports that barrel at the flat
// adapters/ path the Wave-0 verification contract pins, mirroring how the
// tin-match seam is re-exported from the package barrel.
export {
  LivePlaidIdentityClient,
  type LivePlaidIdentityClientConfig,
  MockPlaidIdentityClient,
  type PlaidIdentityClient,
  type PlaidVerificationResult,
  type PlaidVerificationStatus,
  type PlaidVerifyInput,
} from './plaid/index.js';
