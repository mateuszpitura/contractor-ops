import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useInvoiceMatchingSettings() {
  const trpc = useTRPC();
  const id = useId();
  const t = useTranslations('Settings');
  const tToast = useTranslations('Settings.toast');
  const queryClient = useQueryClient();

  const settingsQuery = useQuery(trpc.settings.get.queryOptions());
  const orgData = settingsQuery.data;
  const orgSlug = orgData?.slug ?? 'org';
  const emailAddress = `invoices@${orgSlug}.contractorhub.io`;

  const invoiceSettingsQuery = useQuery(trpc.settings.getInvoiceSettings.queryOptions());
  const invoiceData = invoiceSettingsQuery.data;

  const [threshold, setThreshold] = useState(10);
  const [serverThreshold, setServerThreshold] = useState(10);

  useEffect(() => {
    if (invoiceData?.invoiceDeviationThresholdPercent != null) {
      setThreshold(invoiceData.invoiceDeviationThresholdPercent);
      setServerThreshold(invoiceData.invoiceDeviationThresholdPercent);
    }
  }, [invoiceData]);

  const isDirty = threshold !== serverThreshold;

  const updateMutation = useMutation(
    trpc.settings.updateInvoiceSettings.mutationOptions({
      onSuccess: () => {
        toast.success(t('invoiceSettingsSaved'));
        queryClient.invalidateQueries({
          queryKey: trpc.settings.getInvoiceSettings.queryKey(),
        });
      },
      onError: () => {
        toast.error(tToast('invoiceSettingsFailed'));
      },
    }),
  );

  const handleCopyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(emailAddress);
      toast.success(t('emailCopied'));
    } catch {
      // Fallback: select text for manual copy
    }
  }, [emailAddress, t]);

  const handleSave = () => {
    if (threshold < 1 || threshold > 100) return;
    updateMutation.mutate({
      invoiceDeviationThresholdPercent: threshold,
    } as Parameters<typeof updateMutation.mutate>[0]);
  };

  return {
    id,
    t,
    emailAddress,
    threshold,
    setThreshold,
    isDirty,
    handleCopyEmail,
    handleSave,
    isPending: updateMutation.isPending,
  } as const;
}
