'use client';

import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';

import { cn } from '@/lib/utils';

export type ComponentState = 'operational' | 'degraded' | 'down';

export interface StatusComponent {
  status: ComponentState;
}

export interface StatusIncident {
  id: string;
  title: string;
  status: 'OPEN' | 'MONITORING';
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  componentsAffected: string[];
  startedAt: string;
  latestUpdate: string | null;
}

export interface StatusReport {
  updatedAt: string;
  components: Record<string, StatusComponent>;
  incidents: StatusIncident[];
}

/**
 * The public status endpoint. Defaults to the local public-API port so a dev
 * build works out of the box; production points it at the deployed public-API
 * host (the `status.contractor-ops.{tld}` DNS entry is a deferred step).
 */
const STATUS_URL = `${
  process.env.NEXT_PUBLIC_PUBLIC_API_URL ?? 'http://localhost:4100'
}/status.json`;

/** Human labels + display order for the three coarse components. */
const COMPONENT_LABELS: Record<string, string> = {
  api: 'API',
  'webhooks-dispatcher': 'Webhook delivery',
  'background-jobs': 'Background jobs',
};
const COMPONENT_ORDER = ['api', 'webhooks-dispatcher', 'background-jobs'];

const STATE_PRESENTATION: Record<
  ComponentState,
  { label: string; icon: LucideIcon; dot: string; text: string }
> = {
  operational: {
    label: 'Operational',
    icon: CheckCircle2,
    dot: 'bg-success',
    text: 'text-success',
  },
  degraded: {
    label: 'Degraded',
    icon: AlertTriangle,
    dot: 'bg-warning',
    text: 'text-warning',
  },
  down: { label: 'Outage', icon: XCircle, dot: 'bg-destructive', text: 'text-destructive' },
};

const SEVERITY_LABELS: Record<StatusIncident['severity'], string> = {
  MINOR: 'Minor',
  MAJOR: 'Major',
  CRITICAL: 'Critical',
};

export function deriveOverall(report: StatusReport): ComponentState {
  const states = Object.values(report.components).map(c => c.status);
  if (states.includes('down')) return 'down';
  if (states.includes('degraded')) return 'degraded';
  return 'operational';
}

const OVERALL_HEADLINE: Record<ComponentState, string> = {
  operational: 'All systems operational',
  degraded: 'Some systems degraded',
  down: 'Active service outage',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function OverallBanner({ overall, updatedAt }: { overall: ComponentState; updatedAt: string }) {
  const presentation = STATE_PRESENTATION[overall];
  const Icon = presentation.icon;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8',
        'before:absolute before:inset-y-0 before:start-0 before:w-1.5',
        overall === 'operational' && 'before:bg-success',
        overall === 'degraded' && 'before:bg-warning',
        overall === 'down' && 'before:bg-destructive',
      )}>
      <div className="flex items-center gap-4">
        <Icon aria-hidden="true" className={cn('size-9 shrink-0', presentation.text)} />
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {OVERALL_HEADLINE[overall]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last checked <time dateTime={updatedAt}>{formatTime(updatedAt)}</time>
          </p>
        </div>
      </div>
    </div>
  );
}

function ComponentRow({ name, state }: { name: string; state: ComponentState }) {
  const presentation = STATE_PRESENTATION[state];
  const Icon = presentation.icon;
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="font-medium">{COMPONENT_LABELS[name] ?? name}</span>
      <span className={cn('inline-flex items-center gap-2 text-sm font-medium', presentation.text)}>
        <span aria-hidden="true" className={cn('size-2 rounded-full', presentation.dot)} />
        <Icon aria-hidden="true" className="size-4" />
        {presentation.label}
      </span>
    </li>
  );
}

function IncidentItem({ incident }: { incident: StatusIncident }) {
  return (
    <li className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{incident.title}</h3>
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className="rounded-full border px-2 py-0.5">
            {SEVERITY_LABELS[incident.severity]}
          </span>
          <span className="rounded-full border px-2 py-0.5">{incident.status}</span>
        </span>
      </div>
      {incident.latestUpdate ? (
        <p className="mt-2 text-sm text-muted-foreground">{incident.latestUpdate}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Started <time dateTime={incident.startedAt}>{formatTime(incident.startedAt)}</time>
        </span>
        {incident.componentsAffected.length > 0 ? (
          <span>
            Affects {incident.componentsAffected.map(c => COMPONENT_LABELS[c] ?? c).join(', ')}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function StatusReportPanel({ report }: { report: StatusReport }) {
  const componentsHeadingId = useId();
  const incidentsHeadingId = useId();
  const overall = deriveOverall(report);
  const componentNames = [
    ...COMPONENT_ORDER.filter(name => name in report.components),
    ...Object.keys(report.components).filter(name => !COMPONENT_ORDER.includes(name)),
  ];

  return (
    <div className="space-y-8">
      <OverallBanner overall={overall} updatedAt={report.updatedAt} />

      <section aria-labelledby={componentsHeadingId} className="space-y-3">
        <h2 id={componentsHeadingId} className="text-sm font-semibold text-muted-foreground">
          Components
        </h2>
        <ul className="divide-y rounded-2xl border bg-card">
          {componentNames.map(name => (
            <ComponentRow key={name} name={name} state={report.components[name].status} />
          ))}
        </ul>
      </section>

      <section aria-labelledby={incidentsHeadingId} className="space-y-3">
        <h2 id={incidentsHeadingId} className="text-sm font-semibold text-muted-foreground">
          Incident history
        </h2>
        {report.incidents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-8 text-center">
            <CheckCircle2 aria-hidden="true" className="size-6 text-success" />
            <p className="text-sm font-medium">No incidents reported</p>
            <p className="text-xs text-muted-foreground">Everything has been running smoothly.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {report.incidents.map(incident => (
              <IncidentItem key={incident.id} incident={incident} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type FetchPhase = 'loading' | 'error' | 'ready';

export function StatusView() {
  const [phase, setPhase] = useState<FetchPhase>('loading');
  const [report, setReport] = useState<StatusReport | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setPhase('loading');
    try {
      const res = await fetch(STATUS_URL, { signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as StatusReport;
      setReport(data);
      setPhase('ready');
    } catch {
      if (signal?.aborted) return;
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const retry = useCallback(() => void load(), [load]);

  if (phase === 'loading') {
    return (
      <div
        role="status"
        aria-label="Loading system status"
        className="flex items-center justify-center gap-3 rounded-2xl border border-dashed p-12 text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        <span className="text-sm">Checking system status…</span>
      </div>
    );
  }

  if (phase === 'error' || !report) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center">
        <AlertTriangle aria-hidden="true" className="size-6 text-warning" />
        <div>
          <p className="text-sm font-medium">Status is temporarily unavailable</p>
          <p className="text-xs text-muted-foreground">
            We couldn&apos;t reach the status service. Please try again in a moment.
          </p>
        </div>
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted">
          <RefreshCw aria-hidden="true" className="size-4" />
          Try again
        </button>
      </div>
    );
  }

  return <StatusReportPanel report={report} />;
}

export function StatusFooterNote() {
  return (
    <p className="mt-10 text-center text-xs text-muted-foreground">
      Operational signals only — no customer data is shown on this page.{' '}
      <a
        href="https://contractor-ops.io"
        className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline">
        Back to Contractor Ops
        <ExternalLink aria-hidden="true" className="size-3" />
      </a>
    </p>
  );
}
