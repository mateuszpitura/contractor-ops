// biome-ignore lint/performance/noBarrelFile: package entry point for MSW scenarios
// --- Core scenarios ---

export { degradedHandlers } from './degraded.js';
// --- Infrastructure failures ---
export {
  // KSeF
  ksefAuthFailureHandlers,
  ksefQueryFailedHandlers,
  ksefQueryTimeoutHandlers,
  ocrBlankPageHandlers,
  ocrCorruptPdfHandlers,
  // OCR (Claude)
  ocrTimeoutHandlers,
  r2EmptyObjectHandlers,
  // R2 Storage
  r2ForbiddenHandlers,
  r2NotFoundHandlers,
  redisCorruptResponseHandlers,
  redisDownHandlers,
  // Redis
  redisTimeoutHandlers,
  resendBatchRateLimitHandlers,
  // Email (Resend)
  resendInvalidEmailHandlers,
  resendUnauthorizedHandlers,
} from './infrastructure-failures.js';
export { missingDataHandlers } from './missing-data.js';
// --- Pagination edge cases ---
export {
  clockifyPaginated,
  googleWorkspaceGroupsNotFound,
  googleWorkspacePaginated,
  jiraEmptyPagesWithNonZeroTotal,
  jiraPaginatedWithTokenExpiry,
} from './pagination.js';
export { partialFailureHandlers } from './partial-failure.js';
export { rateLimitedHandlers } from './rate-limited.js';
export { tokenExpiredHandlers } from './token-expired.js';

// --- Webhook edge cases ---
export {
  invalidSignaturePayloads,
  linearLoopPreventionPayloads,
  linearWebhookDuplicateDelivery,
} from './webhook-edge-cases.js';
export { replayWebhook, webhookPayloads } from './webhook-replay.js';
