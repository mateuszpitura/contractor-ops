'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCopy, Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
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
// Component
// ---------------------------------------------------------------------------

export function InvoiceMatchingSettings() {
  const id = useId();
  const t = useTranslations('Settings');
  const tToast = useTranslations('Settings.toast');
  const queryClient = useQueryClient();

  // Load org data for slug (email address)
  const settingsQuery = useQuery(trpc.settings.get.queryOptions());
  const orgData = settingsQuery.data;
  const orgSlug = orgData?.slug ?? 'org';
  const emailAddress = `invoices@${orgSlug}.contractorhub.io`;

  // Load current deviation threshold
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
      // safe-swallow: pre-existing — see goals/production-hardening/ phase B.7.b
    } catch {
      // Fallback: select text for manual copy
    }
  }, [emailAddress, t]);

  function handleSave() {
    if (threshold < 1 || threshold > 100) return;
    updateMutation.mutate({
      invoiceDeviationThresholdPercent: threshold,
    } as Parameters<typeof updateMutation.mutate>[0]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('invoiceEmailInbox')}</CardTitle>
        <CardDescription>{t('invoiceEmailBody')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email inbox address */}
        <div className="space-y-2">
          <label htmlFor={`${id}-invoice-email`} className="text-sm font-medium">
            {t('invoiceEmailInbox')}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={`${id}-invoice-email`}
              value={emailAddress}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopyEmail}
              aria-label={t('copyEmail')}>
              <ClipboardCopy className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('invoiceEmailBody')}</p>
        </div>

        {/* Deviation threshold */}
        <div className="space-y-2">
          <label htmlFor={`${id}-deviation-threshold`} className="text-sm font-medium">
            {t('deviationThreshold')}
          </label>
          <Input
            id={`${id}-deviation-threshold`}
            type="number"
            min={1}
            max={100}
            value={threshold}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setThreshold(Number(e.target.value))}
            className="max-w-[120px]"
          />
          <p className="text-xs text-muted-foreground">{t('deviationThresholdHelp')}</p>
        </div>
      </CardContent>
      <CardFooter>
        {/* biome-ignore lint/nursery/noJsxPropsBind: callback in JSX prop */}
        <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="me-2 h-4 w-4" />
          )}
          {updateMutation.isPending ? t('saving') : t('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}
