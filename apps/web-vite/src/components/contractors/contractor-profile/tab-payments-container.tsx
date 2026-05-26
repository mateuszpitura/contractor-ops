import { Card, CardContent } from '@contractor-ops/ui/components/shadcn/card';

import { DefaultSkontoSectionContainer } from '../billing-profile/default-skonto-section-container.js';
import { useContractorBillingSkontoSection } from '../hooks/use-contractor-billing-skonto-section.js';
import { useContractorTabPayments } from '../hooks/use-contractor-tab-payments.js';
import { TabPaymentsView } from './tab-payments.js';

type TabPaymentsContainerProps = {
  contractorId: string;
};

export function TabPaymentsContainer({ contractorId }: TabPaymentsContainerProps) {
  const payments = useContractorTabPayments(contractorId);
  const billingSkonto = useContractorBillingSkontoSection(contractorId);

  const { billingProfileId } = billingSkonto;
  if (!billingProfileId) {
    return (
      <div className="space-y-4">
        <TabPaymentsView {...payments} contractorId={contractorId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <DefaultSkontoSectionContainer
            billingProfileId={billingProfileId}
            featureEnabled={billingSkonto.featureEnabled}
            existingDefault={billingSkonto.existingDefault}
          />
        </CardContent>
      </Card>
      <TabPaymentsView {...payments} contractorId={contractorId} />
    </div>
  );
}
