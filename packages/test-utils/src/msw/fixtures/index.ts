export { replayWebhook, webhookPayloads } from '../scenarios/webhook-replay.js';

// Re-export fixture factories organized by provider.
// These generate realistic payloads for testing webhook handlers,
// API response parsing, and data transformation.

export { dataportFixtures } from './dataport.js';
// Phase 57 — HMRC + VIES fixtures
export {
  HMRC_OAUTH_TOKEN_200,
  HMRC_SANDBOX_INVALID_VRN,
  HMRC_SANDBOX_VALID_VRN,
  HMRC_VAT_LOOKUP_200,
  HMRC_VAT_LOOKUP_404,
  HMRC_VAT_LOOKUP_500,
} from './hmrc.js';
export { jiraFixtures } from './jira.js';
export { linearFixtures } from './linear.js';
export { ocrFixtures } from './ocr.js';
export { stripeFixtures } from './stripe.js';
export {
  VIES_INVALID_200,
  VIES_MS_UNAVAILABLE,
  VIES_QUALIFIED_200,
  VIES_SIMPLE_VALID_200,
} from './vies.js';
