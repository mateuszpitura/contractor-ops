import { vi } from 'vitest';

import { createLoggerMetricsMock, createLoggerMock } from './__mocks__/logger';

vi.mock('@contractor-ops/logger', () => createLoggerMock());

vi.mock('@contractor-ops/logger/metrics', () => createLoggerMetricsMock());

// register-all.ts eagerly dynamic-imports every heavy adapter at module load.
// Partial per-test adapter mocks (e.g. clockify, notion) must not trigger
// registerAdapter() with incomplete stub classes — that yields unhandled
// rejections and exit 1 despite all assertions passing.
vi.mock('@contractor-ops/integrations/adapters/register-all', () => ({
  registerAllAdapters: vi.fn(),
  loadHeavyAdapters: vi.fn().mockResolvedValue(undefined),
  __resetAdapterRegistrationForTests: vi.fn(),
}));
