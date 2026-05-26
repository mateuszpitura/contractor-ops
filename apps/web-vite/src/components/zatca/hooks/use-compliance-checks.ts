import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { ComplianceCheckResult } from '../zatca-trpc.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export function useComplianceChecks() {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.complianceChecks');
  const [results, setResults] = useState<ComplianceCheckResult[]>([]);

  const checksMutation = useMutation({
    ...zatcaTrpc.runComplianceChecks.mutationOptions(),
    onSuccess: (data: unknown) => {
      const typedData = data as ComplianceCheckResult[];
      setResults(typedData);
      const allPassed = typedData.every(r => r.status === 'CLEARED' || r.status === 'REPORTED');
      if (allPassed) {
        toast.success(t('toast.allPassed'));
      } else {
        const failedCount = typedData.filter(
          r => r.status === 'REJECTED' || r.status === 'ERROR',
        ).length;
        toast.error(t('toast.someFailed', { failedCount }));
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.error'));
    },
  });

  const runChecks = () => {
    (checksMutation.mutate as () => void)();
  };

  const allPassed =
    results.length === 6 && results.every(r => r.status === 'CLEARED' || r.status === 'REPORTED');
  const completedCount = results.length;
  const progressValue = (completedCount / 6) * 100;

  const testLabels = [
    t('testLabels.standardTaxInvoice'),
    t('testLabels.standardCreditNote'),
    t('testLabels.standardDebitNote'),
    t('testLabels.simplifiedInvoice'),
    t('testLabels.simplifiedCreditNote'),
    t('testLabels.simplifiedDebitNote'),
  ];

  return {
    results,
    runChecks,
    isPending: checksMutation.isPending,
    allPassed,
    completedCount,
    progressValue,
    testLabels,
    t,
  } as const;
}
