// apps/web/src/components/payments/bacs/bacs-submitter-form.tsx
//
// Phase 63 · Plan 04 · D-02 — BACS submitter configuration form.
//
// Renders four inputs (SUN, originating sort code, originating account number,
// submitter name). Each field shows the masked currently-saved value above the
// input when one exists, so admins can confirm what will be replaced.
//
// All fields are required to enable saving. The Save button is disabled while
// the form is invalid OR while the `payments.bacs-enabled` feature flag is off
// (D-07).

'use client';

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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Schema (mirrors the server-side validators 1:1)
// ---------------------------------------------------------------------------

const bacsSubmitterFormSchema = z.object({
  serviceUserNumber: serviceUserNumberSchema,
  submitterSortCode: sortCodeSchema,
  submitterAccountNumber: accountNumberSchema,
  submitterName: bacsSubmitterNameSchema.min(1),
});

type BacsSubmitterFormValues = z.infer<typeof bacsSubmitterFormSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BacsSubmitterFormProps {
  /**
   * `payments.bacs-enabled` feature flag. When false, the form still renders
   * (so admins can see what they would configure) but Save is disabled.
   */
  featureEnabled: boolean;
}

export function BacsSubmitterForm({ featureEnabled }: BacsSubmitterFormProps) {
  const t = useTranslations('Payments.bacs');
  const id = useId();
  const queryClient = useQueryClient();

  const masksQuery = useQuery(trpc.bacs.getSubmitterMasks.queryOptions());
  const masks = masksQuery.data;

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
      submitterName: masks?.submitterName ?? '',
    },
  });

  // When masks load, sync the (non-secret) submitter name into the form so the
  // user can edit it in place. Encrypted fields stay blank — the masked
  // preview lives in the helper text above each input.
  //
  // Only reset while the form is pristine. Without the `isDirty` guard, a
  // late-arriving masks query (slow first load, no React-Query cache) would
  // wipe any field the user has already typed into. The post-save refetch
  // also fires this effect; the pristine guard makes 'success-clears-form'
  // a deliberate no-op rather than an accidental side effect of the refetch.
  useEffect(() => {
    if (masks?.submitterName && !isDirty) {
      reset({
        serviceUserNumber: '',
        submitterSortCode: '',
        submitterAccountNumber: '',
        submitterName: masks.submitterName,
      });
    }
  }, [masks?.submitterName, reset, isDirty]);

  const saveMutation = useMutation(
    trpc.bacs.saveSubmitterConfig.mutationOptions({
      onSuccess: () => {
        toast.success(t('savedToast'));
        void queryClient.invalidateQueries({
          queryKey: trpc.bacs.getSubmitterMasks.queryKey(),
        });
      },
      onError: err => {
        toast.error(err?.message ?? 'Failed to save BACS submitter details');
      },
    }),
  );

  const onSubmit = (values: BacsSubmitterFormValues) => {
    saveMutation.mutate(values);
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
          {/* Service User Number ---------------------------------------- */}
          <div className="space-y-2">
            <Label htmlFor={sunInputId}>{t('sunLabel')}</Label>
            {masksQuery.isLoading ? (
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
            {errors.serviceUserNumber && (
              <p className="text-xs text-destructive" role="alert">
                {errors.serviceUserNumber.message}
              </p>
            )}
          </div>

          {/* Originating sort code ------------------------------------- */}
          <div className="space-y-2">
            <Label htmlFor={sortCodeInputId}>{t('sortCodeLabel')}</Label>
            {masksQuery.isLoading ? (
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
            {errors.submitterSortCode && (
              <p className="text-xs text-destructive" role="alert">
                {errors.submitterSortCode.message}
              </p>
            )}
          </div>

          {/* Originating account number ------------------------------- */}
          <div className="space-y-2">
            <Label htmlFor={accountNumberInputId}>{t('accountNumberLabel')}</Label>
            {masksQuery.isLoading ? (
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
            {errors.submitterAccountNumber && (
              <p className="text-xs text-destructive" role="alert">
                {errors.submitterAccountNumber.message}
              </p>
            )}
          </div>

          {/* Submitter name -------------------------------------------- */}
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
            {errors.submitterName && (
              <p className="text-xs text-destructive" role="alert">
                {errors.submitterName.message}
              </p>
            )}
          </div>

          {/* Save button ----------------------------------------------- */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={
                !(featureEnabled && isValid && isDirty) || isSubmitting || saveMutation.isPending
              }>
              {saveMutation.isPending ? (
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
