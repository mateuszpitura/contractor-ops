import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useOcrExtractionResult(extractionId: string, isPortal: boolean) {
  const trpc = useTRPC();

  const adminQuery = useQuery({
    ...trpc.ocr.getResult.queryOptions({ extractionId }),
    enabled: !isPortal && Boolean(extractionId),
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status === 'PROCESSING' || status === 'PENDING' ? 2000 : false;
    },
  });

  const portalQuery = useQuery({
    ...trpc.ocr.portalGetResult.queryOptions({ extractionId }),
    enabled: isPortal && Boolean(extractionId),
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status === 'PROCESSING' || status === 'PENDING' ? 2000 : false;
    },
  });

  const extraction = isPortal ? portalQuery.data : adminQuery.data;
  const isLoading = isPortal ? portalQuery.isLoading : adminQuery.isLoading;
  const isError = isPortal ? portalQuery.isError : adminQuery.isError;
  const refetch = isPortal ? portalQuery.refetch : adminQuery.refetch;

  return {
    extraction,
    extractionStatus: extraction?.status ?? 'PENDING',
    resultJson: extraction?.resultJson,
    isLoading,
    isError,
    refetch,
    isProcessing: extraction?.status === 'PROCESSING' || extraction?.status === 'PENDING',
    isComplete: extraction?.status === 'EXTRACTED' || extraction?.status === 'PARTIAL',
  } as const;
}
