import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Dialog,
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
import { useCallback } from 'react';

import type { TranslateFn } from '../../i18n/useTranslations.js';

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

export function TopUpDialog({
  open,
  onOpenChange,
  t,
  selectedBundle,
  onSelectedBundleChange,
  onConfirm,
  isPending,
}: TopUpDialogProps) {
  const closeDialog = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Select
            value={selectedBundle}
            onValueChange={value => {
              if (value) onSelectedBundleChange(value);
            }}>
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
        </div>

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
