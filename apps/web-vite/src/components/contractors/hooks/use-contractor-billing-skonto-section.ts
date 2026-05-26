import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '../../../providers/trpc-provider.js';
import { useFlag } from '../../layout/feature-flag-context.js';

type BillingSkontoTerm = {
  discountPercent: unknown;
  discountPeriodDays: number;
  netPeriodDays: number;
};

export function useContractorBillingSkontoSection(contractorId: string) {
  const trpc = useTRPC();
  const skontoEnabled = useFlag('payments.skonto-enabled');

  const contractorQuery = useQuery({
    ...trpc.contractor.getById.queryOptions({ id: contractorId }),
    enabled: Boolean(contractorId),
  });

  const defaultBilling =
    contractorQuery.data?.billingProfiles.find(profile => profile.isDefault) ??
    contractorQuery.data?.billingProfiles[0];

  const skontoTerm = (defaultBilling as { skontoTerms?: BillingSkontoTerm[] } | undefined)
    ?.skontoTerms?.[0];

  return {
    billingProfileId: defaultBilling?.id ?? null,
    featureEnabled: skontoEnabled,
    existingDefault: skontoTerm
      ? {
          discountPercent: Number(skontoTerm.discountPercent),
          discountDays: skontoTerm.discountPeriodDays,
          netDays: skontoTerm.netPeriodDays,
        }
      : null,
    isLoading: contractorQuery.isLoading,
  } as const;
}
