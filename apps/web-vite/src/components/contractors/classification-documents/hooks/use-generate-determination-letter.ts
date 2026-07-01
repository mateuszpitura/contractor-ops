// Sole tRPC boundary for the US Determination Letter generate action.
//
// Mirrors useGenerateSds: enqueues the deterministic PDF render off the request
// path (the mutation returns immediately; the archived letter surfaces in the
// document-history list once the export completes). Staff-only + us-expansion
// gated server-side.

import { useCallback } from 'react';

import { useResourceMutation } from '../../../../hooks/use-resource-mutation.js';
import { useCommonToasts } from '../../../../i18n/use-common-toasts.js';
import { useTRPC } from '../../../../providers/trpc-provider.js';

export function useGenerateDeterminationLetter(classificationAssessmentId: string) {
  const trpc = useTRPC();
  const toasts = useCommonToasts();

  const generateMutation = useResourceMutation(
    trpc.classificationDocument.generateUsDeterminationLetter.mutationOptions(),
    {
      invalidate: [trpc.classificationDocument.pathFilter()],
      successMessage: toasts.done(),
    },
  );

  const generate = useCallback(
    () => generateMutation.mutate({ classificationAssessmentId }),
    [generateMutation, classificationAssessmentId],
  );

  return { generateMutation, generate } as const;
}
