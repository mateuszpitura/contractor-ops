import { useRevalidateVat } from './hooks/use-revalidate-vat.js';
import { RevalidateVatButtonView } from './revalidate-vat-button.js';

interface RevalidateVatButtonContainerProps {
  contractorId: string;
}

// Decision: render gated externally by parent (compliance section). Container's
// job is to keep the revalidateVat mutation out of the view.
export function RevalidateVatButtonContainer({ contractorId }: RevalidateVatButtonContainerProps) {
  const { revalidate, isPending } = useRevalidateVat(contractorId);
  return <RevalidateVatButtonView onRevalidate={revalidate} isPending={isPending} />;
}
