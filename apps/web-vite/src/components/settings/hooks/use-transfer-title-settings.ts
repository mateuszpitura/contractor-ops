import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

const transferTitleSchema = z.object({
  template: z.string().min(1).max(200),
});

type TransferTitleFormValues = z.infer<typeof transferTitleSchema>;

const EXAMPLE_VALUES: Record<string, string> = {
  invoice_number: 'FV/2026/03/001',
  billing_period: '2026-03',
  contractor_name: 'Acme Sp. z o.o.',
  contract_number: 'C-001',
};

function resolvePreview(template: string): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    return EXAMPLE_VALUES[key] ?? `{${key}}`;
  });
}

export function useTransferTitleSettings() {
  const trpc = useTRPC();
  const id = useId();
  const t = useTranslations('Payments');
  const queryClient = useQueryClient();

  const settingsQuery = useQuery(trpc.settings.get.queryOptions());
  const orgData = settingsQuery.data;
  const metadata = orgData?.metadata as Record<string, unknown> | undefined;
  const settingsJson = (metadata?.settingsJson as Record<string, unknown>) ?? {};
  const currentTemplate: string =
    (settingsJson.paymentTransferTitleTemplate as string) ?? '{invoice_number}';

  const form = useForm<TransferTitleFormValues>({
    resolver: zodResolver(transferTitleSchema),
    defaultValues: {
      template: '{invoice_number}',
    },
  });

  useEffect(() => {
    if (currentTemplate) {
      form.reset({ template: currentTemplate });
    }
  }, [currentTemplate, form]);

  const watchTemplate = form.watch('template');
  const preview = useMemo(() => resolvePreview(watchTemplate), [watchTemplate]);

  const updateMutation = useMutation(
    trpc.settings.update.mutationOptions({
      onSuccess: () => {
        toast.success(t('toastTransferTitleSaved'));
        queryClient.invalidateQueries({
          queryKey: trpc.settings.get.queryKey(),
        });
      },
      onError: () => {
        toast.error(t('errorExport'));
      },
    }),
  );

  const onSubmit = (values: TransferTitleFormValues) => {
    const existingSettingsJson = settingsJson ?? {};
    const newSettingsJson = {
      ...existingSettingsJson,
      paymentTransferTitleTemplate: values.template,
    };

    updateMutation.mutate({
      settingsJson: newSettingsJson,
    } as Parameters<typeof updateMutation.mutate>[0]);
  };

  return {
    id,
    t,
    register: form.register,
    handleSubmit: form.handleSubmit(onSubmit),
    preview,
    isDirty: form.formState.isDirty,
    errors: form.formState.errors,
    isPending: updateMutation.isPending,
  } as const;
}
