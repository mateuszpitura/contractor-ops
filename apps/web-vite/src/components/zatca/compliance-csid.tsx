import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { useComplianceCsid as UseComplianceCsid } from './hooks/use-compliance-csid.js';
import { useComplianceCsid } from './hooks/use-compliance-csid.js';

type HookResult = ReturnType<typeof UseComplianceCsid>;
type T = HookResult['t'];

function StatusItem({
  label,
  status,
  t,
}: {
  label: string;
  status: 'pending' | 'loading' | 'done';
  t: T;
}) {
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

export type ComplianceCsidIdleProps = {
  onSuccess: () => void;
  onBack: () => void;
  otp: string;
  onOtpChange: (value: string) => void;
  requestComplianceCsid: HookResult['requestComplianceCsid'];
  canRequest: boolean;
  isPending: boolean;
  t: T;
};

export function ComplianceCsidIdle({
  onSuccess,
  onBack,
  otp,
  onOtpChange,
  requestComplianceCsid,
  canRequest,
  isPending,
  t,
}: ComplianceCsidIdleProps) {
  return (
    <StepShell
      onBack={onBack}
      onSuccess={onSuccess}
      canAdvance={false}
      t={t}
      body={
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zatca-otp">{t('otpLabel')}</Label>
            <Input
              id="zatca-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={event => onOtpChange(event.target.value)}
              placeholder={t('otpPlaceholder')}
              maxLength={32}
            />
            <p className="text-sm text-muted-foreground">{t('otpHint')}</p>
          </div>
          <Button onClick={requestComplianceCsid} disabled={!canRequest || isPending}>
            {!!isPending && (
              <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            {t('requestButton')}
          </Button>
        </div>
      }
    />
  );
}

export type ComplianceCsidProgressProps = {
  onSuccess: () => void;
  onBack: () => void;
  csidReceived: boolean;
  certStored: boolean;
  t: T;
};

export function ComplianceCsidProgress({
  onSuccess,
  onBack,
  csidReceived,
  certStored,
  t,
}: ComplianceCsidProgressProps) {
  return (
    <StepShell
      onBack={onBack}
      onSuccess={onSuccess}
      canAdvance={certStored}
      t={t}
      body={
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
      }
    />
  );
}

// Kept for back-compat with tests that drive the full hook shape; the
// container picks Idle vs Progress directly.
export type ComplianceCsidViewProps = {
  onSuccess: () => void;
  onBack: () => void;
} & HookResult;

export function ComplianceCsid(props: Pick<ComplianceCsidViewProps, 'onSuccess' | 'onBack'>) {
  const {
    phase,
    otp,
    setOtp,
    canRequest,
    requestComplianceCsid,
    isPending,
    csidReceived,
    certStored,
    t,
  } = useComplianceCsid();

  if (phase === 'idle') {
    return (
      <ComplianceCsidIdle
        onSuccess={props.onSuccess}
        onBack={props.onBack}
        otp={otp}
        onOtpChange={setOtp}
        requestComplianceCsid={requestComplianceCsid}
        canRequest={canRequest}
        isPending={isPending}
        t={t}
      />
    );
  }

  return (
    <ComplianceCsidProgress
      onSuccess={props.onSuccess}
      onBack={props.onBack}
      csidReceived={csidReceived}
      certStored={certStored}
      t={t}
    />
  );
}
