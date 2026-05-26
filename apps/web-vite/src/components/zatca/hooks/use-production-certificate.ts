import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export function useProductionCertificate() {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.productionCertificate');
  const [completed, setCompleted] = useState(false);

  const exchangeMutation = useMutation({
    ...zatcaTrpc.exchangeProductionCert.mutationOptions(),
    onSuccess: () => {
      setCompleted(true);
      toast.success(t('toast.success'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.error'));
    },
  });

  const exchangeProductionCert = () => {
    (exchangeMutation.mutate as () => void)();
  };

  return {
    completed,
    exchangeProductionCert,
    isPending: exchangeMutation.isPending,
    t,
  } as const;
}
