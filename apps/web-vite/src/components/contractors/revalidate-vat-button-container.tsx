import { useRevalidateVat } from './hooks/use-revalidate-vat.js';
import { RevalidateVatButtonView } from './revalidate-vat-button.js';

interface RevalidateVatButtonContainerProps {
  contractorId: string;
}

// Decision: mutation host — useRevalidateVat exposes revalidate + isPending;
// the compliance section composes this button unconditionally.
export function RevalidateVatButtonContainer({ contractorId }: RevalidateVatButtonContainerProps) {
  const { revalidate, isPending } = useRevalidateVat(contractorId);
  return <RevalidateVatButtonView onRevalidate={revalidate} isPending={isPending} />;
}
