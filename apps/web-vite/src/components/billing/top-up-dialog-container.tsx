import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import { useTopUpCheckout } from './hooks/use-billing.js';
import { TopUpDialog } from './top-up-dialog.js';

interface TopUpDialogContainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Decisive responsibility: this container is the mutation host (top-up
 * checkout) and owns the `selectedBundle` selection state spanning the
 * dialog form. The view has no variant branches (single render path),
 * so per `apps/web-vite/ARCHITECTURE.md` the container earns its file
 * as a state owner + side-effect setup, not a pure passthrough.
 */
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
