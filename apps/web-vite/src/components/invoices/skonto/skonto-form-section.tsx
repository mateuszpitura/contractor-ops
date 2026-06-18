/**
 * Skonto form section.
 */

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
import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import { Button } from '@contractor-ops/ui/components/shadcn/button';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Switch } from '@contractor-ops/ui/components/shadcn/switch';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useId, useState } from 'react';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useSkontoFormSection } from '../hooks/use-skonto-form-section.js';

export interface SkontoFormSectionViewProps {
  invoiceId?: string;
  profileDefault?: {
    discountPercent: number;
    discountDays: number;
    netDays: number;
  } | null;
  invoiceTerm?: {
    discountPercent: number;
    discountDays: number;
    netDays: number;
  } | null;
  onSave: (values: { percent: number; discountDays: number; netDays: number }) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
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

export function SkontoFormSectionView({
  invoiceId,
  profileDefault,
  invoiceTerm,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: SkontoFormSectionViewProps) {
  const t = useTranslations('Payments.skonto.form');

  const customizeSkontoId = useId();
  const discountPercentId = useId();
  const discountDaysId = useId();
  const netDaysId = useId();

  const [customizing, setCustomizing] = useState(!!invoiceTerm);
  const [showInputs, setShowInputs] = useState(!!invoiceTerm || !profileDefault);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const initialValues = invoiceTerm ?? profileDefault;

  const [form, setForm] = useState<FormState>({
    discountPercent: initialValues?.discountPercent?.toString() ?? '',
    discountDays: initialValues?.discountDays?.toString() ?? '',
    netDays: initialValues?.netDays?.toString() ?? '',
  });

  useEffect(() => {
    const source = invoiceTerm ?? profileDefault;
    if (source) {
      setForm({
        discountPercent: source.discountPercent.toString(),
        discountDays: source.discountDays.toString(),
        netDays: source.netDays.toString(),
      });
    }
  }, [invoiceTerm, profileDefault]);

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
    [validateField, form],
  );

  const handleChange = useCallback((name: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSave = useCallback(() => {
    if (!validateAll()) return;
    onSave({
      percent: Number(form.discountPercent),
      discountDays: Number(form.discountDays),
      netDays: Number(form.netDays),
    });
  }, [validateAll, onSave, form.discountPercent, form.discountDays, form.netDays]);

  const handleDeleteRequest = useCallback(() => {
    if (!invoiceId) return;
    setDeleteDialogOpen(true);
  }, [invoiceId]);

  const handleDeleteConfirm = useCallback(() => {
    if (!invoiceId) return;
    onDelete();
    setCustomizing(false);
    setDeleteDialogOpen(false);
  }, [invoiceId, onDelete]);

  const handleCustomizeToggle = useCallback(
    (checked: boolean) => {
      setCustomizing(checked);
      setShowInputs(checked);
      if (!checked && profileDefault) {
        setForm({
          discountPercent: profileDefault.discountPercent.toString(),
          discountDays: profileDefault.discountDays.toString(),
          netDays: profileDefault.netDays.toString(),
        });
      }
    },
    [profileDefault],
  );

  const handleShowInputs = useCallback(() => {
    setShowInputs(true);
  }, []);

  const handleDiscountPercentChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => handleChange('discountPercent', e.target.value),
    [handleChange],
  );
  const handleDiscountPercentBlur = useCallback(() => handleBlur('discountPercent'), [handleBlur]);
  const handleDiscountDaysChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => handleChange('discountDays', e.target.value),
    [handleChange],
  );
  const handleDiscountDaysBlur = useCallback(() => handleBlur('discountDays'), [handleBlur]);
  const handleNetDaysChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => handleChange('netDays', e.target.value),
    [handleChange],
  );
  const handleNetDaysBlur = useCallback(() => handleBlur('netDays'), [handleBlur]);

  const previewText =
    form.discountPercent && form.discountDays && form.netDays
      ? t('previewLine', {
          percent: form.discountPercent,
          discountDays: form.discountDays,
          netDays: form.netDays,
        })
      : null;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{t('heading')}</h3>

      {profileDefault && !invoiceTerm && (
        <div className="space-y-3">
          <Badge variant="secondary" className="gap-1">
            {t('useDefaultPill', {
              percent: profileDefault.discountPercent,
              discountDays: profileDefault.discountDays,
              netDays: profileDefault.netDays,
            })}
          </Badge>
          <div className="flex items-center gap-2">
            <Switch
              id={customizeSkontoId}
              checked={customizing}
              onCheckedChange={handleCustomizeToggle}
            />
            <Label htmlFor={customizeSkontoId} className="text-sm">
              {t('customizeToggle')}
            </Label>
          </div>
        </div>
      )}

      {!(profileDefault || invoiceTerm || showInputs) && (
        <Button variant="outline" size="sm" onClick={handleShowInputs}>
          <Plus className="h-3.5 w-3.5" />
          {t('addSkonto')}
        </Button>
      )}

      {showInputs ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor={discountPercentId}>{t('discountPercentLabel')}</Label>
              <Input
                id={discountPercentId}
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
              {errors.discountPercent ? (
                <p className="text-xs text-destructive">{errors.discountPercent}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={discountDaysId}>{t('discountPeriodLabel')}</Label>
              <Input
                id={discountDaysId}
                type="number"
                min="1"
                step="1"
                value={form.discountDays}
                onChange={handleDiscountDaysChange}
                onBlur={handleDiscountDaysBlur}
                className="tabular-nums"
                aria-invalid={!!errors.discountDays}
              />
              {errors.discountDays ? (
                <p className="text-xs text-destructive">{errors.discountDays}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={netDaysId}>{t('netPeriodLabel')}</Label>
              <Input
                id={netDaysId}
                type="number"
                min="1"
                step="1"
                value={form.netDays}
                onChange={handleNetDaysChange}
                onBlur={handleNetDaysBlur}
                className="tabular-nums"
                aria-invalid={!!errors.netDays}
              />
              {errors.netDays ? <p className="text-xs text-destructive">{errors.netDays}</p> : null}
            </div>
          </div>

          {previewText ? <p className="text-sm text-muted-foreground">{previewText}</p> : null}

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} size="sm" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isSaving ? t('saving') : t('saveTerm')}
            </Button>

            {invoiceTerm && profileDefault ? (
              <Button variant="ghost" size="sm" onClick={handleDeleteRequest} disabled={isDeleting}>
                {t('resetToDefault')}
              </Button>
            ) : null}

            {invoiceTerm && !profileDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteRequest}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive">
                {t('removeSkonto')}
              </Button>
            )}
          </div>
        </div>
      ) : null}

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
            <AlertDialogCancel disabled={isDeleting}>{t('delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}>
              {isDeleting ? <Loader2 className="me-1.5 size-3.5 animate-spin" /> : null}
              {t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SkontoFormSectionProps {
  invoiceId?: string;
  featureEnabled: boolean;
  contractorCountryCode: string;
}

export function SkontoFormSection({
  invoiceId,
  featureEnabled,
  contractorCountryCode,
}: SkontoFormSectionProps) {
  const isApplicable = featureEnabled && contractorCountryCode === 'DE';

  const { onSave, onDelete, isSaving, isDeleting, invoiceTerm, profileDefault } =
    useSkontoFormSection({
      invoiceId,
      featureEnabled: isApplicable,
    });

  if (!isApplicable) return null;

  return (
    <SkontoFormSectionView
      invoiceId={invoiceId}
      onSave={onSave}
      onDelete={onDelete}
      isSaving={isSaving}
      isDeleting={isDeleting}
      invoiceTerm={invoiceTerm}
      profileDefault={profileDefault}
    />
  );
}
