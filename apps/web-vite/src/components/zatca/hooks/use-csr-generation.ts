import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export function useCsrGeneration() {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.csrGeneration');
  const tAria = useTranslations('Common.aria');
  const [csrPem, setCsrPem] = useState<string | null>(null);

  const generateMutation = useMutation({
    ...zatcaTrpc.generateCsr.mutationOptions(),
    onSuccess: (data: unknown) => {
      const result = data as { csrPem: string };
      setCsrPem(result.csrPem);
      toast.success(t('toast.success'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.error'));
    },
  });

  const generateCsr = () => {
    (generateMutation.mutate as () => void)();
  };

  return {
    csrPem,
    generateCsr,
    isPending: generateMutation.isPending,
    t,
    tAria,
  } as const;
}
