import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useCountryComplianceForm() {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  return { formData, setFormData } as const;
}

export function useCountryCompliance(contractorId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Contractors.countryCompliance');

  const configQuery = useQuery(trpc.contractor.getCountryFieldsConfig.queryOptions());
  const fieldsQuery = useQuery(trpc.contractor.getCountryFields.queryOptions({ contractorId }));
  const contractorQuery = useQuery(trpc.contractor.getById.queryOptions({ id: contractorId }));

  const updateMutation = useMutation(
    trpc.contractor.updateCountryFields.mutationOptions({
      onSuccess: () => {
        toast.success(t('savedToast'));
        void fieldsQuery.refetch();
        queryClient.invalidateQueries(trpc.contractor.pathFilter());
      },
      onError: (err: { message?: string }) => {
        toast.error(err.message || t('saveErrorToast'));
      },
    }),
  );

  const saveFields = useCallback(
    (countryCode: string, fields: Record<string, unknown>) => {
      updateMutation.mutate({ contractorId, countryCode, fields });
    },
    [contractorId, updateMutation],
  );

  return {
    configQuery,
    fieldsQuery,
    contractorQuery,
    updateMutation,
    saveFields,
    isLoading: configQuery.isLoading || fieldsQuery.isLoading,
  } as const;
}

export function useContractorEngagements(contractorId: string) {
  const trpc = useTRPC();

  const engagementsQuery = useQuery(trpc.contractor.listEngagements.queryOptions({ contractorId }));

  return {
    engagementsQuery,
    engagements: engagementsQuery.data ?? [],
    isLoading: engagementsQuery.isLoading,
  } as const;
}
