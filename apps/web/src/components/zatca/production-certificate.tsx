'use client';

import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { zatcaTrpc } from './zatca-trpc';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProductionCertificateProps {
  onSuccess: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Production Certificate — Step 5
// ---------------------------------------------------------------------------

/**
 * Step 5 of ZATCA onboarding wizard.
 * Exchanges compliance CSID for production certificate.
 * Warning alert about production activation.
 * "Complete Onboarding" primary CTA.
 * Certificate info card appears after successful exchange.
 */
export function ProductionCertificate({ onSuccess, onBack }: ProductionCertificateProps) {
  const t = useTranslations('Zatca.productionCertificate');
  const [completed, setCompleted] = useState(false);

  const exchangeMutation = useMutation({
    ...zatcaTrpc.exchangeProductionCert.mutationOptions(),
    onSuccess: () => {
      setCompleted(true);
      toast.success(t('toast.success'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.error'));
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {/* Warning alert */}
      {!completed && (
        <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">
            {t('warningTitle')}
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            {t('warningDescription')}
          </AlertDescription>
        </Alert>
      )}

      {/* Complete Onboarding CTA */}
      {!completed && (
        <Button
          // biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop
          onClick={() => (exchangeMutation.mutate as () => void)()}
          disabled={exchangeMutation.isPending}>
          {!!exchangeMutation.isPending && (
            <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          {t('completeButton')}
        </Button>
      )}

      {/* Certificate info card */}
      {!!completed && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-700 dark:text-green-400">
              {t('certActive')}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('certStatus')}</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              {t('certStatusActive')}
              <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
            </dd>
            <dt className="text-muted-foreground">{t('certIssued')}</dt>
            <dd className="font-mono text-sm">{new Date().toISOString().slice(0, 10)}</dd>
            <dt className="text-muted-foreground">{t('certEnvironment')}</dt>
            <dd>{t('certEnvironmentValue')}</dd>
          </dl>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={completed}>
          {t('back')}
        </Button>
        {!!completed && <Button onClick={onSuccess}>{t('completeAction')}</Button>}
      </div>
    </div>
  );
}
