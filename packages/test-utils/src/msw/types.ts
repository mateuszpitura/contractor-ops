import type { HttpHandler } from 'msw';

/**
 * Configuration for simulating network conditions per-handler.
 */
export interface NetworkCondition {
  /** Fixed delay in milliseconds before responding */
  delayMs?: number;
  /** Random delay range [min, max] in milliseconds */
  delayRange?: [min: number, max: number];
  /** Probability (0-1) of returning an error instead of success */
  errorRate?: number;
  /** HTTP status to return on simulated error (default: 500) */
  errorStatus?: number;
  /** Error body to return on simulated error */
  errorBody?: unknown;
}

/**
 * Options for creating handler sets with configurable behavior.
 */
export interface HandlerOptions {
  /** Network conditions applied to all handlers in this set */
  network?: NetworkCondition;
}

/** A function that returns MSW handlers, optionally with network conditions */
export type HandlerFactory = (options?: HandlerOptions) => HttpHandler[];

/**
 * OAuth token response shape common across most providers.
 */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

/**
 * Webhook event stored for test assertions.
 */
export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
}
