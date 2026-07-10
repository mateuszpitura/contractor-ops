/**
 * Organization-onboarding domain hook — drives the first-run "create your
 * organization" flow for a signed-in user who has no active org (and no
 * membership to fall back to). Owns the Better Auth `organization.create` +
 * `setActive` boundary plus the two-step wizard state.
 *
 * Mirrors the create+activate precedent in `use-org-switcher.ts`: create the
 * org, set it active server-side, then reload so the session's
 * `activeOrganizationId` (and the `member` field it unlocks) flow through
 * `customSession` and the dashboard mounts. The reload happens on the final
 * "Go to dashboard" action so the user sees the success step first.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useId, useMemo, useState } from 'react';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useAuth } from '../../../providers/auth-provider.js';
import { Sentry } from '../../../sentry.js';

/**
 * Billing-country choices offered at onboarding. Only `US` routes to the US
 * data region; every other value resolves to EU server-side
 * (`resolveDataRegionFromBilling`). Display names are localised at render time
 * via `Intl.DisplayNames`, so this list stays language-agnostic. Extend as new
 * markets open.
 */
const COUNTRY_CODES = ['PL', 'DE', 'GB', 'FR', 'NL', 'ES', 'IT', 'SA', 'AE', 'EG', 'US'] as const;

export interface CountryOption {
  code: string;
  label: string;
}

export type OnboardingStep = 1 | 2;

export interface OrganizationOnboardingFormValues {
  orgName: string;
  billingCountry: string;
}

export interface UseOrganizationOnboardingResult {
  step: OnboardingStep;
  fieldId: string;
  isSubmitting: boolean;
  createdOrgName: string;
  countryOptions: CountryOption[];
  register: UseFormRegister<OrganizationOnboardingFormValues>;
  control: Control<OrganizationOnboardingFormValues>;
  errors: FieldErrors<OrganizationOnboardingFormValues>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onFinish: () => void;
}

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function useOrganizationOnboarding(): UseOrganizationOnboardingResult {
  const t = useTranslations('OrganizationOnboarding');
  const tv = useTranslations('Validation');
  const tc = useTranslations('Common');
  const { i18n } = useTranslation();
  const auth = useAuth();
  const fieldId = useId();

  const [step, setStep] = useState<OnboardingStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrgName, setCreatedOrgName] = useState('');

  const schema = useMemo(
    () =>
      z.object({
        orgName: z.string().trim().min(2, tv('orgNameTooShort')),
        billingCountry: z.string().min(1, tv('required')),
      }),
    [tv],
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationOnboardingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { orgName: '', billingCountry: '' },
  });

  const countryOptions = useMemo<CountryOption[]>(() => {
    let displayNames: Intl.DisplayNames | null = null;
    try {
      displayNames = new Intl.DisplayNames([i18n.language || 'en'], { type: 'region' });
    } catch {
      displayNames = null;
    }
    return COUNTRY_CODES.map(code => ({ code, label: displayNames?.of(code) ?? code })).sort(
      (a, b) => a.label.localeCompare(b.label, i18n.language || 'en'),
    );
  }, [i18n.language]);

  const onValid = useCallback(
    async (values: OrganizationOnboardingFormValues): Promise<void> => {
      const name = values.orgName.trim();
      setIsSubmitting(true);
      try {
        const { data, error } = await auth.organization.create({
          name,
          slug: toSlug(name),
          ...({ billingCountry: values.billingCountry } as Record<string, string>),
        });
        if (error) {
          toast.error(error.message ?? t('errors.createFailed'));
          return;
        }
        if (data?.id) {
          await auth.organization.setActive({ organizationId: data.id });
        }
        setCreatedOrgName(name);
        setStep(2);
      } catch (err) {
        Sentry.captureException(err, { tags: { 'auth.flow': 'org-onboarding' } });
        toast.error(tc('networkError'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [auth, t, tc],
  );

  const onFinish = useCallback(() => {
    // The active org is set server-side; a full reload re-seeds the client
    // session so the dashboard shell mounts with the new tenant context.
    window.location.reload();
  }, []);

  return {
    step,
    fieldId,
    isSubmitting,
    createdOrgName,
    countryOptions,
    register,
    control,
    errors,
    onSubmit: handleSubmit(onValid),
    onFinish,
  };
}
