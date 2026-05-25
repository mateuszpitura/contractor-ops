import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { AlertTriangle, ArrowLeft, Check, Loader2, ShieldCheck } from 'lucide-react';
import type { useProductionCertificate } from './hooks/use-production-certificate.js';

type HookResult = ReturnType<typeof useProductionCertificate>;
type T = HookResult['t'];

function StepHeader({ t }: { t: T }) {
  return (
    <div className="space-y-1">
      <h3 className="text-base font-semibold">{t('title')}</h3>
      <p className="text-sm text-muted-foreground">{t('description')}</p>
    </div>
  );
}

export type ProductionCertificateIdleProps = {
  onBack: () => void;
  exchangeProductionCert: () => void;
  isPending: boolean;
  t: T;
};

export function ProductionCertificateIdle({
  onBack,
  exchangeProductionCert,
  isPending,
  t,
}: ProductionCertificateIdleProps) {
  return (
    <div className="space-y-6">
      <StepHeader t={t} />

      <Alert className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-300">{t('warningTitle')}</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          {t('warningDescription')}
        </AlertDescription>
      </Alert>

      <Button onClick={exchangeProductionCert} disabled={isPending}>
        {!!isPending && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        {t('completeButton')}
      </Button>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('back')}
        </Button>
      </div>
    </div>
  );
}

export type ProductionCertificateCompletedProps = {
  onSuccess: () => void;
  t: T;
};

export function ProductionCertificateCompleted({
  onSuccess,
  t,
}: ProductionCertificateCompletedProps) {
  return (
    <div className="space-y-6">
      <StepHeader t={t} />

      <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <span className="font-medium text-green-800 dark:text-green-400">{t('certActive')}</span>
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

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" disabled>
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('back')}
        </Button>
        <Button onClick={onSuccess}>
          <Check className="h-3.5 w-3.5" />
          {t('completeAction')}
        </Button>
      </div>
    </div>
  );
}

export type ProductionCertificateViewProps = {
  onSuccess: () => void;
  onBack: () => void;
} & HookResult;
