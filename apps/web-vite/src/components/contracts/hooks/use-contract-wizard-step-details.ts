import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { useTRPC } from '../../../providers/trpc-provider.js';
import type { ContractWizardFormValues } from '../contract-wizard/wizard-dialog.js';

export interface ContractorListItem {
  id: string;
  displayName: string;
  taxId: string | null;
  [key: string]: unknown;
}

export function useContractWizardStepDetails(
  form: UseFormReturn<ContractWizardFormValues>,
  lockedContractorId?: string,
) {
  const trpc = useTRPC();
  const [contractorSearch, setContractorSearch] = useState('');

  const selectedContractorId = form.watch('contractorId');

  const contractorsQuery = useQuery(
    trpc.contractor.list.queryOptions({
      page: 1,
      pageSize: 50,
      search: contractorSearch.length >= 2 ? contractorSearch : undefined,
    }),
  );

  const contractors = (contractorsQuery.data?.items ?? []) as ContractorListItem[];
  const selectedContractor = contractors.find(c => c.id === selectedContractorId);

  useEffect(() => {
    if (lockedContractorId && !selectedContractorId) {
      form.setValue('contractorId', lockedContractorId, { shouldDirty: false });
    }
  }, [lockedContractorId, selectedContractorId, form]);

  return {
    contractorSearch,
    contractors,
    contractorsLoading: contractorsQuery.isLoading,
    selectedContractor,
    selectedContractorId,
    setContractorSearch,
  } as const;
}
