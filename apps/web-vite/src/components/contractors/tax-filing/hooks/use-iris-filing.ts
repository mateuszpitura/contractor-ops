import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useTRPC } from '../../../../providers/trpc-provider.js';

export type IrisStatus =
  | 'VALID'
  | 'INVALID'
  | 'BUNDLE_UNAVAILABLE'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PROCESSING'
  | 'PARTIALLY_ACCEPTED'
  | 'ACCEPTED_WITH_ERRORS'
  | 'NOT_FOUND';

export interface IrisValidationError {
  code: string;
  message: string;
  severity: string;
}

export interface BuildValidateResult {
  taxYear: number;
  recipientCount: number;
  status: IrisStatus;
  ready: boolean;
  errors: IrisValidationError[];
}

export interface StateFilingOutput {
  stateCode: string;
  cfsfParticipant: boolean;
  requiresDirectFiling: boolean;
  cfsfHandled: boolean;
  recipientCount: number;
  totalBox1Minor: number;
  totalStateWithholdingMinor: number;
  csv: string | null;
  guidance: string;
  note: string | null;
}

/**
 * The sole tRPC boundary for the staff IRIS filing surface. Builds + validates
 * the batch XML, exposes the ManualDownload action, the acknowledgement upload,
 * the CORRECTED-supersede action, and the on-demand per-state filing output.
 */
export function useIrisFiling(taxYear: number) {
  const trpc = useTRPC();

  const validationQuery = useQuery(trpc.tax1099.buildAndValidateXml.queryOptions({ taxYear }));
  const downloadMutation = useMutation(trpc.tax1099.downloadValidatedXml.mutationOptions());
  const uploadAckMutation = useMutation(trpc.tax1099.uploadAck.mutationOptions());
  const correctionMutation = useMutation(trpc.tax1099.fileCorrection.mutationOptions());

  const [stateCode, setStateCode] = useState<string | null>(null);
  const stateQuery = useQuery(
    trpc.tax1099.getStateFilingOutput.queryOptions(
      { taxYear, stateCode: stateCode ?? 'XX' },
      { enabled: stateCode !== null },
    ),
  );

  const validation = (validationQuery.data ?? null) as BuildValidateResult | null;

  return {
    isPending: validationQuery.isPending,
    error: validationQuery.error ?? null,
    validation,
    ready: validation?.ready ?? false,
    refetch: () => {
      void validationQuery.refetch();
    },

    download: () => downloadMutation.mutateAsync({ taxYear }),
    isDownloading: downloadMutation.isPending,
    downloadResult: downloadMutation.data ?? null,

    uploadAck: async (ackXml: string) => {
      const result = await uploadAckMutation.mutateAsync({ taxYear, ackXml });
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

    selectedState: stateCode,
    selectState: setStateCode,
    stateOutput: (stateQuery.data ?? null) as StateFilingOutput | null,
    isStatePending: stateCode !== null && stateQuery.isPending,
    stateError: stateQuery.error ?? null,
  } as const;
}
