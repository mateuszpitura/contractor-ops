import { Alert, AlertDescription, AlertTitle } from '@contractor-ops/ui/components/shadcn/alert';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@contractor-ops/ui/components/shadcn/dialog';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Progress } from '@contractor-ops/ui/components/shadcn/progress';
import { RadioGroup, RadioGroupItem } from '@contractor-ops/ui/components/shadcn/radio-group';
import { CheckCircle2, Globe, Loader2 } from 'lucide-react';
import { useId } from 'react';
import { useTranslations } from '../../i18n/useTranslations.js';
import type { PeppolWizardProps as WizardHookProps } from './hooks/use-peppol.js';

export interface PeppolWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export type PeppolWizardViewProps = {
  open: boolean;
  wizard: WizardHookProps;
};

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

export function PeppolWizardView({ open, wizard }: PeppolWizardViewProps) {
  const t = useTranslations('Peppol.wizard');
  const reactId = useId();
  const {
    step,
    trn,
    setTrn,
    aspProvider,
    apiKey,
    setApiKey,
    showApiKey,
    toggleShowApiKey,
    environment,
    setEnvironment,
    participantId,
    canGoNext,
    isPending,
    registrationError,
    next,
    back,
    retry,
    resetAndClose,
  } = wizard;

  return (
    // biome-ignore lint/nursery/noJsxPropsBind: dialog/popover state handler */}
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <StepIndicator current={step} />
        </div>

        <div className="min-h-[200px]">
          {/* Step 1: TRN Entry */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">{t('step1Heading')}</h3>
              <div className="space-y-2">
                <Label htmlFor={`${reactId}-trn`}>Tax Registration Number (TRN)</Label>
                <Input
                  id={`${reactId}-trn`}
                  placeholder="123456789012345"
                  value={trn}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                    setTrn(val);
                  }}
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
          )}

          {/* Step 2: ASP Selection */}
          {step === 2 && (
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
          )}

          {/* Step 3: API Credentials */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">{t('step3Heading')}</h3>
              <div className="space-y-2">
                <Label htmlFor={`${reactId}-apiKey`}>{t('apiKeyLabel')}</Label>
                <div className="relative">
                  <Input
                    id={`${reactId}-apiKey`}
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
                    onChange={e => setApiKey(e.target.value)}
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
                <RadioGroup
                  value={environment}
                  // biome-ignore lint/nursery/noJsxPropsBind: controlled component handler
                  onValueChange={val => setEnvironment(val as 'sandbox' | 'production')}
                  className="flex gap-4">
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
          )}

          {/* Step 4: Register Participant */}
          {step === 4 && (
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
                  <Button variant="outline" size="sm" className="mt-3" onClick={retry}>
                    {t('retry')}
                  </Button>
                </Alert>
              )}
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === 5 && (
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
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          {step > 1 && step < 5 && (
            <Button variant="outline" onClick={back} disabled={step === 4 && isPending}>
              Back
            </Button>
          )}
          {step === 5 ? (
            <Button className="ms-auto" onClick={resetAndClose}>
              Done
            </Button>
          ) : step < 4 ? (
            <Button className="ms-auto" onClick={next} disabled={!canGoNext}>
              Next
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
