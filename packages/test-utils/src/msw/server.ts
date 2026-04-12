import type { HttpHandler } from 'msw';
import type { SetupServer } from 'msw/node';
import { setupServer } from 'msw/node';
import { allHandlers } from './handlers/index.js';
import type { HandlerOptions } from './types.js';
import { RequestCapture } from './utils.js';

/* Global test lifecycle hooks — provided by vitest with globals: true */
declare function beforeAll(fn: () => void): void;
declare function afterEach(fn: () => void): void;
declare function afterAll(fn: () => void): void;

export interface MockServerOptions {
  /** Override default handler options (e.g., add network conditions) */
  handlerOptions?: HandlerOptions;
  /** Additional handlers to include */
  extraHandlers?: HttpHandler[];
  /** If true, only use extraHandlers (skip default handlers) */
  handlersOnly?: boolean;
}

/**
 * Create a pre-configured MSW server with all provider handlers.
 *
 * Usage in vitest:
 * ```ts
 * import { createMockServer } from "@contractor-ops/test-utils/msw/server";
 *
 * const { server, capture } = createMockServer();
 *
 * beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
 * afterEach(() => { server.resetHandlers(); capture.clear(); });
 * afterAll(() => server.close());
 * ```
 */
export function createMockServer(options: MockServerOptions = {}): {
  server: SetupServer;
  capture: RequestCapture;
} {
  const capture = new RequestCapture();

  const handlers: HttpHandler[] = [];

  if (!options.handlersOnly) {
    handlers.push(...allHandlers(options.handlerOptions));
  }

  if (options.extraHandlers) {
    handlers.push(...options.extraHandlers);
  }

  const server = setupServer(...handlers);

  return { server, capture };
}

/**
 * Convenience: create server, set up vitest lifecycle hooks.
 * Call this at the top of your test file.
 *
 * ```ts
 * import { useMockServer } from "@contractor-ops/test-utils/msw/server";
 *
 * const { server, capture } = useMockServer();
 * ```
 */
export function useMockServer(options: MockServerOptions = {}): {
  server: SetupServer;
  capture: RequestCapture;
} {
  const { server, capture } = createMockServer(options);

  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => {
    server.resetHandlers();
    capture.clear();
  });
  afterAll(() => server.close());

  return { server, capture };
}

export type { SetupServer };
