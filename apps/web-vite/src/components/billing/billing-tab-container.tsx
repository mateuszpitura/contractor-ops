import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Separator } from '@contractor-ops/ui/components/shadcn/separator';
import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useBillingTab } from './hooks/use-billing.js';
import { ProrationPreviewContainer } from './proration-preview-container.js';
import { UsageDashboardContainer } from './usage-dashboard-container.js';

export function BillingTabContainer() {
  const { subscription, checkoutMutation, portalMutation, t } = useBillingTab();
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

  const handleConfirmChange = useCallback(() => {
    if (selectedPriceId) {
      checkoutMutation.mutate({ priceId: selectedPriceId });
      setSelectedPriceId(null);
    }
  }, [checkoutMutation, selectedPriceId]);

  const handleCancelChange = useCallback(() => {
    setSelectedPriceId(null);
  }, []);

  const handlePortal = useCallback(() => {
    portalMutation.mutate(undefined as never);
  }, [portalMutation]);

  return (
    <div className="space-y-8">
      <UsageDashboardContainer />

      {selectedPriceId ? (
        <>
          <Separator />
          <ProrationPreviewContainer
            newPriceId={selectedPriceId}
            onConfirm={handleConfirmChange}
            onCancel={handleCancelChange}
            isConfirming={checkoutMutation.isPending}
          />
        </>
      ) : null}

      <Separator />

      {subscription ? (
        <Button variant="outline" onClick={handlePortal} disabled={portalMutation.isPending}>
          {portalMutation.isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : null}
          {t('manageBilling')}
        </Button>
      ) : null}
    </div>
  );
}
