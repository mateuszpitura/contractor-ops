import type { ZatcaTaxDetails } from '@contractor-ops/einvoice/zatca/schemas';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export function useTaxDetailsForm(onSuccess: () => void) {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.taxDetailsForm');

  const saveMutation = useMutation({
    ...zatcaTrpc.saveTaxDetails.mutationOptions(),
    onSuccess: () => {
      toast.success(t('toast.success'));
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || t('toast.error'));
    },
  });

  const submitTaxDetails = (data: ZatcaTaxDetails) => {
    (saveMutation.mutate as unknown as (input: { taxDetails: ZatcaTaxDetails }) => void)({
      taxDetails: data,
    });
  };

  return {
    submitTaxDetails,
    isPending: saveMutation.isPending,
    t,
  } as const;
}
