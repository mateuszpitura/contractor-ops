import { usePeppolWizard } from './hooks/use-peppol.js';
import type { PeppolWizardProps } from './peppol-wizard.js';
import {
  PeppolWizardFooter,
  PeppolWizardShell,
  PeppolWizardStep1,
  PeppolWizardStep2,
  PeppolWizardStep3,
  PeppolWizardStep4,
  PeppolWizardStep5,
} from './peppol-wizard.js';

export function PeppolWizardContainer({ open, onOpenChange }: PeppolWizardProps) {
  const wizard = usePeppolWizard({ onOpenChange });

  return (
    <PeppolWizardShell
      open={open}
      step={wizard.step}
      onOpenChange={wizard.resetAndClose}
      footer={
        <PeppolWizardFooter
          step={wizard.step}
          canGoNext={wizard.canGoNext}
          isPending={wizard.isPending}
          onBack={wizard.back}
          onNext={wizard.next}
          onDone={wizard.resetAndClose}
        />
      }>
      {wizard.step === 1 && (
        <PeppolWizardStep1
          trn={wizard.trn}
          setTrn={wizard.setTrn}
          participantId={wizard.participantId}
        />
      )}
      {wizard.step === 2 && <PeppolWizardStep2 aspProvider={wizard.aspProvider} />}
      {wizard.step === 3 && (
        <PeppolWizardStep3
          apiKey={wizard.apiKey}
          setApiKey={wizard.setApiKey}
          showApiKey={wizard.showApiKey}
          toggleShowApiKey={wizard.toggleShowApiKey}
          environment={wizard.environment}
          setEnvironment={wizard.setEnvironment}
        />
      )}
      {wizard.step === 4 && (
        <PeppolWizardStep4
          participantId={wizard.participantId}
          environment={wizard.environment}
          isPending={wizard.isPending}
          registrationError={wizard.registrationError}
          onRetry={wizard.retry}
        />
      )}
      {wizard.step === 5 && (
        <PeppolWizardStep5 participantId={wizard.participantId} environment={wizard.environment} />
      )}
    </PeppolWizardShell>
  );
}
