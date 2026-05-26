import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useTopUpCheckout } from './hooks/use-billing.js';
import { TopUpDialog } from './top-up-dialog.js';

interface TopUpDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Decision: mutation host — useTopUpCheckout exposes checkout + isPending; container
// owns selectedBundle state spanning the dialog form. Open/onOpenChange gated by
// UsageDashboard; no variant flag.
export function TopUpDialogContainer({ open, onOpenChange }: TopUpDialogContainerProps) {
  const t = useTranslations('Billing.topUp');
  const [selectedBundle, setSelectedBundle] = useState<string>('10');
  const checkoutMutation = useTopUpCheckout();

  const handleConfirm = useCallback(() => {
    checkoutMutation.checkout(selectedBundle);
  }, [checkoutMutation, selectedBundle]);

  return (
    <TopUpDialog
      open={open}
      onOpenChange={onOpenChange}
      t={t}
      selectedBundle={selectedBundle}
      onSelectedBundleChange={setSelectedBundle}
      onConfirm={handleConfirm}
      isPending={checkoutMutation.isPending}
    />
  );
}
