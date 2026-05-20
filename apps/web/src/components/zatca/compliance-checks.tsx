'use client';

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ComplianceCheckResult } from './zatca-trpc';
import { zatcaTrpc } from './zatca-trpc';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComplianceChecksProps {
  onSuccess: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Status badge mapping
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<
  string,
  { variant: 'success' | 'destructive' | 'warning'; label: string }
> = {
  CLEARED: { variant: 'success', label: 'CLEARED' },
  REPORTED: { variant: 'success', label: 'REPORTED' },
  REJECTED: { variant: 'destructive', label: 'REJECTED' },
  ERROR: { variant: 'destructive', label: 'ERROR' },
};

// ---------------------------------------------------------------------------
// Compliance Checks — Step 4
// ---------------------------------------------------------------------------

/**
 * Step 4 of ZATCA onboarding wizard.
 * Submits 6 test invoices to ZATCA compliance endpoint.
 * Shows results with badges (CLEARED/REPORTED green, REJECTED red).
 * Progress bar tracks completion.
 * Next enabled only when all 6 pass.
 */
export function ComplianceChecks({ onSuccess, onBack }: ComplianceChecksProps) {
  const t = useTranslations('Zatca.complianceChecks');
  const [results, setResults] = useState<ComplianceCheckResult[]>([]);

  // NOTE: No queryClient.invalidateQueries — this mutation is a wizard step.
  // The parent `OnboardingWizard.goNext` invalidates
  // `zatcaTrpc.getOnboardingState` when the user advances past this step,
  // refreshing all downstream consumers (ZatcaStatusCard, ZatcaConnectionPill,
  // settings/integrations page). Invalidating here would be redundant and
  // would trigger a refetch before the parent advances. UI is conditional on
  // local `results` state, not on cache.
  // See AUDIT.md Appendix B (wizard-step-progression).
  const checksMutation = useMutation({
    ...zatcaTrpc.runComplianceChecks.mutationOptions(),
    onSuccess: (data: unknown) => {
      const typedData = data as ComplianceCheckResult[];
      setResults(typedData);
      const allPassed = typedData.every(r => r.status === 'CLEARED' || r.status === 'REPORTED');
      if (allPassed) {
        toast.success(t('toast.allPassed'));
      } else {
        const failedCount = typedData.filter(
          r => r.status === 'REJECTED' || r.status === 'ERROR',
        ).length;
        toast.error(t('toast.someFailed', { failedCount }));
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.error'));
    },
  });

  const allPassed =
    results.length === 6 && results.every(r => r.status === 'CLEARED' || r.status === 'REPORTED');
  const completedCount = results.length;
  const progressValue = (completedCount / 6) * 100;

  // Test invoice labels
  const TEST_LABELS = [
    t('testLabels.standardTaxInvoice'),
    t('testLabels.standardCreditNote'),
    t('testLabels.standardDebitNote'),
    t('testLabels.simplifiedInvoice'),
    t('testLabels.simplifiedCreditNote'),
    t('testLabels.simplifiedDebitNote'),
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {results.length === 0 && (
        <Button
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => (checksMutation.mutate as () => void)()}
          disabled={checksMutation.isPending}>
          {!!checksMutation.isPending && (
            <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          {t('runChecks')}
        </Button>
      )}

      {/* Test Results */}
      {(results.length > 0 || checksMutation.isPending) && (
        <ol className="space-y-3 rounded-lg border bg-muted/20 p-4" aria-label={t('resultsLabel')}>
          {TEST_LABELS.map((label, i) => {
            const result = results[i];
            const isRunning = checksMutation.isPending && !result;
            const isPending = !(checksMutation.isPending || result);

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
                  ) : isPending ? (
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
      )}

      {/* Progress bar */}
      {(results.length > 0 || checksMutation.isPending) && (
        <div className="space-y-1">
          <Progress value={progressValue}>
            <span className="text-xs text-muted-foreground">{completedCount}/6</span>
          </Progress>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('back')}
        </Button>
        <Button onClick={onSuccess} disabled={!allPassed}>
          {t('next')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
