import { createLogger } from '@contractor-ops/logger';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client/client.js';

/**
 * pg.Pool sizing — per Prisma instance. Each Render service (web, public-api,
 * worker) instantiates 1+ Prisma clients (region clients, read replicas), so
 * total connections = sum across services and instances. Keep `max`
 * conservative so we stay well under Neon's per-project budget:
 *   - free tier:    ~100 connections to pooler
 *   - launch tier:  ~1000
 *   - scale tier:   ~10000
 * Default 10 is sane for a single instance on free tier (10 × 3 services × 2
 * regions ≈ 60). Override via `PG_POOL_MAX` when scaling out.
 */
const PG_POOL_MAX = Number.parseInt(process.env.PG_POOL_MAX ?? '10', 10);

/**
 * Slow-query threshold in ms. Queries that take longer than this emit a Pino
 * `warn` log line so we can spot regressions / N+1 in production. 200ms is
 * the default.
 */
const SLOW_QUERY_THRESHOLD_MS = Number.parseInt(
  process.env.PRISMA_SLOW_QUERY_THRESHOLD_MS ?? '200',
  10,
);

/**
 * Tables whose query parameters contain PII / Art. 9 sensitive data. The slow
 * query logger suppresses the `params` field for these tables so emails, tax
 * IDs, names, etc. never reach Axiom via the query log.
 *
 * Add new table names here whenever a multi-tenant table starts holding PII.
 */
const PII_QUERY_PARAM_TABLES: ReadonlySet<string> = new Set([
  'User',
  'Member',
  'Contractor',
  'Account',
  'Session',
]);

const dbLog = createLogger({ service: 'db' });

/** Safe to unit-test without touching the module singleton `prisma`. */
export function createMissingDatabaseUrlProxy(): PrismaClient {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('DATABASE_URL environment variable is not set');
      },
    },
  ) as PrismaClient;
}

interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

interface PrismaWarnEvent {
  timestamp: Date;
  message: string;
  target: string;
}

interface PrismaErrorEvent {
  timestamp: Date;
  message: string;
  target: string;
}

type PrismaEventClient = PrismaClient & {
  $on(event: 'query', listener: (event: PrismaQueryEvent) => void): void;
  $on(event: 'warn', listener: (event: PrismaWarnEvent) => void): void;
  $on(event: 'error', listener: (event: PrismaErrorEvent) => void): void;
};

/**
 * Strips the parameter list from query log events when the SQL touches a PII
 * table. We can't always tell from the SQL alone (especially for raw $queryRaw
 * / joins), so the check is conservative: if ANY known PII table name appears
 * as a quoted identifier we drop params.
 */
function shouldRedactQueryParams(sql: string): boolean {
  for (const table of PII_QUERY_PARAM_TABLES) {
    if (sql.includes(`"${table}"`) || sql.includes(`\`${table}\``)) {
      return true;
    }
  }
  return false;
}

/**
 * Wires Prisma's event-driven log channel to Pino:
 * - `query` events above the slow threshold emit a `warn` line.
 * - `warn` events emit a Pino `warn`.
 * - `error` events emit a Pino `error`.
 *
 * Params are suppressed for PII tables (see `PII_QUERY_PARAM_TABLES`).
 */
function attachQueryLogger(client: PrismaClient): void {
  const eventClient = client as PrismaEventClient;
  try {
    eventClient.$on('query', (event: PrismaQueryEvent) => {
      if (event.duration < SLOW_QUERY_THRESHOLD_MS) return;
      const redactParams = shouldRedactQueryParams(event.query);
      dbLog.warn(
        {
          duration_ms: event.duration,
          query: event.query,
          ...(redactParams ? { params: '[REDACTED]' } : { params: event.params }),
        },
        'prisma slow query',
      );
    });
    eventClient.$on('warn', (event: PrismaWarnEvent) => {
      dbLog.warn({ message: event.message, target: event.target }, 'prisma warn');
    });
    eventClient.$on('error', (event: PrismaErrorEvent) => {
      dbLog.error({ message: event.message, target: event.target }, 'prisma error');
    });
  } catch (err) {
    // Defensive: $on may throw if the client was created without
    // `log: [{ emit: 'event', ... }]`. Don't crash the app boot just because
    // observability wiring failed.
    dbLog.warn({ err }, 'failed to attach Prisma event listeners');
  }
}

/** Creates a PrismaClient connected to the given Postgres connection string. */
export function createPrismaClientForUrl(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    max: PG_POOL_MAX,
    // Release idle connections after 30s so long-lived processes don't hold
    // sockets they don't actively use (Neon counts active sockets toward the
    // per-project budget even when idle).
    idleTimeoutMillis: 30_000,
    // Fail fast if the pool is exhausted — better than queueing indefinitely
    // and timing out at a downstream layer with a less actionable error.
    connectionTimeoutMillis: 5_000,
  });
  const client = new PrismaClient({
    adapter,
    // Opt into event-driven logs so we can pipe slow queries into Pino at a
    // single, configurable threshold (200ms by default).
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
    ],
  });
  attachQueryLogger(client);
  return client;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  return createPrismaClientForUrl(connectionString);
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  (process.env.DATABASE_URL ? createPrismaClient() : createMissingDatabaseUrlProxy());

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
