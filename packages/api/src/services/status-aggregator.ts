import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';

const log = createLogger({ service: 'status-aggregator' });

// Coarse public component states. Deliberately three buckets — the public status
// page exposes NO tenant data, no per-org metric, no raw probe body.
export type ComponentStatus = 'operational' | 'degraded' | 'down';

export const STATUS_COMPONENTS = ['api', 'webhooks-dispatcher', 'background-jobs'] as const;
export type StatusComponent = (typeof STATUS_COMPONENTS)[number];

export interface StatusIncident {
  id: string;
  title: string;
  status: 'OPEN' | 'MONITORING' | 'RESOLVED';
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  componentsAffected: string[];
  startedAt: string;
  latestUpdate: string | null;
}

export interface StatusReport {
  updatedAt: string;
  components: Record<StatusComponent, { status: ComponentStatus }>;
  incidents: StatusIncident[];
}

// Mirrors the shipped webhook-dispatcher health rule in the cron worker's
// job-health handler (recentFailureCount / pendingCount thresholds).
const FAILURE_ALERT_THRESHOLD = 10;
const PENDING_ALERT_THRESHOLD = 100;
const PROBE_TIMEOUT_MS = 1500;

/** Race a probe against a timeout so a stalled/unavailable source never hangs the page. */
async function withTimeout<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      work(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('status probe timeout')), PROBE_TIMEOUT_MS),
      ),
    ]);
  } catch (err) {
    log.warn({ err }, 'status probe degraded');
    return fallback;
  }
}

/** api = liveness of the primary datastore behind the request path. */
function probeApi(): Promise<ComponentStatus> {
  return withTimeout(async () => {
    await prisma.$queryRaw`SELECT 1`;
    return 'operational' as ComponentStatus;
  }, 'degraded');
}

/** webhooks-dispatcher = the shipped webhook-delivery failure/queue-depth signal. */
function probeDispatcher(): Promise<ComponentStatus> {
  return withTimeout(async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recentFailureCount, pendingCount] = await Promise.all([
      prisma.webhookDelivery.count({
        where: { deliveryStatus: 'FAILED', processedAt: { gte: oneHourAgo } },
      }),
      prisma.webhookDelivery.count({
        where: { deliveryStatus: { in: ['RECEIVED', 'PROCESSING'] } },
      }),
    ]);
    if (recentFailureCount > FAILURE_ALERT_THRESHOLD || pendingCount > PENDING_ALERT_THRESHOLD) {
      return 'down' as ComponentStatus;
    }
    if (recentFailureCount > 0 || pendingCount > PENDING_ALERT_THRESHOLD / 2) {
      return 'degraded' as ComponentStatus;
    }
    return 'operational' as ComponentStatus;
  }, 'degraded');
}

/** background-jobs = the outbox drain backlog / recent failure signal. */
function probeJobs(): Promise<ComponentStatus> {
  return withTimeout(async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recentFailureCount, backlogCount] = await Promise.all([
      prisma.outboxEvent.count({ where: { status: 'FAILED', failedAt: { gte: oneHourAgo } } }),
      prisma.outboxEvent.count({
        where: { status: 'PENDING', nextAttemptAt: { lt: new Date() } },
      }),
    ]);
    if (recentFailureCount > FAILURE_ALERT_THRESHOLD || backlogCount > PENDING_ALERT_THRESHOLD) {
      return 'down' as ComponentStatus;
    }
    if (recentFailureCount > 0 || backlogCount > PENDING_ALERT_THRESHOLD / 2) {
      return 'degraded' as ComponentStatus;
    }
    return 'operational' as ComponentStatus;
  }, 'degraded');
}

type IncidentUpdateEntry = { at?: string; message?: string };

function latestUpdateMessage(updates: unknown): string | null {
  if (!Array.isArray(updates) || updates.length === 0) return null;
  const last = updates[updates.length - 1] as IncidentUpdateEntry;
  return typeof last?.message === 'string' ? last.message : null;
}

/** Open + monitoring incidents, mapped to a tenant-data-free public shape. */
function openIncidents(): Promise<StatusIncident[]> {
  return withTimeout(async () => {
    const rows = await prisma.incidentReport.findMany({
      where: { status: { in: ['OPEN', 'MONITORING'] } },
      orderBy: { startedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        severity: true,
        componentsAffected: true,
        startedAt: true,
        updates: true,
      },
    });
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      status: row.status,
      severity: row.severity,
      componentsAffected: row.componentsAffected,
      startedAt: row.startedAt.toISOString(),
      latestUpdate: latestUpdateMessage(row.updates),
    }));
  }, [] as StatusIncident[]);
}

const SEVERITY_RANK: Record<ComponentStatus, number> = { operational: 0, degraded: 1, down: 2 };

/** Downgrade a component to at least the level implied by an open incident. */
function worst(a: ComponentStatus, b: ComponentStatus): ComponentStatus {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

/**
 * Aggregate the SHIPPED health sources into three coarse public component states
 * plus open-incident history. Every probe is timeout-guarded and fail-safe: an
 * unavailable source degrades only its own component, never throws. The result
 * carries no tenant data.
 */
export async function aggregateStatus(): Promise<StatusReport> {
  const [api, dispatcher, jobs, incidents] = await Promise.all([
    probeApi(),
    probeDispatcher(),
    probeJobs(),
    openIncidents(),
  ]);

  const components: Record<StatusComponent, { status: ComponentStatus }> = {
    api: { status: api },
    'webhooks-dispatcher': { status: dispatcher },
    'background-jobs': { status: jobs },
  };

  // Overlay operator incidents: a CRITICAL incident forces its components down,
  // a lesser one to degraded — the operator signal never de-escalates a live probe.
  for (const incident of incidents) {
    const floor: ComponentStatus = incident.severity === 'CRITICAL' ? 'down' : 'degraded';
    for (const key of incident.componentsAffected) {
      if (key in components) {
        const comp = key as StatusComponent;
        components[comp] = { status: worst(components[comp].status, floor) };
      }
    }
  }

  return { updatedAt: new Date().toISOString(), components, incidents };
}
