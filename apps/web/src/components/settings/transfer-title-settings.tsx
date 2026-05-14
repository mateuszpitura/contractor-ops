'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const transferTitleSchema = z.object({
  template: z.string().min(1).max(200),
});

type TransferTitleFormValues = z.infer<typeof transferTitleSchema>;

// ---------------------------------------------------------------------------
// Preview helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransferTitleSettings() {
  const id = useId();
  const t = useTranslations('Payments');
  const queryClient = useQueryClient();

  // Load current settings
  const settingsQuery = useQuery(trpc.settings.get.queryOptions());
  const orgData = settingsQuery.data;
  const metadata = orgData?.metadata as Record<string, unknown> | undefined;
  const settingsJson = (metadata?.settingsJson as Record<string, unknown>) ?? {};
  const currentTemplate: string =
    (settingsJson.paymentTransferTitleTemplate as string) ?? '{invoice_number}';

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isDirty, errors },
  } = useForm<TransferTitleFormValues>({
    resolver: zodResolver(transferTitleSchema),
    defaultValues: {
      template: '{invoice_number}',
    },
  });

  // Sync loaded value into form
  useEffect(() => {
    if (currentTemplate) {
      reset({ template: currentTemplate });
    }
  }, [currentTemplate, reset]);

  const watchTemplate = watch('template');
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

  function onSubmit(values: TransferTitleFormValues) {
    // Merge paymentTransferTitleTemplate into existing settingsJson
    const existingSettingsJson = settingsJson ?? {};
    const newSettingsJson = {
      ...existingSettingsJson,
      paymentTransferTitleTemplate: values.template,
    };

    updateMutation.mutate({
      settingsJson: newSettingsJson,
    } as Parameters<typeof updateMutation.mutate>[0]);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle>{t('settingsHeading')}</CardTitle>
          <CardDescription>{t('settingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={`${id}-transfer-title-template`} className="text-sm font-medium">
              {t('templateLabel')}
            </label>
            <Input
              id={`${id}-transfer-title-template`}
              placeholder={t('templatePlaceholder')}
              {...register('template')}
            />
            <p className="text-xs text-muted-foreground">{t('templateHelper')}</p>
            {!!errors.template && (
              <p className="text-xs text-destructive">{errors.template.message}</p>
            )}
          </div>

          {/* Live preview */}
          <p className="text-xs text-muted-foreground">{t('preview', { value: preview })}</p>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {t('saveChanges')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
