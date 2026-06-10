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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../i18n/useTranslations.js';
import type { TranslateFn } from '../../i18n/useTranslations.js';
import { useTopUpCheckout } from './hooks/use-billing.js';

const CREDIT_BUNDLES = [
  { value: '10', label: '10 credits', priceLabel: '~49 PLN' },
  { value: '25', label: '25 credits', priceLabel: '~109 PLN' },
  { value: '50', label: '50 credits', priceLabel: '~199 PLN' },
] as const;

interface TopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: TranslateFn;
  selectedBundle: string;
  onSelectedBundleChange: (value: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function TopUpDialogView({
  open,
  onOpenChange,
  t,
  selectedBundle,
  onSelectedBundleChange,
  onConfirm,
  isPending,
}: TopUpDialogProps) {
  const closeDialog = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleBundleChange = useCallback(
    (value: string | null) => {
      if (value) onSelectedBundleChange(value);
    },
    [onSelectedBundleChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 py-2">
          <Select value={selectedBundle} onValueChange={handleBundleChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {CREDIT_BUNDLES.map(bundle => (
                <SelectItem key={bundle.value} value={bundle.value}>
                  {bundle.label} ({bundle.priceLabel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground">{t('priceNote')}</p>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={closeDialog} disabled={isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TopUpDialogWiredProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TopUpDialog({ open, onOpenChange }: TopUpDialogWiredProps) {
  const t = useTranslations('Billing.topUp');
  const [selectedBundle, setSelectedBundle] = useState<string>('10');
  const checkoutMutation = useTopUpCheckout();

  const handleConfirm = useCallback(() => {
    checkoutMutation.checkout(selectedBundle);
  }, [checkoutMutation, selectedBundle]);

  return (
    <TopUpDialogView
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
