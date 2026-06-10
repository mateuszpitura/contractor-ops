import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { formatAmount as formatAmountLib } from '../../../lib/money.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export type ContractorTabPaymentRow = {
  id: string;
  paymentRunId: string;
  runNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  amountMinor: number;
  currency: string;
  status: string;
  paymentReference: string | null;
  markedPaidAt: string | null;
  createdAt: string;
};

export function useContractorTabPayments(contractorId: string) {
  const trpc = useTRPC();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const paymentsQuery = useQuery(
    trpc.payment.listByContractor.queryOptions({ contractorId, take: 200 }),
  );

  const allItems: ContractorTabPaymentRow[] = useMemo(
    () =>
      (paymentsQuery.data?.items ?? []).map(item => ({
        id: item.id,
        paymentRunId: item.paymentRunId,
        runNumber: item.paymentRun?.runNumber ?? '--',
        invoiceId: item.invoiceId,
        invoiceNumber: item.invoice?.invoiceNumber ?? '--',
        amountMinor: item.amountMinor,
        currency: item.currency,
        status: item.status,
        paymentReference: item.paymentReference ?? null,
        markedPaidAt: item.markedPaidAt ? String(item.markedPaidAt) : null,
        createdAt: String(item.createdAt ?? item.paymentRun?.createdAt ?? ''),
      })),
    [paymentsQuery.data],
  );

  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const items = useMemo(
    () => allItems.slice((page - 1) * pageSize, page * pageSize),
    [allItems, page],
  );

  const totalPaidMinor = useMemo(
    () =>
      allItems
        .filter(item => item.status === 'PAID')
        .reduce((sum, item) => sum + item.amountMinor, 0),
    [allItems],
  );

  const totalPaidCurrency = allItems[0]?.currency ?? 'PLN';

  const formatAmount = useCallback(
    (minor: number, currency: string) => formatAmountLib(minor, currency, 'pl-PL'),
    [],
  );

  return {
    page,
    setPage,
    items,
    allItems,
    totalPages,
    totalPaidMinor,
    totalPaidCurrency,
    formatAmount,
    isLoading: paymentsQuery.isLoading,
  } as const;
}
