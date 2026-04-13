import { TRPCError } from '@trpc/server';
import type { Context } from 'hono';

// ---------------------------------------------------------------------------
// tRPC → HTTP status code mapping
// ---------------------------------------------------------------------------

const TRPC_TO_HTTP: Record<string, number> = {
  PARSE_ERROR: 422,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  TIMEOUT: 408,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500,
};

function mapTrpcCodeToHttp(code: string): number {
  return TRPC_TO_HTTP[code] ?? 500;
}

function formatErrorResponse(status: number, code: string, message: string) {
  return {
    error: {
      code,
      message,
      status,
    },
  };
}

/**
 * Hono error handler that catches TRPCError instances and maps them
 * to structured JSON HTTP responses. Uses instanceof for reliable detection.
 */
export function handleError(err: Error, c: Context) {
  if (err instanceof TRPCError) {
    const status = mapTrpcCodeToHttp(err.code);
    return c.json(formatErrorResponse(status, err.message, err.message), status as 400);
  }

  console.error('[public-api] Unhandled error:', err);

  return c.json(
    formatErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'),
    500,
  );
}
