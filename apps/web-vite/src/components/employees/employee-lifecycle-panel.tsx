/**
 * Presentational employee on/offboarding panel. Props-in / JSX-out — no tRPC.
 * The container injects the lifecycle state + handlers; the worker-keyed IdP
 * deprovisioning trigger is a self-contained wired widget, gated by the panel:
 * disabled until a termination date is recorded (the server re-runs the 14-day
 * cooldown regardless — the client gate is UX only).
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { FileText, LogIn, LogOut } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from '../../i18n/useTranslations.js';
import { DeprovisioningTriggerWired } from '../idp/deprovisioning-trigger.js';
import { AnimateIn } from '../shared/animate-in.js';
import type { LifecycleCertType } from './hooks/use-employee-lifecycle.js';

const CERT_TYPES: readonly LifecycleCertType[] = [
  'SWIADECTWO_PRACY',
  'PIT_11',
  'ARBEITSZEUGNIS_SIMPLE',
  'LOHNSTEUERBESCHEINIGUNG',
  'P45',
  'W2',
];

export interface EmployeeLifecyclePanelProps {
  workerId: string;
  displayName: string;
  employmentStatus: string | null;
  terminatedAt: string | Date | null;
  startedRunIds: string[];
  certDownloadUrl: string | null;
  workflowHref: (runId: string) => string;
  onStartOnboarding: () => void;
  onStartOffboarding: () => void;
  onRecordTermination: (terminatedAt: string) => void;
  onGenerateCert: (certType: LifecycleCertType, runId: string) => void;
  isStartingOnboarding: boolean;
  isStartingOffboarding: boolean;
  isRecordingTermination: boolean;
  isGeneratingCert: boolean;
}

export function EmployeeLifecyclePanel(props: EmployeeLifecyclePanelProps) {
  const t = useTranslations('EmployeeLifecycle');
  const dateFieldId = useId();
  const certFieldId = useId();
  const [terminationDate, setTerminationDate] = useState('');
  const [certType, setCertType] = useState<LifecycleCertType>('SWIADECTWO_PRACY');

  const hasTermination = props.terminatedAt != null;
  const latestRunId = props.startedRunIds.at(-1) ?? null;

  return (
    <AnimateIn className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{props.displayName}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {props.employmentStatus ? (
          <Badge variant={hasTermination ? 'destructive' : 'secondary'}>
            {t(`status.${props.employmentStatus}` as 'status.ACTIVE')}
          </Badge>
        ) : null}
      </header>

      <section aria-labelledby="lifecycle-runs-heading" className="space-y-3">
        <h2 id="lifecycle-runs-heading" className="text-sm font-medium">
          {t('runs.heading')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={props.onStartOnboarding}
            disabled={props.isStartingOnboarding}>
            <LogIn className="size-4" aria-hidden="true" />
            {t('actions.startOnboarding')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={props.onStartOffboarding}
            disabled={props.isStartingOffboarding}>
            <LogOut className="size-4" aria-hidden="true" />
            {t('actions.startOffboarding')}
          </Button>
        </div>
        {props.startedRunIds.length === 0 ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t('runs.empty')}
          </p>
        ) : (
          <ul className="space-y-1">
            {props.startedRunIds.map(runId => (
              <li key={runId}>
                <Link
                  to={props.workflowHref(runId)}
                  className="text-sm text-primary underline underline-offset-2">
                  {t('runs.viewRun')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="lifecycle-cert-heading" className="space-y-3">
        <h2 id="lifecycle-cert-heading" className="text-sm font-medium">
          {t('cert.heading')}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor={certFieldId}>{t('cert.typeLabel')}</Label>
            <select
              id={certFieldId}
              value={certType}
              onChange={e => setCertType(e.target.value as LifecycleCertType)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm">
              {CERT_TYPES.map(ct => (
                <option key={ct} value={ct}>
                  {t(`certTypes.${ct}` as 'certTypes.SWIADECTWO_PRACY')}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!latestRunId || props.isGeneratingCert}
            onClick={() => latestRunId && props.onGenerateCert(certType, latestRunId)}>
            <FileText className="size-4" aria-hidden="true" />
            {t('cert.generate')}
          </Button>
        </div>
        {latestRunId ? null : (
          <p className="text-sm text-muted-foreground" role="status">
            {t('cert.needsRun')}
          </p>
        )}
        {props.certDownloadUrl ? (
          <a
            href={props.certDownloadUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline underline-offset-2">
            {t('cert.download')}
          </a>
        ) : null}
      </section>

      <section aria-labelledby="lifecycle-termination-heading" className="space-y-3">
        <h2 id="lifecycle-termination-heading" className="text-sm font-medium">
          {t('termination.heading')}
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor={dateFieldId}>{t('termination.dateLabel')}</Label>
            <Input
              id={dateFieldId}
              type="date"
              value={terminationDate}
              onChange={e => setTerminationDate(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!terminationDate || props.isRecordingTermination}
            onClick={() =>
              terminationDate && props.onRecordTermination(new Date(terminationDate).toISOString())
            }>
            {t('termination.record')}
          </Button>
        </div>
        {hasTermination ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t('termination.recorded')}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="lifecycle-idp-heading" className="space-y-3">
        <h2 id="lifecycle-idp-heading" className="text-sm font-medium">
          {t('idp.heading')}
        </h2>
        <DeprovisioningTriggerWired
          workerId={props.workerId}
          disabledReason={hasTermination ? null : t('idp.notEligibleUntilTermination')}
        />
      </section>
    </AnimateIn>
  );
}
