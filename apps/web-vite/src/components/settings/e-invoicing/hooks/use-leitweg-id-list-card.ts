import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useTranslations } from '../../../../i18n/useTranslations.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';
import type { LeitwegIdRowData } from '../leitweg-id-row.js';

export function useLeitwegIdListCard() {
  const trpc = useTRPC();
  const t = useTranslations('EInvoice.Settings.LeitwegIdCard');
  const [createOpen, setCreateOpen] = useState(false);

  const listQuery = useQuery(trpc.leitwegId.list.queryOptions());
  const rows = (listQuery.data ?? []) as LeitwegIdRowData[];
  const isEmpty = !listQuery.isLoading && rows.length === 0;

  return {
    t,
    createOpen,
    setCreateOpen,
    listQuery,
    rows,
    isEmpty,
    isLoading: listQuery.isLoading,
  } as const;
}
