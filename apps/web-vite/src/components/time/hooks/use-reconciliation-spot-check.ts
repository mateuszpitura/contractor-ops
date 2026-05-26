import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import {
  useReconciliationSpotCheckContractors,
  useReconciliationSpotCheckContracts,
  useReconciliationSpotCheckQuery,
} from './use-reconciliation.js';

interface ContractorOption {
  id: string;
  legalName: string;
  email: string | null;
  pendingCount: number;
  approvedMinutesThisMonth: number;
}

interface ContractOption {
  id: string;
  title?: string | null;
  rateType?: string | null;
  rateValueMinor?: number | null;
  currency?: string | null;
  contractor?: { id: string; legalName: string; displayName?: string | null } | null;
}

export function useReconciliationSpotCheck() {
  const t = useTranslations('Time.spotCheck');

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [contractorId, setContractorId] = useState<string>('');
  const [contractId, setContractId] = useState<string>('');
  const [periodStart, setPeriodStart] = useState<string>(monthAgo);
  const [periodEnd, setPeriodEnd] = useState<string>(today);
  const [invoicedInput, setInvoicedInput] = useState<string>('0.00');

  const contractorsQuery = useReconciliationSpotCheckContractors();
  const contractors = (contractorsQuery.data ?? []) as ContractorOption[];

  const contractsQuery = useReconciliationSpotCheckContracts(contractorId);

  const contractList = useMemo(() => {
    const data = contractsQuery.data as { items: ContractOption[] } | undefined;
    return data?.items ?? [];
  }, [contractsQuery.data]);

  const invoicedAmountMinor = useMemo(() => {
    const parsed = Number.parseFloat(invoicedInput.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed * 100);
  }, [invoicedInput]);

  const validPeriod =
    Boolean(periodStart) &&
    Boolean(periodEnd) &&
    new Date(periodStart).getTime() <= new Date(periodEnd).getTime();

  const canRun = Boolean(contractId) && validPeriod && invoicedAmountMinor !== null;

  const reconciliationQuery = useReconciliationSpotCheckQuery({
    contractId,
    periodStart: periodStart || today,
    periodEnd: periodEnd || today,
    invoicedAmountMinor: invoicedAmountMinor ?? 0,
    enabled: false,
  });

  async function handleRun() {
    if (!canRun) return;
    try {
      await reconciliationQuery.refetch({ throwOnError: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toast.failed'));
    }
  }

  const result = reconciliationQuery.data;
  const hasResult = reconciliationQuery.isFetched && !reconciliationQuery.isFetching;

  function handleContractorChange(value: string | null) {
    setContractorId(value ?? '');
    setContractId('');
  }

  function handleContractChange(value: string | null) {
    setContractId(value ?? '');
  }

  return {
    t,
    contractorId,
    contractId,
    periodStart,
    periodEnd,
    invoicedInput,
    setPeriodStart,
    setPeriodEnd,
    setInvoicedInput,
    contractorsQuery,
    contractors,
    contractsQuery,
    contractList,
    canRun,
    reconciliationQuery,
    handleRun,
    result,
    hasResult,
    handleContractorChange,
    handleContractChange,
  } as const;
}

export type UseReconciliationSpotCheckReturn = ReturnType<typeof useReconciliationSpotCheck>;
