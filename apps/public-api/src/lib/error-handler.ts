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
 * Checks if an error is a TRPCError by duck-typing (avoids direct @trpc/server dependency).
 */
function isTRPCError(err: unknown): err is { code: string; message: string } {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false;
  const code = (err as { code: unknown }).code;
  return typeof code === 'string' && code in TRPC_TO_HTTP;
}

/**
 * Hono error handler that catches tRPC errors and maps them
 * to structured JSON HTTP responses.
 */
export function handleError(err: Error, c: Context) {
  if (isTRPCError(err)) {
    const status = mapTrpcCodeToHttp(err.code);
    return c.json(formatErrorResponse(status, err.message, err.message), status as 400);
  }

  console.error('[public-api] Unhandled error:', err);

  return c.json(
    formatErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'),
    500,
  );
}
