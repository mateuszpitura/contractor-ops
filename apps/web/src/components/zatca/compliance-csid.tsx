'use client';

import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { zatcaTrpc } from './zatca-trpc';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComplianceCsidProps {
  onSuccess: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Status Item
// ---------------------------------------------------------------------------

interface StatusItemProps {
  label: string;
  status: 'pending' | 'loading' | 'done';
}

function StatusItem({
  label,
  status,
  t,
}: StatusItemProps & { t: ReturnType<typeof useTranslations> }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {status === 'loading' && (
        <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label={t('loading')} />
      )}
      {status === 'done' && <Check className="h-4 w-4 text-green-600" aria-label={t('complete')} />}
      {status === 'pending' && (
        <span
          className="h-4 w-4 rounded-full border-2 border-muted-foreground/30"
          role="img"
          aria-label={t('pending')}
        />
      )}
      <span className={status === 'done' ? 'text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Compliance CSID — Step 3
// ---------------------------------------------------------------------------

/**
 * Step 3 of ZATCA onboarding wizard.
 * Submits CSR to ZATCA for compliance certificate.
 * Shows animated status list: spinner -> checkmarks.
 * Next enabled only after all statuses pass.
 */
export function ComplianceCsid({ onSuccess, onBack }: ComplianceCsidProps) {
  const t = useTranslations('Zatca.complianceCsid');
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'storing' | 'done'>('idle');

  // NOTE: No queryClient.invalidateQueries — wizard-step mutation. The parent
  // `OnboardingWizard.goNext` refreshes `zatcaTrpc.getOnboardingState` on step
  // advance, which is what downstream consumers (status card, connection pill,
  // settings page) read from. UI here is driven by local `phase` state.
  // See AUDIT.md Appendix B (wizard-step-progression).
  const requestMutation = useMutation({
    ...zatcaTrpc.requestComplianceCsid.mutationOptions(),
    onMutate: () => {
      setPhase('submitting');
    },
    onSuccess: () => {
      setPhase('storing');
      // Simulate brief storage confirmation
      setTimeout(() => {
        setPhase('done');
        toast.success(t('toast.success'));
      }, 500);
    },
    onError: (error: Error) => {
      setPhase('idle');
      toast.error(error.message || t('toast.error'));
    },
  });

  const csrSubmitted = phase === 'submitting' || phase === 'storing' || phase === 'done';
  const csidReceived = phase === 'storing' || phase === 'done';
  const certStored = phase === 'done';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {phase === 'idle' && (
        <Button
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => (requestMutation.mutate as () => void)()}
          disabled={requestMutation.isPending}>
          {!!requestMutation.isPending && (
            <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          {t('requestButton')}
        </Button>
      )}

      {/* Status list */}
      {!!csrSubmitted && (
        <ol
          className="space-y-3 rounded-lg border bg-muted/20 p-4"
          aria-label={t('progressLabel')}
          aria-live="polite">
          <StatusItem
            label={t('status.submittingCsr')}
            status={csidReceived ? 'done' : 'loading'}
            t={t}
          />
          <StatusItem
            label={t('status.csidReceived')}
            status={csidReceived ? 'done' : 'pending'}
            t={t}
          />
          <StatusItem
            label={t('status.certStored')}
            status={certStored ? 'done' : csidReceived ? 'loading' : 'pending'}
            t={t}
          />
        </ol>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('back')}
        </Button>
        <Button onClick={onSuccess} disabled={!certStored}>
          {t('next')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
