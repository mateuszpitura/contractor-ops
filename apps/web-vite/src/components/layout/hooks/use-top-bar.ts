import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useRouter } from '../../../i18n/navigation.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useTopBar() {
  const trpc = useTRPC();
  const router = useRouter();

  const contractorCountQuery = useQuery(
    trpc.contractor.list.queryOptions({ page: 1, pageSize: 10 }),
  );

  const hasContractors = (contractorCountQuery.data?.total ?? 0) > 0;

  const navigateToNewContractor = useCallback(() => {
    router.push('/contractors?action=new');
  }, [router]);

  const navigateToUploadInvoice = useCallback(() => {
    router.push('/invoices?action=upload');
  }, [router]);

  return {
    hasContractors,
    navigateToNewContractor,
    navigateToUploadInvoice,
  } as const;
}
