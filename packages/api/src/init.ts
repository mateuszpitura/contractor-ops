import { createLogger } from '@contractor-ops/logger';
import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context.js';
import { observabilityMiddleware } from './middleware/observability.js';

// ---------------------------------------------------------------------------
// F-SEC-20 — Global tRPC error formatter
// ---------------------------------------------------------------------------
//
// The default formatter forwards the raw `Error.message`, stack, and Zod
// issues to clients. A handful of procedures throw raw error text from
// upstream parsers (CSV/XLSX import) and Prisma constraint violations leak
// schema details (constraint names, offending row keys). A targeted
// attacker can probe protected fields by triggering errors and reading
// the structured response.
//
// In production we:
//   1. Always log the original error via @contractor-ops/logger so
//      operators retain full diagnostic detail.
//   2. Preserve `BAD_REQUEST` Zod shapes so client-side form-error
//      mapping continues to work.
//   3. Strip `INTERNAL_SERVER_ERROR` messages to a generic string.
//   4. Cap any other `message` at 200 chars to limit accidental leaks.
//
// In development the default shape is preserved (full message + stack).

const errorLog = createLogger({ component: 'trpc-error-formatter' });

const MAX_CLIENT_MESSAGE_LENGTH = 200;
const GENERIC_INTERNAL_MESSAGE = 'Internal server error';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error, path, type }) {
    const isProduction = process.env.NODE_ENV === 'production';

    // Always log the underlying error so production failures stay debuggable.
    errorLog.error(
      {
        path,
        type,
        code: shape.code,
        cause:
          error.cause instanceof Error
            ? { name: error.cause.name, message: error.cause.message }
            : undefined,
        zodIssues: error.cause instanceof ZodError ? error.cause.issues : undefined,
      },
      error.message,
    );

    if (!isProduction) {
      return shape;
    }

    // Production-safe shape from here down.
    const isZodError = error.cause instanceof ZodError;

    if (error.code === 'BAD_REQUEST' && isZodError) {
      // Preserve Zod issues so forms can map field-level errors. The flatten()
      // result contains only validator-derived strings (no DB internals).
      return {
        ...shape,
        message: 'Invalid input',
        data: {
          ...shape.data,
          zodError: (error.cause as ZodError).flatten(),
        },
      };
    }

    if (error.code === 'INTERNAL_SERVER_ERROR') {
      return {
        ...shape,
        message: GENERIC_INTERNAL_MESSAGE,
        data: {
          ...shape.data,
          // Drop stack/zodError that the default formatter may have included.
          stack: undefined,
          zodError: null,
        },
      };
    }

    // For other coded errors (FORBIDDEN, NOT_FOUND, UNAUTHORIZED, ...), keep
    // the message but cap its length and drop stack. The message field is
    // commonly used for i18n keys (`errors.tenant.noActiveOrganization`),
    // so it must remain present.
    const safeMessage =
      typeof shape.message === 'string'
        ? shape.message.slice(0, MAX_CLIENT_MESSAGE_LENGTH)
        : shape.message;

    return {
      ...shape,
      message: safeMessage,
      data: {
        ...shape.data,
        stack: undefined,
      },
    };
  },
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure.use(t.middleware(observabilityMiddleware));
export const createCallerFactory = t.createCallerFactory;
// Re-exported so call sites can throw these without depending on @trpc/server
// transitively.
export { TRPCError, t };
