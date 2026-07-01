// Public entrypoint for the programmatic-ACH payout seam.
//
// The seam implementation lives under ./payout/ (interface + deterministic mock
// default + dark live originator + Stripe stub). This module re-exports that
// barrel at the flat adapters/ path the Wave-0 payout-initiation contract pins,
// mirroring how the tin-match seam is re-exported from the package barrel.
export {
  LiveModernTreasuryAdapter,
  type LiveModernTreasuryAdapterConfig,
  MockModernTreasuryAdapter,
  type PayoutInitiationAdapter,
  type PayoutInput,
  type PayoutOrder,
  type PayoutOrderStatus,
  type PayoutWebhookEvent,
  StripeTreasuryAdapter,
} from './payout/index.js';
