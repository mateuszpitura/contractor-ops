'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Default Skonto section in DE billing-profile edit form
// ---------------------------------------------------------------------------

interface DefaultSkontoSectionProps {
  billingProfileId: string;
  /** PAY_SKONTO_ENABLED feature flag. */
  featureEnabled: boolean;
  /** Existing default terms, if any. */
  existingDefault?: {
    discountPercent: number;
    discountDays: number;
    netDays: number;
  } | null;
}

interface FormState {
  discountPercent: string;
  discountDays: string;
  netDays: string;
}

interface FormErrors {
  discountPercent?: string;
  discountDays?: string;
  netDays?: string;
}

export function DefaultSkontoSection({
  billingProfileId,
  featureEnabled,
  existingDefault,
}: DefaultSkontoSectionProps) {
  const t = useTranslations('Payments.skonto.billingProfile');
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(!!existingDefault);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [form, setForm] = useState<FormState>({
    discountPercent: existingDefault?.discountPercent?.toString() ?? '',
    discountDays: existingDefault?.discountDays?.toString() ?? '',
    netDays: existingDefault?.netDays?.toString() ?? '',
  });

  const upsertMutation = useMutation(
    trpc.skonto.upsertForBillingProfile.mutationOptions({
      onSuccess: () => {
        toast.success(t('savedToast'));
        void queryClient.invalidateQueries(trpc.skonto.pathFilter());
      },
      onError: (error: { message: string }) => {
        toast.error(error.message);
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.skonto.deleteForBillingProfile.mutationOptions({
      onSuccess: () => {
        toast.success(t('deletedToast'));
        setForm({ discountPercent: '', discountDays: '', netDays: '' });
        setDeleteDialogOpen(false);
        void queryClient.invalidateQueries(trpc.skonto.pathFilter());
      },
      onError: (error: { message: string }) => {
        toast.error(error.message);
      },
    }),
  );

  const validateField = useCallback(
    (name: keyof FormState, value: string): string | undefined => {
      const num = Number(value);
      if (name === 'discountPercent') {
        if (!value || Number.isNaN(num) || num <= 0 || num > 50) {
          return t('validation.percentOutOfRange');
        }
      }
      if (name === 'discountDays' || name === 'netDays') {
        if (!value || Number.isNaN(num) || num < 1 || !Number.isInteger(num)) {
          return t('validation.invalidDays');
        }
      }
      return;
    },
    [t],
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    newErrors.discountPercent = validateField('discountPercent', form.discountPercent);
    newErrors.discountDays = validateField('discountDays', form.discountDays);
    newErrors.netDays = validateField('netDays', form.netDays);

    const dd = Number(form.discountDays);
    const nd = Number(form.netDays);
    if (!(Number.isNaN(dd) || Number.isNaN(nd)) && dd >= nd) {
      newErrors.discountDays = t('validation.daysOrdering');
    }

    setErrors(newErrors);
    return !(newErrors.discountPercent || newErrors.discountDays || newErrors.netDays);
  }, [form, validateField, t]);

  const handleBlur = (name: keyof FormState) => {
    const error = validateField(name, form[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleChange = (name: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!validateAll()) return;
    upsertMutation.mutate({
      billingProfileId,
      percent: Number(form.discountPercent),
      discountDays: Number(form.discountDays),
      netDays: Number(form.netDays),
    });
  };

  const handleDeleteRequest = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate({ billingProfileId });
  };

  if (!featureEnabled) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        render={<Button variant="ghost" className="w-full justify-start text-sm font-medium" />}>
        {t('heading')}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bp-discount-percent">{t('discountPercentLabel')}</Label>
            <Input
              id="bp-discount-percent"
              type="number"
              min="0.01"
              max="50"
              step="0.01"
              value={form.discountPercent}
              onChange={e => handleChange('discountPercent', e.target.value)}
              onBlur={() => handleBlur('discountPercent')}
              className="tabular-nums"
              aria-invalid={!!errors.discountPercent}
            />
            {errors.discountPercent && (
              <p className="text-xs text-destructive">{errors.discountPercent}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bp-discount-days">{t('discountPeriodLabel')}</Label>
            <Input
              id="bp-discount-days"
              type="number"
              min="1"
              step="1"
              value={form.discountDays}
              onChange={e => handleChange('discountDays', e.target.value)}
              onBlur={() => handleBlur('discountDays')}
              className="tabular-nums"
              aria-invalid={!!errors.discountDays}
            />
            {errors.discountDays && (
              <p className="text-xs text-destructive">{errors.discountDays}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bp-net-days">{t('netPeriodLabel')}</Label>
            <Input
              id="bp-net-days"
              type="number"
              min="1"
              step="1"
              value={form.netDays}
              onChange={e => handleChange('netDays', e.target.value)}
              onBlur={() => handleBlur('netDays')}
              className="tabular-nums"
              aria-invalid={!!errors.netDays}
            />
            {errors.netDays && <p className="text-xs text-destructive">{errors.netDays}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} size="sm" disabled={upsertMutation.isPending}>
            {upsertMutation.isPending ? t('saving') : t('saveTerm')}
          </Button>

          {existingDefault && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteRequest}
              disabled={deleteMutation.isPending}
              className="text-destructive hover:text-destructive">
              {t('removeDefault')}
            </Button>
          )}
        </div>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="size-4" />
                {t('delete.title')}
              </AlertDialogTitle>
              <AlertDialogDescription>{t('delete.description')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                {t('delete.cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={handleDeleteConfirm}>
                {deleteMutation.isPending && <Loader2 className="me-1.5 size-3.5 animate-spin" />}
                {t('delete.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CollapsibleContent>
    </Collapsible>
  );
}
