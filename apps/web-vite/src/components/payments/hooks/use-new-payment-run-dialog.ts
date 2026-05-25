import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useTRPC } from '../../../providers/trpc-provider.js';

export type NewPaymentRunConfirmationData = {
  runId: string;
  runNumber: string;
  fileBase64: string;
  fileName: string;
  invoiceCount: number;
  totalMinor: number;
  currency: string;
  exportFormat: string;
};

export function useNewPaymentRunDialog(options: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewRun?: (runId: string) => void;
}) {
  const { onOpenChange, onViewRun } = options;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [groupByCurrency, setGroupByCurrency] = useState(false);
  const [confirmationData, setConfirmationData] = useState<NewPaymentRunConfirmationData | null>(
    null,
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setTimeout(() => {
          setStep(1);
          setSelectedInvoiceIds([]);
          setGroupByCurrency(false);
          setConfirmationData(null);
        }, 200);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleComplete = useCallback(
    (data: NewPaymentRunConfirmationData) => {
      setConfirmationData(data);
      setStep(3);
      void queryClient.invalidateQueries(trpc.payment.pathFilter());
    },
    [queryClient, trpc],
  );

  const handleViewRunFromConfirmation = useCallback(() => {
    if (!confirmationData) return;
    handleOpenChange(false);
    onViewRun?.(confirmationData.runId);
  }, [confirmationData, handleOpenChange, onViewRun]);

  return {
    open: options.open,
    step,
    setStep,
    selectedInvoiceIds,
    setSelectedInvoiceIds,
    groupByCurrency,
    setGroupByCurrency,
    confirmationData,
    handleOpenChange,
    handleComplete,
    handleViewRunFromConfirmation,
    handleClose: () => handleOpenChange(false),
  } as const;
}
