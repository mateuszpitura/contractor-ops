'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc/init';

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatMinorUnits(minor: number): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepReviewProps {
  selectedInvoiceIds: string[];
  groupByCurrency: boolean;
  onBack: () => void;
  onComplete: (result: {
    runNumber: string;
    fileBase64: string;
    fileName: string;
    invoiceCount: number;
    totalMinor: number;
    currency: string;
    exportFormat: string;
  }) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepReview({
  selectedInvoiceIds,
  groupByCurrency,
  onBack,
  onComplete,
}: StepReviewProps) {
  const t = useTranslations('Payments');

  // Optional name and description
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [exportFormat, setExportFormat] = useState<string>('CSV');
  const [isLocking, setIsLocking] = useState(false);

  // Fetch selected invoices for display
  const invoicesQuery = useQuery(trpc.payment.readyForPayment.queryOptions({ limit: 100 }));

  const allInvoices = useMemo(() => {
    const result = invoicesQuery.data;
    return (result?.items ?? []).filter(inv => selectedInvoiceIds.includes(inv.id));
  }, [invoicesQuery.data, selectedInvoiceIds]);

  // Group by currency
  type InvoiceItem = (typeof allInvoices)[number];
  const groupedByCurrency = useMemo(() => {
    const groups: Record<string, { invoices: InvoiceItem[]; totalMinor: number }> = {};
    for (const inv of allInvoices) {
      const curr = inv.currency as string;
      if (!groups[curr]) groups[curr] = { invoices: [], totalMinor: 0 };
      groups[curr].invoices.push(inv);
      groups[curr].totalMinor += inv.amountToPayMinor as number;
    }
    return groups;
  }, [allInvoices]);

  const currencies = Object.keys(groupedByCurrency);
  const grandTotal = Object.values(groupedByCurrency).reduce((sum, g) => sum + g.totalMinor, 0);

  // Check which formats are available
  const hasPLN = currencies.includes('PLN');
  const hasEUR = currencies.includes('EUR');

  // Create mutation
  const createMutation = useMutation(trpc.payment.create.mutationOptions({}));

  // Lock and export mutation
  const lockAndExportMutation = useMutation(trpc.payment.lockAndExport.mutationOptions({}));

  const handleLockAndExport = useCallback(async () => {
    if (isLocking) return;
    setIsLocking(true);

    try {
      // Step 1: Create the payment run
      const runs = await createMutation.mutateAsync({
        invoiceIds: selectedInvoiceIds,
        groupByCurrency,
        name: name || undefined,
        notes: notes || undefined,
      });

      const runsArray = Array.isArray(runs) ? runs : [runs];
      if (!runsArray.length) throw new Error('No runs created');

      // Step 2: Lock and export the first run
      const run = runsArray[0] as Record<string, unknown>;
      const result = await lockAndExportMutation.mutateAsync({
        runId: run.id as string,
        exportFormat: exportFormat as 'CSV' | 'BANK_FILE' | 'SEPA_XML',
      });

      const exportResult = result as Record<string, unknown>;
      onComplete({
        runNumber: (run.runNumber as string) ?? (run.id as string).slice(0, 8),
        fileBase64: exportResult.fileBase64 as string,
        fileName: exportResult.fileName as string,
        invoiceCount: allInvoices.length,
        totalMinor: grandTotal,
        currency: currencies.join(', '),
        exportFormat,
      });
    } catch {
      // Error toast handled by mutation onError if configured
      setIsLocking(false);
    }
  }, [
    isLocking,
    createMutation,
    lockAndExportMutation,
    selectedInvoiceIds,
    groupByCurrency,
    name,
    notes,
    exportFormat,
    onComplete,
    allInvoices.length,
    grandTotal,
    currencies,
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* Run number placeholder */}
      <div className="text-center">
        <p className="text-[20px] font-semibold">PR-{new Date().getFullYear()}-XXX</p>
        <p className="text-xs text-muted-foreground">{t('step2.runNumberLabel')}</p>
      </div>

      {/* Optional name/description */}
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('step2.nameLabel')}</Label>
          <Input
            placeholder={t('step2.namePlaceholder')}
            value={name}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setName(e.target.value)}
            maxLength={100}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('step2.descriptionLabel')}</Label>
          <Textarea
            placeholder={t('step2.descriptionPlaceholder')}
            value={notes}
            // biome-ignore lint/nursery/noJsxPropsBind: controlled input handler
            onChange={e => setNotes(e.target.value)}
            maxLength={500}
            className="h-16 text-sm resize-none"
          />
        </div>
      </div>

      <Separator />

      {/* Invoice list grouped by currency */}
      <ScrollArea className="max-h-[300px]">
        {currencies.map(curr => {
          const group = groupedByCurrency[curr];
          if (!group) return null;
          return (
            <div key={curr} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {curr} &mdash; {group.invoices.length} {t('step2.invoices')}
                </span>
                <span className="text-[20px] font-semibold tabular-nums">
                  {formatMinorUnits(group.totalMinor)} {curr}
                </span>
              </div>
              <div className="space-y-1">
                {group.invoices.slice(0, 10).map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-1 px-2 text-xs">
                    <span className="font-medium">{inv.invoiceNumber}</span>
                    <span className="text-muted-foreground">{inv.contractor?.legalName}</span>
                    <span className="font-mono tabular-nums">
                      {formatMinorUnits(inv.amountToPayMinor)}
                    </span>
                  </div>
                ))}
                {group.invoices.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{group.invoices.length - 10} more
                  </p>
                )}
              </div>
              {currencies.length > 1 && <Separator className="mt-3" />}
            </div>
          );
        })}
      </ScrollArea>

      {/* Grand total */}
      <div className="flex items-center justify-between border-t-2 pt-3">
        <span className="text-sm font-medium">{t('step2.grandTotal')}</span>
        <div className="text-end">
          {currencies.map(curr => (
            <p key={curr} className="text-[20px] font-semibold tabular-nums">
              {formatMinorUnits(groupedByCurrency[curr]?.totalMinor ?? 0)} {curr}
            </p>
          ))}
        </div>
      </div>

      <Separator />

      {/* Export format */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('step2.exportFormatLabel')}</Label>
        {/* biome-ignore lint/nursery/noJsxPropsBind: controlled component handler */}
        <Select value={exportFormat} onValueChange={v => setExportFormat(v ?? 'CSV')}>
          <SelectTrigger className="w-full h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CSV">{t('step2.formatCsv')}</SelectItem>
            {hasPLN && <SelectItem value="BANK_FILE">{t('step2.formatElixir')}</SelectItem>}
            {hasEUR && <SelectItem value="SEPA_XML">{t('step2.formatSepa')}</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onBack} disabled={isLocking}>
          {t('step2.back')}
        </Button>
        <Button onClick={handleLockAndExport} disabled={isLocking}>
          {isLocking ? (
            <>
              <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
              {t('step2.locking')}
            </>
          ) : (
            t('step2.lockAndExport')
          )}
        </Button>
      </div>
    </div>
  );
}
