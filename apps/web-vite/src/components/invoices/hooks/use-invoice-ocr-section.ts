import type { OcrExtractionResult } from '@contractor-ops/integrations/types/ocr';
import { useQuery } from '@tanstack/react-query';

import { useTRPC } from '../../../providers/trpc-provider.js';

export function useInvoiceOcrSection(documentId: string) {
  const trpc = useTRPC();

  const query = useQuery({
    ...trpc.ocr.getByDocument.queryOptions({ documentId }),
    enabled: !!documentId,
  });

  const extraction = query.data;
  const status = extraction?.status as
    | 'PENDING'
    | 'PROCESSING'
    | 'EXTRACTED'
    | 'PARTIAL'
    | 'FAILED'
    | undefined;
  const resultJson = extraction?.resultJson as OcrExtractionResult | null | undefined;
  const fieldCount = resultJson
    ? Object.values(resultJson.fields).filter(f => f.value != null).length
    : 0;
  const totalFields = resultJson ? Object.keys(resultJson.fields).length : 0;

  return {
    isLoading: query.isLoading,
    extraction: extraction ?? null,
    status,
    fieldCount,
    totalFields,
    errorMessage: resultJson?.errorMessage,
  } as const;
}
