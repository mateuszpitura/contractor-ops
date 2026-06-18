/**
 * BACS submitter form.
 */

import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { Label } from '@contractor-ops/ui/components/shadcn/label';
import { Skeleton } from '@contractor-ops/ui/components/shadcn/skeleton';
import {
  accountNumberSchema,
  bacsSubmitterNameSchema,
  serviceUserNumberSchema,
  sortCodeSchema,
} from '@contractor-ops/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save } from 'lucide-react';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useTranslations } from '../../../i18n/useTranslations.js';
import type { useBacsSubmitterForm as UseBacsSubmitterForm } from '../hooks/use-bacs-submitter-form.js';
import {
  useBacsSubmitterForm,
  useBacsSubmitterNameSync,
} from '../hooks/use-bacs-submitter-form.js';

const bacsSubmitterFormSchema = z.object({
  serviceUserNumber: serviceUserNumberSchema,
  submitterSortCode: sortCodeSchema,
  submitterAccountNumber: accountNumberSchema,
  submitterName: bacsSubmitterNameSchema.min(1),
});

type BacsSubmitterFormValues = z.infer<typeof bacsSubmitterFormSchema>;

interface BacsSubmitterFormViewProps {
  featureEnabled: boolean;
  submitter: ReturnType<typeof UseBacsSubmitterForm>;
}

export function BacsSubmitterFormView({ featureEnabled, submitter }: BacsSubmitterFormViewProps) {
  const t = useTranslations('Payments.bacs');
  const id = useId();
  const { masks, isMasksLoading, onSave, isSaving, submitterNameDefault } = submitter;

  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid, isDirty, errors, isSubmitting },
  } = useForm<BacsSubmitterFormValues>({
    resolver: zodResolver(bacsSubmitterFormSchema),
    mode: 'onBlur',
    defaultValues: {
      serviceUserNumber: '',
      submitterSortCode: '',
      submitterAccountNumber: '',
      submitterName: submitterNameDefault,
    },
  });

  useBacsSubmitterNameSync(masks?.submitterName ?? undefined, isDirty, values =>
    reset({
      serviceUserNumber: '',
      submitterSortCode: '',
      submitterAccountNumber: '',
      submitterName: values.submitterName,
    }),
  );

  const onSubmit = (values: BacsSubmitterFormValues) => {
    onSave(values);
  };

  const sunInputId = `${id}-sun`;
  const sortCodeInputId = `${id}-sort-code`;
  const accountNumberInputId = `${id}-account-number`;
  const submitterNameInputId = `${id}-submitter-name`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('sectionHeading')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div className="space-y-2">
            <Label htmlFor={sunInputId}>{t('sunLabel')}</Label>
            {isMasksLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : masks?.sun ? (
              <p className="text-xs font-mono text-muted-foreground">
                Currently saved: {masks.sun}
              </p>
            ) : null}
            <Input
              id={sunInputId}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              aria-invalid={!!errors.serviceUserNumber}
              aria-describedby={`${sunInputId}-helper`}
              className="tabular-nums font-mono"
              {...register('serviceUserNumber')}
            />
            <p id={`${sunInputId}-helper`} className="text-xs text-muted-foreground">
              {t('sunHelper')}
            </p>
            {errors.serviceUserNumber ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.serviceUserNumber.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={sortCodeInputId}>{t('sortCodeLabel')}</Label>
            {isMasksLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : masks?.sortCode ? (
              <p className="text-xs font-mono text-muted-foreground">
                Currently saved: {masks.sortCode}
              </p>
            ) : null}
            <Input
              id={sortCodeInputId}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              aria-invalid={!!errors.submitterSortCode}
              className="tabular-nums font-mono"
              {...register('submitterSortCode')}
            />
            {errors.submitterSortCode ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.submitterSortCode.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={accountNumberInputId}>{t('accountNumberLabel')}</Label>
            {isMasksLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : masks?.accountNumber ? (
              <p className="text-xs font-mono text-muted-foreground">
                Currently saved: {masks.accountNumber}
              </p>
            ) : null}
            <Input
              id={accountNumberInputId}
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              aria-invalid={!!errors.submitterAccountNumber}
              className="tabular-nums font-mono"
              {...register('submitterAccountNumber')}
            />
            {errors.submitterAccountNumber ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.submitterAccountNumber.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={submitterNameInputId}>{t('submitterNameLabel')}</Label>
            <Input
              id={submitterNameInputId}
              maxLength={18}
              autoComplete="off"
              aria-invalid={!!errors.submitterName}
              className="font-mono uppercase"
              {...register('submitterName')}
            />
            {errors.submitterName ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.submitterName.message}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={!(featureEnabled && isValid && isDirty) || isSubmitting || isSaving}>
              {isSaving ? (
                <Loader2 aria-hidden="true" className="me-1.5 size-3.5 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="me-1.5 size-3.5" />
              )}
              {t('saveSubmitter')}
            </Button>
            {!featureEnabled && (
              <p className="text-xs text-muted-foreground">{t('featureFlagOffBanner')}</p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface BacsSubmitterFormProps {
  featureEnabled: boolean;
}

// Decision: form host — view owns react-hook-form locally; useBacsSubmitterForm
// supplies the save mutation, mask query, and submitter-name sync into the RHF
// reset cycle. featureEnabled forwarded by payments settings page.
export function BacsSubmitterForm({ featureEnabled }: BacsSubmitterFormProps) {
  const submitter = useBacsSubmitterForm();
  return <BacsSubmitterFormView featureEnabled={featureEnabled} submitter={submitter} />;
}
