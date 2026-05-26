import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useIntakeDetailValidation(intakeId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [reportLoading, setReportLoading] = useState(false);

  const openReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const result = await queryClient.fetchQuery(
        trpc.invoiceIntake.downloadValidationReport.queryOptions({ intakeId }),
      );
      if (!result?.url) {
        return;
      }
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } finally {
      setReportLoading(false);
    }
  }, [intakeId, queryClient, trpc]);

  return {
    openReport,
    reportLoading,
  } as const;
}
