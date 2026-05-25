import { useQuery } from '@tanstack/react-query';

import { useDateFormatter } from '../../../lib/format/use-date-formatter.js';
import { useTRPC } from '../../../providers/trpc-provider.js';

export function useSkontoApplyEligibility(invoiceId: string, enabled: boolean) {
  const trpc = useTRPC();
  const { formatDate } = useDateFormatter();

  const query = useQuery(
    trpc.skonto.evaluateForInvoice.queryOptions({ invoiceId }, { enabled: enabled && !!invoiceId }),
  );

  const data = query.data;

  if (!data || data.eligibilityReason === 'NO_SKONTO_CONFIGURED') {
    return {
      isLoading: query.isLoading,
      showCheckbox: false,
      isWithinWindow: false,
      discountPercent: 0,
      discountAmountMinor: 0,
      originalAmountMinor: 0,
      discountedAmountMinor: 0,
      windowExpiryDate: undefined as string | undefined,
    } as const;
  }

  const discountPercent =
    data.netAmountMinor > 0
      ? Math.round((data.discountAmountMinor / data.netAmountMinor) * 100)
      : 0;

  const windowExpiryDate = data.discountDeadline ? formatDate(data.discountDeadline) : undefined;

  return {
    isLoading: query.isLoading,
    showCheckbox: true,
    isWithinWindow: data.eligible,
    discountPercent,
    discountAmountMinor: data.discountAmountMinor,
    originalAmountMinor: data.netAmountMinor,
    discountedAmountMinor: data.discountedAmountMinor,
    windowExpiryDate,
  } as const;
}
