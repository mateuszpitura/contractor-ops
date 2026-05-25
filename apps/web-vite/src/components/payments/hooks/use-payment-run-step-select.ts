import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ReadyInvoiceRow } from '../invoice-selection-table/columns.js';

export function usePaymentRunStepSelect(options: {
  selectedInvoiceIds: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  const trpc = useTRPC();

  const [currency, setCurrency] = useState<string>('all');
  const [dueDateFrom, setDueDateFrom] = useState<Date | undefined>();
  const [dueDateTo, setDueDateTo] = useState<Date | undefined>();
  const [contractorSearch, setContractorSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(contractorSearch);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [contractorSearch]);

  const queryInput = useMemo(
    () => ({
      currency: currency === 'all' ? undefined : currency,
      dueDateFrom: dueDateFrom ?? undefined,
      dueDateTo: dueDateTo ?? undefined,
      contractorId: undefined,
      limit: 50,
    }),
    [currency, dueDateFrom, dueDateTo],
  );

  const invoicesQuery = useQuery(trpc.payment.readyForPayment.queryOptions(queryInput));

  const allInvoices = useMemo(() => {
    const result = invoicesQuery.data;
    return (result?.items ?? []) as unknown as ReadyInvoiceRow[];
  }, [invoicesQuery.data]);

  const filteredInvoices = useMemo(() => {
    if (!debouncedSearch) return allInvoices;
    const lower = debouncedSearch.toLowerCase();
    return allInvoices.filter(
      inv => inv.contractor?.legalName?.toLowerCase().includes(lower) ?? false,
    );
  }, [allInvoices, debouncedSearch]);

  const handleRowSelectionChange = useCallback(
    (selection: Record<string, boolean>) => {
      options.onSelectionChange(
        Object.entries(selection)
          .filter(([, v]) => v)
          .map(([k]) => k),
      );
    },
    [options],
  );

  return {
    currency,
    setCurrency,
    dueDateFrom,
    setDueDateFrom,
    dueDateTo,
    setDueDateTo,
    contractorSearch,
    setContractorSearch,
    allInvoices,
    filteredInvoices,
    isLoading: invoicesQuery.isLoading,
    handleRowSelectionChange,
  } as const;
}
