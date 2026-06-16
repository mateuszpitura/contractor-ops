/**
 * Tax-form wizard domain hook — the SOLE tRPC / React Hook Form boundary for the
 * portal W-9 / W-8BEN / W-8BEN-E self-certification flow.
 *
 * The beneficial owner completes the wizard in the portal: the server routes the
 * form from the existing profile (`getTaxFormDetermination`), the contractor
 * confirms or overrides it, fills the form, attests under penalties of perjury,
 * and submits (`submitTaxForm`). The treaty article + rate auto-populate from the
 * determination for W-8 forms. The container and step components stay free of any
 * data access — this hook owns every query, mutation, and form-state concern.
 */

import type { TaxFormSubmissionInput } from '@contractor-ops/validators';
import { taxFormSubmissionSchema } from '@contractor-ops/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import { usePortalTRPC } from '../../../../providers/trpc-provider.js';

export type TaxFormType = 'W9' | 'W8BEN' | 'W8BENE';

/** Wizard step order. Determination → form (W-9 or W-8) → attestation → receipt. */
export type WizardStep = 'determination' | 'form' | 'attest' | 'receipt';

export const STEP_ORDER: WizardStep[] = ['determination', 'form', 'attest', 'receipt'];

export interface TreatyClaim {
  article: string | null;
  rate: number;
  residency: string;
}

export interface TaxFormDetermination {
  formType: TaxFormType;
  countryCode: string | null;
  legalName: string | null;
  displayName: string | null;
  treatyClaim: TreatyClaim | null;
}

export interface SubmittedReceipt {
  id: string;
  formType: TaxFormType;
  signedAt: Date;
}

export interface UseTaxFormWizardResult {
  fieldId: string;
  /** True while the determination/profile loads — render the skeleton. */
  isLoading: boolean;
  /** True when the determination failed to load — render the reload error. */
  isLoadError: boolean;
  reloadDetermination: () => void;
  /** The server-resolved determination; null until loaded. */
  determination: TaxFormDetermination | null;
  /** The form type the contractor is filling (after confirm/override). */
  activeFormType: TaxFormType;
  setActiveFormType: (formType: TaxFormType) => void;
  step: WizardStep;
  stepIndex: number;
  goNext: () => void;
  goBack: () => void;
  // React Hook Form surface.
  register: UseFormRegister<TaxFormSubmissionInput>;
  control: Control<TaxFormSubmissionInput>;
  setValue: UseFormSetValue<TaxFormSubmissionInput>;
  errors: FieldErrors<TaxFormSubmissionInput>;
  /** Submit handler — validates then calls the portal mutation. */
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  /** Set when the submit failed; drives the inline alert region (data preserved). */
  submitError: boolean;
  /** Set on success; drives the receipt step. */
  receipt: SubmittedReceipt | null;
}

export function useTaxFormWizard(): UseTaxFormWizardResult {
  const trpc = usePortalTRPC();
  const fieldId = useId();

  const determinationQuery = useQuery(trpc.portal.getTaxFormDetermination.queryOptions());
  const determination = (determinationQuery.data ?? null) as TaxFormDetermination | null;

  const [activeFormType, setActiveFormTypeState] = useState<TaxFormType | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [receipt, setReceipt] = useState<SubmittedReceipt | null>(null);

  // The active form type defaults to the determination's routed type until the
  // contractor overrides it on the determination step.
  const resolvedFormType: TaxFormType = activeFormType ?? determination?.formType ?? 'W9';

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<TaxFormSubmissionInput>({
    resolver: zodResolver(taxFormSubmissionSchema),
    // `backupWithholding` is a required boolean — seed it false so an untouched
    // W-9 checkbox validates without forcing the contractor to toggle it.
    defaultValues: { backupWithholding: false } as Partial<TaxFormSubmissionInput>,
  });

  const submitMutation = useMutation(trpc.portal.submitTaxForm.mutationOptions());

  // Keep the discriminated-union discriminant in sync so the resolver can pick
  // the correct W-9 / W-8BEN / W-8BEN-E variant even when the contractor never
  // touches the override control on the determination step.
  useEffect(() => {
    setValue('formType', resolvedFormType, { shouldValidate: false });
  }, [resolvedFormType, setValue]);

  const setActiveFormType = useCallback(
    (formType: TaxFormType) => {
      setActiveFormTypeState(formType);
      setValue('formType', formType, { shouldValidate: false });
    },
    [setValue],
  );

  const goNext = useCallback(() => {
    setStepIndex(index => Math.min(index + 1, STEP_ORDER.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setStepIndex(index => Math.max(index - 1, 0));
  }, []);

  const reloadDetermination = useCallback(() => {
    void determinationQuery.refetch();
  }, [determinationQuery]);

  const onValid = useCallback(
    async (values: TaxFormSubmissionInput): Promise<void> => {
      try {
        const result = await submitMutation.mutateAsync(values);
        setReceipt({
          id: result.id,
          formType: result.formType as TaxFormType,
          signedAt: new Date(),
        });
        setStepIndex(STEP_ORDER.indexOf('receipt'));
        // safe-swallow: the mutation's error state drives the inline alert; the
        // form values are intentionally preserved so the contractor can retry
        // without re-entering anything.
      } catch {
        // No-op — handled via the mutation error state (see note above).
      }
    },
    [submitMutation],
  );

  const onSubmit = useMemo(() => handleSubmit(onValid), [handleSubmit, onValid]);

  return {
    fieldId,
    isLoading: determinationQuery.isPending,
    isLoadError: determinationQuery.isError,
    reloadDetermination,
    determination,
    activeFormType: resolvedFormType,
    setActiveFormType,
    step: STEP_ORDER[stepIndex],
    stepIndex,
    goNext,
    goBack,
    register,
    control,
    setValue,
    errors,
    onSubmit,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.isError,
    receipt,
  };
}
