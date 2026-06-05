import { vi } from 'vitest';

const noopLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(() => noopLogger),
};

vi.mock('@contractor-ops/logger', () => ({
  logger: noopLogger,
  createLogger: vi.fn(() => noopLogger),
  createTrpcLogger: vi.fn(() => noopLogger),
  createCronLogger: vi.fn(() => noopLogger),
  createWebhookLogger: vi.fn(() => noopLogger),
  createIntegrationLogger: vi.fn(() => noopLogger),
  getIdpAuditLogger: vi.fn(() => noopLogger),
  withBodyLogging: vi.fn((_opts, fn) => fn),
  logIntegrationCall: vi.fn(),
  subscribeOpossumEvents: vi.fn(),
  runWithRequestContext: vi.fn((_ctx, fn) => fn()),
  getRequestId: vi.fn(() => undefined),
  getTraceparent: vi.fn(() => undefined),
  buildContextFromHeaders: vi.fn(() => ({})),
  getOutboundHeaders: vi.fn(() => ({})),
  generateRequestId: vi.fn(() => 'test-request-id'),
  LOG_BODY_INCLUDE_PREFIXES: [],
  PII_MASK_KEYWORDS: [],
  PII_MASK_PATHS: [],
}));

vi.mock('@contractor-ops/logger/metrics', () => ({
  metrics: {
    increment: vi.fn(),
    distribution: vi.fn(),
    histogram: vi.fn(),
    gauge: vi.fn(),
  },
}));

// register-all.ts eagerly dynamic-imports every heavy adapter at module load.
// Partial per-test adapter mocks (e.g. clockify, notion) must not trigger
// registerAdapter() with incomplete stub classes — that yields unhandled
// rejections and exit 1 despite all assertions passing.
vi.mock('@contractor-ops/integrations/adapters/register-all', () => ({
  registerAllAdapters: vi.fn(),
  loadHeavyAdapters: vi.fn().mockResolvedValue(undefined),
  __resetAdapterRegistrationForTests: vi.fn(),
}));
