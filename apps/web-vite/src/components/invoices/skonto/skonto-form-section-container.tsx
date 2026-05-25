import { useSkontoFormSection } from '../hooks/use-skonto-form-section.js';
import { SkontoFormSection } from './skonto-form-section.js';

interface SkontoFormSectionContainerProps {
  invoiceId?: string;
  featureEnabled: boolean;
  contractorCountryCode: string;
}

export function SkontoFormSectionContainer({
  invoiceId,
  featureEnabled,
  contractorCountryCode,
}: SkontoFormSectionContainerProps) {
  // Section only applies to German (DE) contractors with the feature flag on.
  // Variant pick lives here so the hook never fires for inapplicable cases.
  const isApplicable = featureEnabled && contractorCountryCode === 'DE';

  const { onSave, onDelete, isSaving, isDeleting, invoiceTerm, profileDefault } =
    useSkontoFormSection({
      invoiceId,
      featureEnabled: isApplicable,
    });

  if (!isApplicable) return null;

  return (
    <SkontoFormSection
      invoiceId={invoiceId}
      onSave={onSave}
      onDelete={onDelete}
      isSaving={isSaving}
      isDeleting={isDeleting}
      invoiceTerm={invoiceTerm}
      profileDefault={profileDefault}
    />
  );
}
