import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

type SourceKind = 'UPLOAD_XML' | 'UPLOAD_PDF';

export function useIntakeDetailPdf(intakeId: string, sourceKind: SourceKind) {
  const trpc = useTRPC();
  const rawQuery = useQuery(trpc.invoiceIntake.downloadRawFile.queryOptions({ intakeId }));
  const url = (rawQuery.data as { url?: string } | undefined)?.url;

  return {
    isLoading: rawQuery.isLoading,
    url,
    isXml: sourceKind === 'UPLOAD_XML',
  } as const;
}

export function useIntakeXmlPreview(url: string | undefined) {
  const textQuery = useQuery({
    queryKey: ['intake-xml-preview', url],
    queryFn: async () => {
      if (!url) throw new Error('Missing URL');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    },
    enabled: Boolean(url),
    staleTime: 60_000,
  });

  return {
    isLoading: textQuery.isLoading,
    isError: textQuery.isError,
    text: textQuery.data,
  } as const;
}
