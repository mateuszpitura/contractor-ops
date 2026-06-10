import { Button } from '@contractor-ops/ui/components/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@contractor-ops/ui/components/shadcn/card';
import { Input } from '@contractor-ops/ui/components/shadcn/input';
import { ClipboardCopy, Loader2, Save } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import type { useInvoiceMatchingSettings as UseInvoiceMatchingSettings } from './hooks/use-invoice-matching-settings.js';
import { useInvoiceMatchingSettings } from './hooks/use-invoice-matching-settings.js';

export type InvoiceMatchingSettingsProps = ReturnType<typeof UseInvoiceMatchingSettings>;

export function InvoiceMatchingSettingsView({
  id,
  t,
  emailAddress,
  threshold,
  setThreshold,
  isDirty,
  handleCopyEmail,
  handleSave,
  isPending,
}: InvoiceMatchingSettingsProps) {
  const handleThresholdChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setThreshold(Number(e.target.value)),
    [setThreshold],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('invoiceEmailInbox')}</CardTitle>
        <CardDescription>{t('invoiceEmailBody')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
            onChange={handleThresholdChange}
            className="max-w-[120px]"
          />
          <p className="text-xs text-muted-foreground">{t('deviationThresholdHelp')}</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={!isDirty || isPending}>
          {isPending ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="me-2 h-4 w-4" />
          )}
          {isPending ? t('saving') : t('saveCta')}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function InvoiceMatchingSettings() {
  const settings = useInvoiceMatchingSettings();
  return <InvoiceMatchingSettingsView {...settings} />;
}
