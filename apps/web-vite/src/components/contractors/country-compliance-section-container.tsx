import {
  CountryComplianceLoadingCard,
  CountryComplianceSectionView,
} from './country-compliance-section.js';
import {
  useContractorEngagements,
  useCountryCompliance,
  useCountryComplianceForm,
} from './hooks/use-country-compliance.js';

interface CountryComplianceSectionContainerProps {
  contractorId: string;
}

export function CountryComplianceSectionContainer({
  contractorId,
}: CountryComplianceSectionContainerProps) {
  const compliance = useCountryCompliance(contractorId);
  const engagements = useContractorEngagements(contractorId);
  const { formData, setFormData } = useCountryComplianceForm();

  if (compliance.isLoading) {
    return <CountryComplianceLoadingCard />;
  }

  const config = compliance.configQuery.data;
  if (!(config?.hasCountryFields && config.countryCode)) {
    return null;
  }

  return (
    <CountryComplianceSectionView
      contractorId={contractorId}
      compliance={compliance}
      engagements={engagements}
      formData={formData}
      onFormDataChange={setFormData}
    />
  );
}
