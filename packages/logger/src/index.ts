import type { DestinationStream, Logger, LoggerOptions } from 'pino';
import pino from 'pino';
import { PII_MASK_PATHS } from './pii-mask.js';

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV !== 'production';

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
  redact: {
    paths: [...PII_MASK_PATHS],
    censor: '[REDACTED]',
  },
};

export { PII_MASK_KEYWORDS, PII_MASK_PATHS } from './pii-mask.js';
export type { PiiMaskKeyword } from './pii-mask.js';

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

  // Build stream list for pino.multistream.
  const streams: pino.StreamEntry[] = [];

  // ── Pretty stdout (dev) or plain stdout (prod) ────────────────────
  if (isDev) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pretty = require('pino-pretty') as typeof import('pino-pretty');
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createAxiomStream } = require('./axiom-stream.js');
      streams.push({
        level: baseOptions.level as pino.Level,
        stream: createAxiomStream({ dataset: axiomDataset!, token: axiomToken! }),
      });
    } catch {
      // Axiom stream failed to initialize — continue with stdout only.
    }
  }

  if (streams.length === 1) {
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
