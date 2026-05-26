import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function usePaymentRunStepReview(options: {
  selectedInvoiceIds: string[];
  groupByCurrency: boolean;
  onComplete: (result: {
    runId: string;
    runNumber: string;
    fileBase64: string;
    fileName: string;
    invoiceCount: number;
    totalMinor: number;
    currency: string;
    exportFormat: string;
  }) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const toasts = useCommonToasts();

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [exportFormat, setExportFormat] = useState<string>('CSV');
  const [isLocking, setIsLocking] = useState(false);

  const invoicesQuery = useQuery(trpc.payment.readyForPayment.queryOptions({ limit: 100 }));

  const allInvoices = useMemo(() => {
    const result = invoicesQuery.data;
    return (result?.items ?? []).filter(inv => options.selectedInvoiceIds.includes(inv.id));
  }, [invoicesQuery.data, options.selectedInvoiceIds]);

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
  const hasPLN = currencies.includes('PLN');
  const hasEUR = currencies.includes('EUR');

  const createMutation = useResourceMutation(
    trpc.payment.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.payment.pathFilter());
      },
    }),
    {
      successMessage: toasts.done(),
    },
  );

  const lockAndExportMutation = useResourceMutation(
    trpc.payment.lockAndExport.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.payment.pathFilter());
      },
    }),
    {
      successMessage: toasts.done(),
    },
  );

  const handleLockAndExport = useCallback(async () => {
    if (isLocking) return;
    setIsLocking(true);

    try {
      const runs = await createMutation.mutateAsync({
        invoiceIds: options.selectedInvoiceIds,
        groupByCurrency: options.groupByCurrency,
        name: name || undefined,
        notes: notes || undefined,
      });

      const runsArray = Array.isArray(runs) ? runs : [runs];
      if (!runsArray.length) throw new Error('No runs created');

      const run = runsArray[0] as Record<string, unknown>;
      const result = await lockAndExportMutation.mutateAsync({
        runId: run.id as string,
        exportFormat: exportFormat as 'CSV' | 'BANK_FILE' | 'SEPA_XML',
      });

      const exportResult = result as Record<string, unknown>;
      options.onComplete({
        runId: run.id as string,
        runNumber: (run.runNumber as string) ?? (run.id as string).slice(0, 8),
        fileBase64: exportResult.fileBase64 as string,
        fileName: exportResult.fileName as string,
        invoiceCount: allInvoices.length,
        totalMinor: grandTotal,
        currency: currencies.join(', '),
        exportFormat,
      });
    } catch {
      setIsLocking(false);
    }
  }, [
    isLocking,
    createMutation,
    lockAndExportMutation,
    options,
    name,
    notes,
    exportFormat,
    allInvoices.length,
    grandTotal,
    currencies,
  ]);

  return {
    name,
    setName,
    notes,
    setNotes,
    exportFormat,
    setExportFormat,
    isLocking,
    groupedByCurrency,
    currencies,
    grandTotal,
    hasPLN,
    hasEUR,
    handleLockAndExport,
  } as const;
}
