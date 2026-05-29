import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@contractor-ops/ui/components/shadcn/alert-dialog';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@contractor-ops/ui/components/shadcn/select';
import { Textarea } from '@contractor-ops/ui/components/shadcn/textarea';
import { Archive } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useState } from 'react';

import { tDyn } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

const WAIVE_TYPES = ['STATUTORY_INTEREST', 'COMPENSATION', 'BOTH'] as const;
type WaiveType = (typeof WAIVE_TYPES)[number];

interface WaiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (waiveType: WaiveType, reason: string) => void;
  isPending: boolean;
}

export function WaiveDialog({ open, onOpenChange, onConfirm, isPending }: WaiveDialogProps) {
  const t = useTranslations('Payments.lateInterest.waive');

  const [waiveType, setWaiveType] = useState<WaiveType>('BOTH');
  const [reason, setReason] = useState('');

  const isReasonValid = reason.trim().length >= 10;

  const handleTypeChange = useCallback((v: string | null) => {
    if (v) setWaiveType(v as WaiveType);
  }, []);

  const handleReasonChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setReason(event.target.value);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!isReasonValid) return;
    onConfirm(waiveType, reason);
  }, [isReasonValid, onConfirm, waiveType, reason]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Archive className="size-4" />
            {t('title')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="waive-type">{t('typeLabel')}</Label>
            <Select value={waiveType} onValueChange={handleTypeChange}>
              <SelectTrigger id="waive-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAIVE_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {tDyn(t, 'types', type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="waive-reason">{t('reasonLabel')}</Label>
            <Textarea
              id="waive-reason"
              value={reason}
              onChange={handleReasonChange}
              placeholder={t('reasonPlaceholder')}
              minLength={10}
              className="min-h-[80px]"
            />
            {reason.length > 0 && !isReasonValid && (
              <p className="text-xs text-destructive">{t('reasonMinLength')}</p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isReasonValid || isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {isPending ? t('confirming') : t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
