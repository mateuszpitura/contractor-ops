import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useTranslatedError } from '../../../i18n/use-translated-error.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const orgBankSchema = z.object({
  iban: z.string().max(34).optional(),
  bic: z.string().max(11).optional(),
});

type OrgBankFormValues = z.infer<typeof orgBankSchema>;

export function useOrgBankSettings() {
  const trpc = useTRPC();
  const id = useId();
  const t = useTranslations('Payments');
  const queryClient = useQueryClient();
  const translateError = useTranslatedError();

  const bankQuery = useQuery(trpc.settings.getOrgBankAccount.queryOptions());

  const form = useForm<OrgBankFormValues>({
    resolver: zodResolver(orgBankSchema),
    defaultValues: { iban: '', bic: '' },
  });

  useEffect(() => {
    if (bankQuery.data) {
      form.reset({
        iban: bankQuery.data.iban ?? '',
        bic: bankQuery.data.bic ?? '',
      });
    }
  }, [bankQuery.data, form]);

  const updateMutation = useMutation(
    trpc.settings.updateOrgBankAccount.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastOrgBankSaved'));
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getOrgBankAccount.queryKey(),
        });
      },
      onError: (error: unknown) => {
        toast.error(translateError(error));
      },
    }),
  );

  const onSubmit = (values: OrgBankFormValues) => {
    const iban = values.iban?.trim() ?? '';
    const bic = values.bic?.trim() ?? '';

    // The server's org bank schema only accepts a valid IBAN/BIC or `undefined`
    // (which preserves the stored value); it cannot persist a blank. Sending an
    // empty field would silently keep the old value while toasting success, so
    // clearing a previously-saved field is surfaced as an inline error instead.
    let blockedClear = false;
    if (!iban && bankQuery.data?.iban) {
      form.setError('iban', { type: 'manual', message: t('orgBankCannotClear') });
      blockedClear = true;
    }
    if (!bic && bankQuery.data?.bic) {
      form.setError('bic', { type: 'manual', message: t('orgBankCannotClear') });
      blockedClear = true;
    }
    if (blockedClear) return;

    updateMutation.mutate({
      iban: iban || undefined,
      bic: bic || undefined,
    });
  };

  return {
    id,
    t,
    register: form.register,
    handleSubmit: form.handleSubmit(onSubmit),
    isDirty: form.formState.isDirty,
    errors: form.formState.errors,
    isPending: updateMutation.isPending,
    isLoading: bankQuery.isLoading,
    isError: bankQuery.isError,
    onRetry: () => void bankQuery.refetch(),
  } as const;
}
