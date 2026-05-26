import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useRouter } from '../../../i18n/navigation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useTRPC } from '../../../providers/trpc-provider.js';
import type { IntakeStatus } from '../intake/intake-status-pill.js';
import type { ValidationStatus } from '../intake/intake-validation-status-pill.js';

export function useIntakeDetailActions(
  intakeId: string,
  status: IntakeStatus,
  validationStatus: ValidationStatus | null,
  validationAcknowledgedAt: Date | string | null,
  selectedCandidateId: string | null,
) {
  const t = useTranslations('EInvoice.intake');
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isXmlPending, setIsXmlPending] = useState(false);
  const [isReportPending, setIsReportPending] = useState(false);

  const invalidateBoth = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: trpc.invoiceIntake.getById.queryKey({ intakeId }),
    });
    void queryClient.invalidateQueries({
      queryKey: ['invoiceIntake', 'listByOrg'],
    });
  }, [intakeId, queryClient, trpc]);

  const convertMutation = useMutation(
    trpc.invoiceIntake.convertToInvoice.mutationOptions({
      onSuccess: result => {
        invalidateBoth();
        const converted = result as { invoiceId?: string } | undefined;
        if (converted?.invoiceId) {
          router.push(`/invoices/${converted.invoiceId}`);
        }
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.invoiceIntake.pathFilter());
      },
      onError: err => toast.error(err instanceof Error ? err.message : t('errorGeneric')),
    }),
  );

  const confirmMatchMutation = useMutation(
    trpc.invoiceIntake.confirmMatch.mutationOptions({
      onSuccess: () => {
        invalidateBoth();
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.invoiceIntake.pathFilter());
      },
      onError: err => toast.error(err instanceof Error ? err.message : t('errorGeneric')),
    }),
  );

  const acknowledgeMutation = useMutation(
    trpc.invoiceIntake.acknowledgeValidation.mutationOptions({
      onSuccess: () => {
        invalidateBoth();
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.invoiceIntake.pathFilter());
      },
      onError: err => toast.error(err instanceof Error ? err.message : t('errorGeneric')),
    }),
  );

  const rejectMutation = useMutation(
    trpc.invoiceIntake.reject.mutationOptions({
      onSuccess: () => {
        invalidateBoth();
        setRejectOpen(false);
        setRejectReason('');
        toast.success('Done.');
        queryClient.invalidateQueries(trpc.invoiceIntake.pathFilter());
      },
      onError: err => toast.error(err instanceof Error ? err.message : t('errorGeneric')),
    }),
  );

  const needsValidationAck =
    (validationStatus === 'WARNINGS' || validationStatus === 'INVALID') &&
    !validationAcknowledgedAt;

  const canConvert = status === 'MATCHED' && !needsValidationAck && !convertMutation.isPending;

  let convertTooltip: string | null = null;
  if (status !== 'MATCHED') convertTooltip = t('tooltipConvertDisabledNeedsMatch');
  else if (needsValidationAck) convertTooltip = t('tooltipConvertDisabledNeedsAck');

  const showConfirmMatch =
    selectedCandidateId !== null &&
    status !== 'MATCHED' &&
    status !== 'CONVERTED' &&
    status !== 'REJECTED';
  const showAccept = needsValidationAck;
  const canReject = status !== 'CONVERTED' && status !== 'REJECTED';

  const handleDownloadXml = useCallback(async () => {
    setIsXmlPending(true);
    try {
      const result = await queryClient.fetchQuery(
        trpc.invoiceIntake.downloadExtractedXml.queryOptions({ intakeId }),
      );
      if (!result?.url) {
        toast.error(t('downloadXmlError'));
        return;
      }
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('downloadXmlError'));
    } finally {
      setIsXmlPending(false);
    }
  }, [intakeId, queryClient, t, trpc]);

  const handleDownloadReport = useCallback(async () => {
    setIsReportPending(true);
    try {
      const result = await queryClient.fetchQuery(
        trpc.invoiceIntake.downloadValidationReport.queryOptions({ intakeId }),
      );
      if (!result?.url) {
        toast.info(t('downloadReportNotAvailable'));
        return;
      }
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('downloadReportError'));
    } finally {
      setIsReportPending(false);
    }
  }, [intakeId, queryClient, t, trpc]);

  const handleRejectConfirm = useCallback(() => {
    if (rejectReason.trim().length < 3) {
      setRejectError(t('rejectReasonTooShort'));
      return;
    }
    setRejectError(null);
    rejectMutation.mutate({ intakeId, reason: rejectReason.trim() });
  }, [intakeId, rejectMutation, rejectReason, t]);

  const openRejectDialog = useCallback(() => {
    setRejectReason('');
    setRejectError(null);
    setRejectOpen(true);
  }, []);

  const onConfirmMatch = useCallback(() => {
    if (!selectedCandidateId) return;
    confirmMatchMutation.mutate({ intakeId, contractorId: selectedCandidateId });
  }, [confirmMatchMutation, intakeId, selectedCandidateId]);

  return {
    rejectOpen,
    setRejectOpen,
    rejectReason,
    setRejectReason,
    rejectError,
    isXmlPending,
    isReportPending,
    canConvert,
    convertTooltip,
    showConfirmMatch,
    showAccept,
    canReject,
    isConvertPending: convertMutation.isPending,
    isConfirmMatchPending: confirmMatchMutation.isPending,
    isAcknowledgePending: acknowledgeMutation.isPending,
    isRejectPending: rejectMutation.isPending,
    onConvert: () => convertMutation.mutate({ intakeId }),
    onConfirmMatch,
    onAcknowledge: () => acknowledgeMutation.mutate({ intakeId }),
    onDownloadXml: handleDownloadXml,
    onDownloadReport: handleDownloadReport,
    onRejectConfirm: handleRejectConfirm,
    openRejectDialog,
  } as const;
}
