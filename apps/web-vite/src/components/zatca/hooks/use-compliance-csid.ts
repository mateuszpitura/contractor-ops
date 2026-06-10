import { useState } from 'react';
import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export function useComplianceCsid() {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.complianceCsid');
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'storing' | 'done'>('idle');

  const requestMutation = useResourceMutation(
    {
      ...zatcaTrpc.requestComplianceCsid.mutationOptions(),
      onMutate: () => {
        setPhase('submitting');
      },
      onSuccess: () => {
        setPhase('storing');
        setTimeout(() => {
          setPhase('done');
        }, 500);
      },
      onError: () => {
        setPhase('idle');
      },
    },
    {
      successMessage: t('toast.success'),
      errorMessage: t('toast.error'),
    },
  );

  const requestComplianceCsid = () => {
    (requestMutation.mutate as () => void)();
  };

  const csrSubmitted = phase === 'submitting' || phase === 'storing' || phase === 'done';
  const csidReceived = phase === 'storing' || phase === 'done';
  const certStored = phase === 'done';

  return {
    phase,
    requestComplianceCsid,
    isPending: requestMutation.isPending,
    csrSubmitted,
    csidReceived,
    certStored,
    t,
  } as const;
}
