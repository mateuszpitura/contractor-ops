import { usePeppolWizard } from './hooks/use-peppol.js';
import type { PeppolWizardProps } from './peppol-wizard.js';
import { PeppolWizardView } from './peppol-wizard.js';

export function PeppolWizardContainer({ open, onOpenChange }: PeppolWizardProps) {
  const wizard = usePeppolWizard({ onOpenChange });
  return <PeppolWizardView open={open} wizard={wizard} />;
}
