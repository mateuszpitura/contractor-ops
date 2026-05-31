import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useInvoiceManualMatch(
  invoiceId: string,
  onMatchConfirmed?: () => void,
  enabled = true,
) {
  const t = useTranslations('Invoices');
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [selectedContractorName, setSelectedContractorName] = useState('');
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [contractorPopoverOpen, setContractorPopoverOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (!enabled) return;
    void queryClient.prefetchQuery(
      trpc.invoice.searchContractors.queryOptions({ query: '', take: 10 }),
    );
  }, [enabled, queryClient, trpc]);

  const contractorsQuery = useQuery({
    ...trpc.invoice.searchContractors.queryOptions({
      query: debouncedQuery.trim(),
      take: 10,
    }),
    enabled: enabled && contractorPopoverOpen,
  });

  const handleContractorPopoverOpenChange = useCallback((open: boolean) => {
    setContractorPopoverOpen(open);
    if (open) {
      setSearchQuery('');
      setDebouncedQuery('');
    }
  }, []);

  const contractsQuery = useQuery({
    ...trpc.invoice.contractsForContractor.queryOptions({
      contractorId: selectedContractorId ?? '',
    }),
    enabled: enabled && !!selectedContractorId,
  });

  const manualMatchMutation = useMutation(
    trpc.invoice.manualMatch.mutationOptions({
      onSuccess: () => {
        toast.success(t('match.matchConfirmedToast'));
        onMatchConfirmed?.();
        queryClient.invalidateQueries(trpc.invoice.pathFilter());
      },
      onError: () => {
        toast.error(t('match.matchError'));
      },
    }),
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleSelectContractor = useCallback((contractor: { id: string; legalName: string }) => {
    setSelectedContractorId(contractor.id);
    setSelectedContractorName(contractor.legalName);
    setSelectedContractId(null);
    setContractorPopoverOpen(false);
  }, []);

  const handleConfirmMatch = useCallback(() => {
    if (!selectedContractorId) return;
    manualMatchMutation.mutate({
      invoiceId,
      contractorId: selectedContractorId,
      contractId: selectedContractId ?? undefined,
    });
  }, [invoiceId, manualMatchMutation, selectedContractId, selectedContractorId]);

  const isContractorSearchActive = debouncedQuery.trim().length > 0;

  return {
    searchQuery,
    isContractorSearchActive,
    onSearchChange: handleSearchChange,
    selectedContractorId,
    selectedContractorName,
    selectedContractId,
    onSelectContractId: setSelectedContractId,
    contractorPopoverOpen,
    onContractorPopoverOpenChange: handleContractorPopoverOpenChange,
    onSelectContractor: handleSelectContractor,
    contractors: (contractorsQuery.data ?? []) as Array<{
      id: string;
      legalName: string;
      taxId: string | null;
      status: string;
    }>,
    contracts: (contractsQuery.data ?? []) as Array<{
      id: string;
      title: string;
      type: string;
      status: string;
    }>,
    isContractorsLoading: contractorsQuery.isLoading,
    isContractorsFetching: contractorsQuery.isFetching,
    isContractsLoading: contractsQuery.isLoading,
    onConfirmMatch: handleConfirmMatch,
    isConfirmPending: manualMatchMutation.isPending,
  } as const;
}
