'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Skonto form section for invoice create/edit (DE invoices only)
// ---------------------------------------------------------------------------

interface SkontoFormSectionProps {
  invoiceId?: string;
  /** PAY_SKONTO_ENABLED feature flag. */
  featureEnabled: boolean;
  /** Contractor country code — only renders for DE. */
  contractorCountryCode: string;
  /** Existing profile default terms, if any. */
  profileDefault?: {
    discountPercent: number;
    discountDays: number;
    netDays: number;
  } | null;
  /** Existing invoice-specific terms, if any. */
  invoiceTerm?: {
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

export function SkontoFormSection({
  invoiceId,
  featureEnabled,
  contractorCountryCode,
  profileDefault,
  invoiceTerm,
}: SkontoFormSectionProps) {
  const t = useTranslations('Payments.skonto.form');
  const queryClient = useQueryClient();

  // Gate: only show for DE invoices with flag on
  const isApplicable = featureEnabled && contractorCountryCode === 'DE';

  const [customizing, setCustomizing] = useState(!!invoiceTerm);
  const [showInputs, setShowInputs] = useState(!!invoiceTerm || !profileDefault);
  const [errors, setErrors] = useState<FormErrors>({});

  const initialValues = invoiceTerm ?? profileDefault;

  const [form, setForm] = useState<FormState>({
    discountPercent: initialValues?.discountPercent?.toString() ?? '',
    discountDays: initialValues?.discountDays?.toString() ?? '',
    netDays: initialValues?.netDays?.toString() ?? '',
  });

  // Reset form when invoice term changes
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

  const upsertMutation = useMutation(
    trpc.skonto.upsertForInvoice.mutationOptions({
      onSuccess: () => {
        toast.success(t('savedToast'));
        if (invoiceId) {
          void queryClient.invalidateQueries({
            queryKey: trpc.skonto.evaluateForInvoice.queryKey({ invoiceId }),
          });
        }
      },
      onError: (error: { message: string }) => {
        toast.error(error.message);
      },
    }),
  );

  const deleteMutation = useMutation(
    trpc.skonto.deleteForInvoice.mutationOptions({
      onSuccess: () => {
        toast.success(t('deletedToast'));
        setCustomizing(false);
        if (invoiceId) {
          void queryClient.invalidateQueries({
            queryKey: trpc.skonto.evaluateForInvoice.queryKey({ invoiceId }),
          });
        }
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

    // Cross-field: discount period must be shorter than net period
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
    if (!(validateAll() && invoiceId)) return;
    upsertMutation.mutate({
      invoiceId,
      percent: Number(form.discountPercent),
      discountDays: Number(form.discountDays),
      netDays: Number(form.netDays),
    });
  };

  const handleDelete = () => {
    if (!invoiceId) return;
    if (!window.confirm(t('confirm.deleteInvoiceSkonto'))) return;
    deleteMutation.mutate({ invoiceId });
  };

  const handleCustomizeToggle = (checked: boolean) => {
    setCustomizing(checked);
    setShowInputs(checked);
    if (!checked && profileDefault) {
      setForm({
        discountPercent: profileDefault.discountPercent.toString(),
        discountDays: profileDefault.discountDays.toString(),
        netDays: profileDefault.netDays.toString(),
      });
    }
  };

  if (!isApplicable) return null;

  // Preview line
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

      {/* Profile default exists + no invoice term: show default pill + customize toggle */}
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
              id="customize-skonto"
              checked={customizing}
              onCheckedChange={handleCustomizeToggle}
            />
            <Label htmlFor="customize-skonto" className="text-sm">
              {t('customizeToggle')}
            </Label>
          </div>
        </div>
      )}

      {/* No default, no term: "Add Skonto" button */}
      {!(profileDefault || invoiceTerm || showInputs) && (
        <Button variant="outline" size="sm" onClick={() => setShowInputs(true)}>
          <Plus className="h-3.5 w-3.5" />
          {t('addSkonto')}
        </Button>
      )}

      {/* Inputs shown when customizing or adding */}
      {showInputs && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discount-percent">{t('discountPercentLabel')}</Label>
              <Input
                id="discount-percent"
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
              <Label htmlFor="discount-days">{t('discountPeriodLabel')}</Label>
              <Input
                id="discount-days"
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
              <Label htmlFor="net-days">{t('netPeriodLabel')}</Label>
              <Input
                id="net-days"
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

          {/* Live preview line */}
          {previewText && <p className="text-sm text-muted-foreground">{previewText}</p>}

          <div className="flex items-center gap-2">
            <Button onClick={handleSave} size="sm" disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {upsertMutation.isPending ? t('saving') : t('saveTerm')}
            </Button>

            {invoiceTerm && profileDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}>
                {t('resetToDefault')}
              </Button>
            )}

            {invoiceTerm && !profileDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="text-destructive hover:text-destructive">
                {t('removeSkonto')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
