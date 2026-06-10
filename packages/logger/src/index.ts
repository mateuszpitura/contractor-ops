import { createRequire } from 'node:module';
import type { DestinationStream, Logger, LoggerOptions } from 'pino';
import pino from 'pino';
import { PII_MASK_PATHS } from './pii-mask.js';
import { getRequestContext } from './request-context.js';

// ESM bridge — `require` is undefined in pure ESM (e.g. apps/api,
// apps/cron-worker, apps/public-api), which silently disabled the
// pino-pretty branch below. Bridge it once at module load.
const requireFromHere = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV !== 'production';

// ---------------------------------------------------------------------------
// Pino mixin — injects per-request correlation ids on every log line
// ---------------------------------------------------------------------------
//
// When an ALS frame is active (seeded by the tRPC observability middleware,
// the QStash consumer routes, or the auth route wrapper) every log line —
// including those emitted by module-scoped loggers in routers / services that
// hold no per-request bindings — gets `{ requestId, traceparent }`. Mixin
// must be cheap and never throw; the ALS helpers swallow internal errors for
// that reason.
function requestContextMixin(): Record<string, string> {
  const ctx = getRequestContext();
  if (!ctx) return {};
  if (ctx.traceparent) {
    return { requestId: ctx.requestId, traceparent: ctx.traceparent };
  }
  return { requestId: ctx.requestId };
}

// ---------------------------------------------------------------------------
// Base logger configuration
// ---------------------------------------------------------------------------

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  mixin: requestContextMixin,
  redact: {
    paths: [...PII_MASK_PATHS],
    censor: '[REDACTED]',
  },
};

/**
 * Returns a *copy* of the shared Pino base options used by the root logger.
 *
 * Standalone scripts (`packages/db/scripts/*`, prisma seed) and the
 * worker-cron `.mjs` previously called `pino({ level })` with no PII redact,
 * no ISO timestamp, and no shared mixin, which let scripts drift away from
 * the rest of the app's log shape. They should use this factory so PII
 * redact + level config + mixins stay in lockstep.
 *
 * Returned object is a shallow clone — callers may extend `redact.paths`
 * without mutating the shared list.
 */
export function getBaseLoggerOptions(): LoggerOptions {
  return {
    ...baseOptions,
    redact: { paths: [...PII_MASK_PATHS], censor: '[REDACTED]' },
  };
}

export {
  createIdpAuditChild,
  getIdpAuditLogger,
  hashExternalUserId,
  IDP_AUDIT_ALLOWED_FIELDS,
  type IdpAuditAllowedField,
  type IdpAuditEvent,
} from './idp-audit-logger.js';
export type {
  IntegrationCallOutcome,
  LogIntegrationCallParams,
} from './integration-events.js';
export { logIntegrationCall, subscribeOpossumEvents } from './integration-events.js';
export { LOG_BODY_INCLUDE_PREFIXES } from './log-body-include-prefixes.js';
export type { PiiMaskKeyword } from './pii-mask.js';
export { PII_MASK_KEYWORDS, PII_MASK_PATHS } from './pii-mask.js';
export {
  buildContextFromHeaders,
  generateRequestId,
  getOutboundHeaders,
  getRequestContext,
  getRequestId,
  getTraceparent,
  getTracestate,
  isValidTraceparent,
  type RequestContext,
  runWithRequestContext,
  runWithRequestId,
} from './request-context.js';
export { withBodyLogging } from './with-body-logging.js';

// ---------------------------------------------------------------------------
// Root logger
// ---------------------------------------------------------------------------

/**
 * Creates the root pino logger with the appropriate destination:
 *
 * - **Dev (AXIOM_DEV=true)**: pino-pretty stdout + Axiom via sync stream.
 * - **Dev (default)**: pino-pretty sync stream to stdout only.
 * - **Production with Axiom**: Axiom via sync stream (+ stdout JSON).
 * - **Production without Axiom**: plain JSON to stdout.
 *
 * Axiom is always sent via a custom Writable stream using @axiomhq/js SDK
 * (no worker threads) so it works inside Next.js webpack bundling.
 */
function createRootLogger(): Logger {
  const axiomDataset = process.env.AXIOM_DATASET;
  const axiomToken = process.env.AXIOM_TOKEN;
  const axiomInDev = process.env.AXIOM_DEV === 'true';
  const hasAxiom = !!(axiomDataset && axiomToken);
  const sendToAxiom = hasAxiom && (!isDev || axiomInDev);

  // Local-dev Loki replacement for Axiom. `LOKI_URL` is the only signal —
  // when present we fan out a Pino stream that pushes to
  // `${LOKI_URL}/loki/api/v1/push`. Prod leaves `LOKI_URL` unset, the
  // branch is skipped, and Axiom stays the canonical shipper.
  const lokiUrl = process.env.LOKI_URL;

  // Build stream list for pino.multistream.
  const streams: pino.StreamEntry[] = [];

  // ── Pretty stdout (dev) or plain stdout (prod) ────────────────────
  if (isDev) {
    try {
      const pretty = requireFromHere('pino-pretty') as typeof import('pino-pretty');
      streams.push({
        level: baseOptions.level as pino.Level,
        stream: pretty({
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: true,
        }),
      });
    } catch {
      streams.push({ level: baseOptions.level as pino.Level, stream: process.stdout });
    }
  } else {
    streams.push({ level: baseOptions.level as pino.Level, stream: process.stdout });
  }

  // ── Axiom stream (sync, no worker threads) ────────────────────────
  if (sendToAxiom) {
    try {
      const { createAxiomStream } = requireFromHere(
        './axiom-stream.js',
      ) as typeof import('./axiom-stream.js');
      streams.push({
        level: baseOptions.level as pino.Level,
        stream: createAxiomStream({ dataset: axiomDataset as string, token: axiomToken as string }),
      });
    } catch {
      // Axiom stream failed to initialize — continue with stdout only.
    }
  }

  // ── Loki stream (dev-local; opt-in via LOKI_URL) ──────────────────
  if (lokiUrl) {
    try {
      const { createLokiStream } = requireFromHere(
        './loki-stream.js',
      ) as typeof import('./loki-stream.js');
      streams.push({
        level: baseOptions.level as pino.Level,
        stream: createLokiStream({
          url: lokiUrl,
          // The service tag is overridden per-line when present in the
          // JSON payload (api-server / cron-worker / public-api set it
          // via createLogger). `app` is the fallback for the root logger.
          service: process.env.LOKI_SERVICE_LABEL ?? 'app',
        }),
      });
    } catch {
      // Loki stream failed to initialize — continue with the streams
      // that did. Best-effort, dev-only.
    }
  }

  if (streams.length === 1 && streams[0]) {
    return pino(baseOptions, streams[0].stream as DestinationStream);
  }

  return pino(baseOptions, pino.multistream(streams));
}

export const logger: Logger = createRootLogger();

// ---------------------------------------------------------------------------
// Context-aware child loggers
// ---------------------------------------------------------------------------

export type LogContext = {
  service?: string;
  organizationId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
};

/**
 * Creates a child logger with contextual bindings.
 * Use for request-scoped or service-scoped logging.
 *
 * @example
 * const log = createLogger({ service: "billing", organizationId: "org_123" });
 * log.info({ amount: 100 }, "checkout session created");
 */
export function createLogger(context: LogContext): Logger {
  return logger.child(context);
}

// ---------------------------------------------------------------------------
// Service-specific logger factories
// ---------------------------------------------------------------------------

/** Logger for tRPC procedure calls */
export function createTrpcLogger(meta: {
  procedure: string;
  type: string;
  userId?: string;
  organizationId?: string;
  requestId?: string;
}): Logger {
  return logger.child({ service: 'trpc', ...meta });
}

/** Logger for cron jobs */
export function createCronLogger(jobName: string): Logger {
  return logger.child({ service: 'cron', job: jobName });
}

/** Logger for webhook handlers */
export function createWebhookLogger(provider: string): Logger {
  return logger.child({ service: 'webhook', provider });
}

/** Logger for integration adapters */
export function createIntegrationLogger(provider: string): Logger {
  return logger.child({ service: 'integration', provider });
}

export type { Logger };
