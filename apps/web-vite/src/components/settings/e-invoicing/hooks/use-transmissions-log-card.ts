import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export type StatusFilter =
  | 'all'
  | 'notGenerated'
  | 'valid'
  | 'warnings'
  | 'invalid'
  | 'transmitted'
  | 'failed';

export type LifecycleRow = {
  id: string;
  invoiceNumber: string | null;
  createdAt: string | Date;
  eInvoiceLifecycle: {
    validationStatus: string | null;
    transmissionStatus: string | null;
    updatedAt: string | Date | null;
  } | null;
};

export function useTransmissionsLogCard() {
  const trpc = useTRPC();
  const t = useTranslations('EInvoice.TransmissionsLog');
  const [status, setStatus] = useState<StatusFilter>('all');

  const listQuery = useInfiniteQuery({
    ...trpc.einvoice.listByOrg.infiniteQueryOptions(
      status === 'all' ? { limit: 25 } : { status, limit: 25 },
      { getNextPageParam: lastPage => lastPage.nextCursor ?? undefined },
    ),
  });

  const rows = useMemo(() => {
    return ((listQuery.data?.pages ?? []).flatMap(p => p.rows) as LifecycleRow[]) ?? [];
  }, [listQuery.data]);

  return {
    t,
    status,
    setStatus,
    listQuery,
    rows,
    isLoading: listQuery.isLoading,
  } as const;
}
