import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useTRPC } from '../../../../providers/trpc-provider.js';
import type { IrisStatus, IrisValidationError } from './use-iris-filing.js';

export interface BuildValidate1042SResult {
  taxYear: number;
  recipientCount: number;
  status: IrisStatus;
  ready: boolean;
  errors: IrisValidationError[];
}

/**
 * The sole tRPC boundary for the staff 1042-S IRIS filing surface. Builds +
 * XSD-validates the Publication 1187 batch XML, exposes the ManualDownload action
 * (threading the returned submissionId to the ack upload so the acknowledgement
 * attaches to the exact submission), the acknowledgement upload, and the
 * CORRECTED-supersede action. A `BUNDLE_UNAVAILABLE` status is a muted pending
 * state (validity unproven pre-enablement — the 1042-S XSD is a human SOR
 * download), never an error.
 */
export function useForm1042sFiling(taxYear: number) {
  const trpc = useTRPC();

  const validationQuery = useQuery(trpc.form1042s.buildAndValidateXml.queryOptions({ taxYear }));
  const downloadMutation = useMutation(trpc.form1042s.downloadValidatedXml.mutationOptions());
  const uploadAckMutation = useMutation(trpc.form1042s.uploadAck.mutationOptions());
  const correctionMutation = useMutation(trpc.form1042s.fileCorrection.mutationOptions());

  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const validation = (validationQuery.data ?? null) as BuildValidate1042SResult | null;

  return {
    isPending: validationQuery.isPending,
    error: validationQuery.error ?? null,
    validation,
    ready: validation?.ready ?? false,
    refetch: () => {
      void validationQuery.refetch();
    },

    download: async () => {
      const result = await downloadMutation.mutateAsync({ taxYear });
      if (result.ready && result.submissionId) {
        setSubmissionId(result.submissionId);
      }
      await validationQuery.refetch();
      return result;
    },
    isDownloading: downloadMutation.isPending,
    downloadResult: downloadMutation.data ?? null,

    uploadAck: async (ackXml: string) => {
      const result = await uploadAckMutation.mutateAsync({
        taxYear,
        ackXml,
        ...(submissionId ? { submissionId } : {}),
      });
      await validationQuery.refetch();
      return result;
    },
    isUploadingAck: uploadAckMutation.isPending,
    ackError: uploadAckMutation.error ?? null,
    ackResult: uploadAckMutation.data ?? null,

    fileCorrection: (formId: string, reason: string) =>
      correctionMutation.mutateAsync({ formId, reason }),
    isCorrecting: correctionMutation.isPending,
    correctionError: correctionMutation.error ?? null,
  } as const;
}
