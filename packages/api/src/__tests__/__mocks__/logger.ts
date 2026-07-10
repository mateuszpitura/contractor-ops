import { vi } from 'vitest';

const noopLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(),
};

noopLogger.child.mockImplementation(() => noopLogger);

/** Production-parity `@contractor-ops/logger` stub for vitest. */
export function createLoggerMock() {
  return {
    logger: noopLogger,
    createLogger: vi.fn(() => noopLogger),
    createTrpcLogger: vi.fn(() => noopLogger),
    createCronLogger: vi.fn(() => noopLogger),
    createWebhookLogger: vi.fn(() => noopLogger),
    createIntegrationLogger: vi.fn(() => noopLogger),
    getIdpAuditLogger: vi.fn(() => noopLogger),
    withBodyLogging: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
    logIntegrationCall: vi.fn(),
    subscribeOpossumEvents: vi.fn(),
    runWithRequestContext: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
    getRequestId: vi.fn(() => undefined),
    getTraceparent: vi.fn(() => undefined),
    buildContextFromHeaders: vi.fn(() => ({})),
    getOutboundHeaders: vi.fn(() => ({})),
    generateRequestId: vi.fn(() => 'test-request-id'),
    LOG_BODY_INCLUDE_PREFIXES: [] as string[],
    PII_MASK_KEYWORDS: [] as string[],
    PII_MASK_PATHS: [] as string[],
  };
}

export function createLoggerMetricsMock() {
  return {
    metrics: {
      increment: vi.fn(),
      distribution: vi.fn(),
      histogram: vi.fn(),
      gauge: vi.fn(),
    },
  };
}
