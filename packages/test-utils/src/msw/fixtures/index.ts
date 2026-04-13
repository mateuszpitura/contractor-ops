export { replayWebhook, webhookPayloads } from '../scenarios/webhook-replay.js';

// Re-export fixture factories organized by provider.
// These generate realistic payloads for testing webhook handlers,
// API response parsing, and data transformation.

// Phase 57 — HMRC + VIES fixtures
export * as hmrcFixtures from './hmrc.js';
export { jiraFixtures } from './jira.js';
export { linearFixtures } from './linear.js';
export { ocrFixtures } from './ocr.js';
export { stripeFixtures } from './stripe.js';
export * as viesFixtures from './vies.js';
