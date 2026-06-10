// Default Skonto section in DE billing-profile edit form.

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
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@contractor-ops/ui/components/shadcn/collapsible';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Loader2, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useDefaultSkonto as UseDefaultSkonto } from '../hooks/use-default-skonto.js';
import { useDefaultSkonto } from '../hooks/use-default-skonto.js';

export interface DefaultSkontoSectionProps {
  billingProfileId: string;
  featureEnabled: boolean;
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

type DefaultSkontoSectionViewProps = DefaultSkontoSectionProps &
  ReturnType<typeof UseDefaultSkonto>;

export function DefaultSkontoSectionView({
  billingProfileId,
  featureEnabled,
  existingDefault,
  upsertMutation,
  deleteMutation,
}: DefaultSkontoSectionViewProps) {
  const t = useTranslations('Payments.skonto.billingProfile');

  const [isOpen, setIsOpen] = useState(!!existingDefault);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [form, setForm] = useState<FormState>({
    discountPercent: existingDefault?.discountPercent?.toString() ?? '',
    discountDays: existingDefault?.discountDays?.toString() ?? '',
    netDays: existingDefault?.netDays?.toString() ?? '',
  });

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

  const handleBlur = useCallback(
    (name: keyof FormState) => {
      const error = validateField(name, form[name]);
      setErrors(prev => ({ ...prev, [name]: error }));
    },
    [form, validateField],
  );

  const handleChange = useCallback((name: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSave = useCallback(() => {
    if (!validateAll()) return;
    upsertMutation.mutate({
      billingProfileId,
      percent: Number(form.discountPercent),
      discountDays: Number(form.discountDays),
      netDays: Number(form.netDays),
    });
  }, [validateAll, upsertMutation, billingProfileId, form]);

  const handleDeleteRequest = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    deleteMutation.mutate(
      { billingProfileId },
      {
        onSuccess: () => {
          setForm({ discountPercent: '', discountDays: '', netDays: '' });
          setDeleteDialogOpen(false);
        },
      },
    );
  }, [deleteMutation, billingProfileId]);

  const handleDiscountPercentChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange('discountPercent', e.target.value),
    [handleChange],
  );
  const handleDiscountPercentBlur = useCallback(() => handleBlur('discountPercent'), [handleBlur]);
  const handleDiscountDaysChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange('discountDays', e.target.value),
    [handleChange],
  );
  const handleDiscountDaysBlur = useCallback(() => handleBlur('discountDays'), [handleBlur]);
  const handleNetDaysChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange('netDays', e.target.value),
    [handleChange],
  );
  const handleNetDaysBlur = useCallback(() => handleBlur('netDays'), [handleBlur]);

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
              onChange={handleDiscountPercentChange}
              onBlur={handleDiscountPercentBlur}
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
              onChange={handleDiscountDaysChange}
              onBlur={handleDiscountDaysBlur}
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
              onChange={handleNetDaysChange}
              onBlur={handleNetDaysBlur}
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

export function DefaultSkontoSection(props: DefaultSkontoSectionProps) {
  const skonto = useDefaultSkonto(props.billingProfileId);
  if (!props.featureEnabled) return null;
  return <DefaultSkontoSectionView {...props} {...skonto} />;
}
