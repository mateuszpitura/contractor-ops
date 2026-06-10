import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export interface EInvoiceComplianceSummaryData {
  total: number;
  notGenerated: number;
  valid: number;
  warnings: number;
  invalid: number;
  transmitted: number;
  failed: number;
}

const EMPTY_SUMMARY: EInvoiceComplianceSummaryData = {
  total: 0,
  notGenerated: 0,
  valid: 0,
  warnings: 0,
  invalid: 0,
  transmitted: 0,
  failed: 0,
};

export function useEinvoiceComplianceSummary() {
  const trpc = useTRPC();
  const query = useQuery(trpc.einvoice.summaryForOrg.queryOptions());

  return {
    isLoading: query.isLoading,
    summary: query.data ?? EMPTY_SUMMARY,
  } as const;
}
