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
