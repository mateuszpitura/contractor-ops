import type { ZatcaTaxDetails } from '@contractor-ops/einvoice/zatca/schemas';
import { useResourceMutation } from '../../../hooks/use-resource-mutation.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { useZatcaTrpc } from './use-zatca-trpc.js';

export function useTaxDetailsForm(onSuccess: () => void) {
  const zatcaTrpc = useZatcaTrpc();
  const t = useTranslations('Zatca.taxDetailsForm');

  const saveMutation = useResourceMutation(
    {
      ...zatcaTrpc.saveTaxDetails.mutationOptions(),
      onSuccess: () => {
        onSuccess();
      },
    },
    {
      successMessage: t('toast.success'),
      errorMessage: t('toast.error'),
    },
  );

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
