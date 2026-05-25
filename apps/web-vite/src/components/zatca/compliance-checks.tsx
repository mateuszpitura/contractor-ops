import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { ArrowLeft, ArrowRight, Check, Loader2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { useComplianceChecks } from './hooks/use-compliance-checks.js';

type HookResult = ReturnType<typeof useComplianceChecks>;
type T = HookResult['t'];

const STATUS_BADGE: Record<
  string,
  { variant: 'success' | 'destructive' | 'warning'; label: string }
> = {
  CLEARED: { variant: 'success', label: 'CLEARED' },
  REPORTED: { variant: 'success', label: 'REPORTED' },
  REJECTED: { variant: 'destructive', label: 'REJECTED' },
  ERROR: { variant: 'destructive', label: 'ERROR' },
};

function StepShell({
  body,
  onBack,
  onSuccess,
  canAdvance,
  t,
}: {
  body: ReactNode;
  onBack: () => void;
  onSuccess: () => void;
  canAdvance: boolean;
  t: T;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {body}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('back')}
        </Button>
        <Button onClick={onSuccess} disabled={!canAdvance}>
          {t('next')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export type ComplianceChecksIdleProps = {
  onSuccess: () => void;
  onBack: () => void;
  runChecks: HookResult['runChecks'];
  isPending: boolean;
  t: T;
};

export function ComplianceChecksIdle({
  onSuccess,
  onBack,
  runChecks,
  isPending,
  t,
}: ComplianceChecksIdleProps) {
  return (
    <StepShell
      onBack={onBack}
      onSuccess={onSuccess}
      canAdvance={false}
      t={t}
      body={
        <Button onClick={runChecks} disabled={isPending}>
          {!!isPending && (
            <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          {t('runChecks')}
        </Button>
      }
    />
  );
}

export type ComplianceChecksResultsProps = {
  onSuccess: () => void;
  onBack: () => void;
  results: HookResult['results'];
  isPending: boolean;
  allPassed: boolean;
  completedCount: number;
  progressValue: number;
  testLabels: HookResult['testLabels'];
  t: T;
};

export function ComplianceChecksResults({
  onSuccess,
  onBack,
  results,
  isPending,
  allPassed,
  completedCount,
  progressValue,
  testLabels,
  t,
}: ComplianceChecksResultsProps) {
  return (
    <StepShell
      onBack={onBack}
      onSuccess={onSuccess}
      canAdvance={allPassed}
      t={t}
      body={
        <>
          <ol
            className="space-y-3 rounded-lg border bg-muted/20 p-4"
            aria-label={t('resultsLabel')}>
            {testLabels.map((label, i) => {
              const result = results[i];
              const isRunning = isPending && !result;
              const isPendingRow = !(isPending || result);

              return (
                <li key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {result ? (
                      result.status === 'CLEARED' || result.status === 'REPORTED' ? (
                        <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                      ) : (
                        <X className="h-4 w-4 text-destructive" aria-hidden="true" />
                      )
                    ) : isRunning ? (
                      <Loader2
                        className="h-4 w-4 animate-spin text-primary"
                        aria-label={t('running')}
                      />
                    ) : isPendingRow ? (
                      <span
                        className="h-4 w-4 rounded-full border-2 border-muted-foreground/30"
                        role="img"
                        aria-label={t('pending')}
                      />
                    ) : null}
                    <span className={result ? 'text-foreground' : 'text-muted-foreground'}>
                      {label}
                    </span>
                  </div>

                  {!!result && (
                    <Badge variant={STATUS_BADGE[result.status]?.variant ?? 'warning'}>
                      {STATUS_BADGE[result.status]?.label ?? result.status}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="space-y-1">
            <Progress value={progressValue}>
              <span className="text-xs text-muted-foreground">{completedCount}/6</span>
            </Progress>
          </div>
        </>
      }
    />
  );
}

export type ComplianceChecksViewProps = {
  onSuccess: () => void;
  onBack: () => void;
} & HookResult;
