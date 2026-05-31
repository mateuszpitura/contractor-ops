import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import { CheckCircle2, Globe, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useId } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import type {
  PeppolWizardEnvironment,
  PeppolWizardStep,
  PeppolWizardProps as WizardHookProps,
} from './hooks/use-peppol.js';

export interface PeppolWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { label: 'TRN', number: 1 },
  { label: 'ASP', number: 2 },
  { label: 'Credentials', number: 3 },
  { label: 'Register', number: 4 },
  { label: 'Confirm', number: 5 },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
              step.number < current
                ? 'bg-primary text-primary-foreground'
                : step.number === current
                  ? 'ring-2 ring-primary bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
            }`}>
            {step.number < current ? <CheckCircle2 className="h-4 w-4" /> : step.number}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px w-6 ${step.number < current ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dialog shell
// ---------------------------------------------------------------------------

export interface PeppolWizardShellProps {
  open: boolean;
  step: PeppolWizardStep;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  footer: ReactNode;
}

export function PeppolWizardShell({
  open,
  step,
  onOpenChange,
  children,
  footer,
}: PeppolWizardShellProps) {
  const t = useTranslations('Peppol.wizard');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="py-4">
            <StepIndicator current={step} />
          </div>

          <div className="min-h-[200px]">{children}</div>
        </DialogBody>

        <DialogFooter className="justify-between">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — TRN entry
// ---------------------------------------------------------------------------

export interface PeppolWizardStep1Props {
  trn: string;
  setTrn: (value: string) => void;
  participantId: string;
}

export function PeppolWizardStep1({ trn, setTrn, participantId }: PeppolWizardStep1Props) {
  const t = useTranslations('Peppol.wizard');
  const reactId = useId();

  const handleTrnChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, '').slice(0, 15);
      setTrn(val);
    },
    [setTrn],
  );

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{t('step1Heading')}</h3>
      <div className="space-y-2">
        <Label htmlFor={`${reactId}-trn`}>Tax Registration Number (TRN)</Label>
        <Input
          id={`${reactId}-trn`}
          placeholder="123456789012345"
          value={trn}
          onChange={handleTrnChange}
          pattern="[0-9]*"
          maxLength={15}
          inputMode="numeric"
        />
        <p className="text-sm text-muted-foreground">15-digit UAE TRN</p>
      </div>
      {!!participantId && (
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">{t('participantIdHint')}</p>
          <p className="font-mono text-sm font-medium">{participantId}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — ASP selection
// ---------------------------------------------------------------------------

export interface PeppolWizardStep2Props {
  aspProvider: WizardHookProps['aspProvider'];
}

export function PeppolWizardStep2({ aspProvider }: PeppolWizardStep2Props) {
  const t = useTranslations('Peppol.wizard');
  const reactId = useId();

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{t('step2Heading')}</h3>
      <RadioGroup value={aspProvider} className="space-y-3">
        <label
          htmlFor={`${reactId}-storecove`}
          className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <RadioGroupItem value="storecove" id={`${reactId}-storecove`} />
          <div>
            <p className="text-sm font-medium">Storecove</p>
            <p className="text-sm text-muted-foreground">{t('storecoveDescription')}</p>
          </div>
        </label>
      </RadioGroup>
      <p className="text-sm text-muted-foreground">{t('moreProviders')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — API credentials
// ---------------------------------------------------------------------------

export interface PeppolWizardStep3Props {
  apiKey: string;
  setApiKey: (value: string) => void;
  showApiKey: boolean;
  toggleShowApiKey: () => void;
  environment: PeppolWizardEnvironment;
  setEnvironment: (value: PeppolWizardEnvironment) => void;
}

export function PeppolWizardStep3({
  apiKey,
  setApiKey,
  showApiKey,
  toggleShowApiKey,
  environment,
  setEnvironment,
}: PeppolWizardStep3Props) {
  const t = useTranslations('Peppol.wizard');
  const reactId = useId();

  const handleApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value),
    [setApiKey],
  );
  const handleEnvChange = useCallback(
    (val: string) => setEnvironment(val as PeppolWizardEnvironment),
    [setEnvironment],
  );

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{t('step3Heading')}</h3>
      <div className="space-y-2">
        <Label htmlFor={`${reactId}-apiKey`}>{t('apiKeyLabel')}</Label>
        <div className="relative">
          <Input
            id={`${reactId}-apiKey`}
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={handleApiKeyChange}
            placeholder={t('apiKeyPlaceholder')}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute end-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
            onClick={toggleShowApiKey}>
            {showApiKey ? 'Hide' : 'Show'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t('apiKeyHint')}</p>
      </div>
      <div className="space-y-2">
        <Label>Environment</Label>
        <RadioGroup value={environment} onValueChange={handleEnvChange} className="flex gap-4">
          <label
            htmlFor={`${reactId}-peppol-env-sandbox`}
            className="flex cursor-pointer items-center gap-2">
            <RadioGroupItem id={`${reactId}-peppol-env-sandbox`} value="sandbox" />
            <span className="text-sm">Sandbox (testing)</span>
          </label>
          <label
            htmlFor={`${reactId}-peppol-env-production`}
            className="flex cursor-pointer items-center gap-2">
            <RadioGroupItem id={`${reactId}-peppol-env-production`} value="production" />
            <span className="text-sm">Production</span>
          </label>
        </RadioGroup>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Register participant
// ---------------------------------------------------------------------------

export interface PeppolWizardStep4Props {
  participantId: string;
  environment: PeppolWizardEnvironment;
  isPending: boolean;
  registrationError: string | null;
  onRetry: () => void;
}

export function PeppolWizardStep4({
  participantId,
  environment,
  isPending,
  registrationError,
  onRetry,
}: PeppolWizardStep4Props) {
  const t = useTranslations('Peppol.wizard');

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{t('step4Heading')}</h3>
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('participantIdLabel')}</span>
          <span className="font-mono">{participantId}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('aspProviderLabel')}</span>
          <span>Storecove</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Environment</span>
          <span className="capitalize">{environment}</span>
        </div>
      </div>

      {!!isPending && (
        <div className="space-y-3">
          <Progress value={null} className="h-2" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('registering')}
          </div>
        </div>
      )}

      {!!registrationError && (
        <Alert variant="destructive">
          <AlertTitle>{t('registrationFailed')}</AlertTitle>
          <AlertDescription>{registrationError}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            {t('retry')}
          </Button>
        </Alert>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Confirmation
// ---------------------------------------------------------------------------

export interface PeppolWizardStep5Props {
  participantId: string;
  environment: PeppolWizardEnvironment;
}

export function PeppolWizardStep5({ participantId, environment }: PeppolWizardStep5Props) {
  const t = useTranslations('Peppol.wizard');

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <CheckCircle2 className="h-12 w-12 text-success" />
      <div className="space-y-1">
        <h3 className="text-base font-semibold">{t('successHeading')}</h3>
        <p className="text-sm text-muted-foreground">{t('successDescription')}</p>
      </div>
      <div className="rounded-lg border p-4 text-start w-full max-w-sm space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('participantIdLabel')}</span>
          <span className="font-mono">{participantId}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">ASP</span>
          <span>Storecove</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Environment</span>
          <span className="capitalize">{environment}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer controls
// ---------------------------------------------------------------------------

export interface PeppolWizardFooterProps {
  step: PeppolWizardStep;
  canGoNext: boolean;
  isPending: boolean;
  onBack: () => void;
  onNext: () => void;
  onDone: () => void;
}

export function PeppolWizardFooter({
  step,
  canGoNext,
  isPending,
  onBack,
  onNext,
  onDone,
}: PeppolWizardFooterProps) {
  return (
    <>
      {step > 1 && step < 5 && (
        <Button variant="outline" onClick={onBack} disabled={step === 4 && isPending}>
          Back
        </Button>
      )}
      {step === 5 ? (
        <Button className="ms-auto" onClick={onDone}>
          Done
        </Button>
      ) : step < 4 ? (
        <Button className="ms-auto" onClick={onNext} disabled={!canGoNext}>
          Next
        </Button>
      ) : null}
    </>
  );
}
